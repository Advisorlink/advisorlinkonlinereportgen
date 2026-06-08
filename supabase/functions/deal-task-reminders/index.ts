// Sends SMS reminders for due deal_tasks. Triggered by pg_cron every minute.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID")!;
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")!;
const TELNYX_API_KEY = Deno.env.get("TELNYX_API_KEY");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

function normalizePhone(input: string): string {
  let n = String(input).trim().replace(/[\s\-().]/g, "");
  if (n.startsWith("+")) return n;
  if (n.startsWith("00")) return "+" + n.slice(2);
  if (n.startsWith("0")) return "+61" + n.slice(1);
  if (/^4\d{8}$/.test(n)) return "+61" + n;
  if (n.startsWith("61")) return "+" + n;
  return "+" + n;
}

async function sendViaTwilio(to: string, from: string, body: string) {
  const params = new URLSearchParams({ To: to, From: from, Body: body });
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: "POST",
      headers: {
        "Authorization": "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    },
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`Twilio: ${JSON.stringify(data)}`);
  return data.sid as string;
}

async function sendViaTelnyx(to: string, from: string, body: string) {
  if (!TELNYX_API_KEY) throw new Error("TELNYX_API_KEY not set");
  const res = await fetch("https://api.telnyx.com/v2/messages", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${TELNYX_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, text: body }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Telnyx: ${JSON.stringify(data)}`);
  return (data.data?.id || data.id) as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const nowIso = new Date().toISOString();
  const { data: due, error } = await supabase
    .from("deal_tasks")
    .select("id, title, due_at, reminder_phone, deal_id, pipeline_deals(client_name)")
    .is("reminder_sent_at", null)
    .is("completed_at", null)
    .lte("due_at", nowIso)
    .limit(50);

  if (error) {
    console.error("query error", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }

  // Default sending number
  const { data: defaultNum } = await supabase
    .from("sms_twilio_numbers")
    .select("phone_number, provider")
    .eq("is_default", true)
    .limit(1)
    .maybeSingle();
  const { data: anyNum } = defaultNum
    ? { data: defaultNum }
    : await supabase.from("sms_twilio_numbers").select("phone_number, provider").limit(1).maybeSingle();
  const fromNumber = (anyNum as any)?.phone_number;
  const provider = (anyNum as any)?.provider || "twilio";

  let sent = 0;
  const results: any[] = [];

  for (const task of due || []) {
    try {
      if (!fromNumber) throw new Error("No sending number configured");
      const to = normalizePhone(task.reminder_phone);
      const clientName = (task as any).pipeline_deals?.client_name || "client";
      const body = `Hey Trav, your task is due: "${task.title}" for ${clientName}.`;
      let sid: string;
      if (provider === "telnyx") {
        sid = await sendViaTelnyx(to, fromNumber, body);
      } else {
        sid = await sendViaTwilio(to, fromNumber, body);
      }
      await supabase
        .from("deal_tasks")
        .update({ reminder_sent_at: new Date().toISOString(), reminder_error: null })
        .eq("id", task.id);
      sent++;
      results.push({ id: task.id, sid });
    } catch (e: any) {
      console.error("send failed", task.id, e?.message);
      await supabase
        .from("deal_tasks")
        .update({ reminder_error: String(e?.message || e).slice(0, 500) })
        .eq("id", task.id);
      results.push({ id: task.id, error: String(e?.message || e) });
    }
  }

  return new Response(JSON.stringify({ checked: due?.length || 0, sent, results }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
