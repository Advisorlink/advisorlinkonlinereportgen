// Paced AI caller campaign ticker.
// Runs every minute via pg_cron. For every active campaign:
//   - Skip if outside the configured daily window / active days (campaign tz).
//   - Skip if the per-hour cap has been reached in the last 60 min.
//   - Skip if a call is currently in flight for this campaign.
//   - Skip if the gap since the last call ended hasn't elapsed.
//   - Otherwise: dial ONE pending contact.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const VAPI_BASE = "https://api.vapi.ai";
const VAPI_API_KEY = Deno.env.get("VAPI_API_KEY")!;
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function normalizeAUPhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-\(\)]/g, "");
  if (cleaned.startsWith("0") && cleaned.length === 10) {
    cleaned = "+61" + cleaned.slice(1);
  }
  if (cleaned.startsWith("61") && !cleaned.startsWith("+") && cleaned.length >= 11) {
    cleaned = "+" + cleaned;
  }
  if (!cleaned.startsWith("+")) cleaned = "+" + cleaned;
  return cleaned;
}

// Get current weekday (1=Mon..7=Sun) and HH:MM in a given IANA tz.
function tzNow(timezone: string): { dow: number; hhmm: string } {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const wd = parts.find((p) => p.type === "weekday")?.value || "Mon";
  const hh = parts.find((p) => p.type === "hour")?.value || "00";
  const mm = parts.find((p) => p.type === "minute")?.value || "00";
  const dowMap: Record<string, number> = {
    Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
  };
  return { dow: dowMap[wd] ?? 1, hhmm: `${hh}:${mm}` };
}

function withinWindow(
  start: string, // 'HH:MM:SS' or 'HH:MM'
  end: string,
  nowHHMM: string,
): boolean {
  const s = start.slice(0, 5);
  const e = end.slice(0, 5);
  return nowHHMM >= s && nowHHMM < e;
}

async function tickCampaign(supabase: any, campaign: any) {
  const tz = campaign.timezone || "Australia/Sydney";
  const { dow, hhmm } = tzNow(tz);

  const activeDays: number[] = campaign.active_days || [1, 2, 3, 4, 5];
  if (!activeDays.includes(dow)) {
    return { campaignId: campaign.id, skipped: "outside-active-days" };
  }
  if (!withinWindow(campaign.daily_start_time, campaign.daily_end_time, hhmm)) {
    return { campaignId: campaign.id, skipped: "outside-window" };
  }

  // Per-hour cap (campaign-scoped).
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: lastHourCount } = await supabase
    .from("ai_caller_call_logs")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaign.id)
    .gte("started_at", hourAgo);
  if ((lastHourCount ?? 0) >= (campaign.calls_per_hour ?? 50)) {
    return { campaignId: campaign.id, skipped: "hourly-cap" };
  }

  // In-flight call? (initiated/ringing/in-progress with no ended_at)
  const { count: inFlight } = await supabase
    .from("ai_caller_call_logs")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaign.id)
    .is("ended_at", null);
  if ((inFlight ?? 0) > 0) {
    return { campaignId: campaign.id, skipped: "in-flight" };
  }

  // Gap since the previous call finished.
  if (campaign.last_call_finished_at) {
    const since = Date.now() - new Date(campaign.last_call_finished_at).getTime();
    if (since < (campaign.min_gap_seconds ?? 180) * 1000) {
      return { campaignId: campaign.id, skipped: "gap" };
    }
  }

  // Next pending contact.
  const { data: contacts } = await supabase
    .from("ai_caller_contacts")
    .select("*")
    .eq("campaign_id", campaign.id)
    .eq("call_status", "pending")
    .order("created_at", { ascending: true })
    .limit(1);

  if (!contacts || contacts.length === 0) {
    // Nothing left to dial — mark complete.
    await supabase
      .from("ai_caller_campaigns")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", campaign.id);
    return { campaignId: campaign.id, skipped: "completed" };
  }

  const contact = contacts[0];
  const assistantId = campaign.vapi_assistant_id;
  const phoneNumberId = campaign.phone_number_id;
  if (!assistantId || !phoneNumberId) {
    return { campaignId: campaign.id, error: "missing-assistant-or-phone" };
  }

  // Split the contact's name so scripts can greet them via
  // {{first_name}} / {{name}} placeholders in the assistant's first message.
  const fullName = (contact.name || "").trim();
  const firstName = fullName.split(/\s+/)[0] || fullName;

  const callPayload = {
    assistantId,
    customer: { number: normalizeAUPhone(contact.phone), name: fullName || undefined },
    phoneNumberId,
    assistantOverrides: {
      variableValues: {
        name: fullName,
        first_name: firstName,
        full_name: fullName,
      },
    },
    metadata: { contactId: contact.id, campaignId: campaign.id },
  };

  const callRes = await fetch(`${VAPI_BASE}/call/phone`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${VAPI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(callPayload),
  });

  if (!callRes.ok) {
    const errText = await callRes.text();
    console.error("VAPI call failed", {
      status: callRes.status,
      body: errText,
      assistantId,
      phoneNumberId,
      to: normalizeAUPhone(contact.phone),
      campaignId: campaign.id,
      contactId: contact.id,
    });
    // Persist the error onto the call log so it's visible in the UI.
    await supabase.from("ai_caller_call_logs").insert({
      campaign_id: campaign.id,
      contact_id: contact.id,
      status: "failed",
      started_at: new Date().toISOString(),
      ended_at: new Date().toISOString(),
      error_message: `VAPI ${callRes.status}: ${errText}`.slice(0, 2000),
    });
    // Mark contact failed so we move on.
    await supabase
      .from("ai_caller_contacts")
      .update({
        call_status: "failed",
        last_called_at: new Date().toISOString(),
        call_attempts: (contact.call_attempts || 0) + 1,
      })
      .eq("id", contact.id);
    // Treat as a finished call for pacing purposes.
    await supabase
      .from("ai_caller_campaigns")
      .update({ last_call_finished_at: new Date().toISOString() })
      .eq("id", campaign.id);
    return { campaignId: campaign.id, contactId: contact.id, error: errText };
  }

  const call = await callRes.json();

  await supabase.from("ai_caller_call_logs").insert({
    campaign_id: campaign.id,
    contact_id: contact.id,
    vapi_call_id: call.id,
    status: "initiated",
    started_at: new Date().toISOString(),
  });

  await supabase
    .from("ai_caller_contacts")
    .update({
      call_status: "calling",
      call_attempts: (contact.call_attempts || 0) + 1,
      last_called_at: new Date().toISOString(),
      vapi_call_id: call.id,
    })
    .eq("id", contact.id);

  return { campaignId: campaign.id, dialed: contact.id, callId: call.id };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: campaigns, error } = await supabase
    .from("ai_caller_campaigns")
    .select("*")
    .eq("status", "active");

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: any[] = [];
  for (const c of campaigns || []) {
    try {
      results.push(await tickCampaign(supabase, c));
    } catch (err: any) {
      results.push({ campaignId: c.id, error: err?.message || String(err) });
    }
  }

  return new Response(JSON.stringify({ tickedAt: new Date().toISOString(), results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
