import { supabase } from "@/integrations/supabase/client";
import type { ClientInputs } from "@/lib/calc";

const clean = (value?: string | null) => (value ?? "").trim();
const normaliseEmail = (value?: string | null) => clean(value).toLowerCase();
const phoneDigits = (value?: string | null) => clean(value).replace(/\D+/g, "");

function isSameClient(existing: { client_name?: string | null; email?: string | null; inputs?: Record<string, unknown> | null }, inputs: ClientInputs) {
  const nextEmail = normaliseEmail(inputs.clientEmail);
  const oldEmail = normaliseEmail(existing.email || (existing.inputs?.clientEmail as string | undefined));
  if (nextEmail && oldEmail) return nextEmail === oldEmail;

  const nextPhone = phoneDigits(inputs.clientPhone);
  const oldPhone = phoneDigits(existing.inputs?.clientPhone as string | undefined);
  if (nextPhone.length >= 8 && oldPhone.length >= 8) return nextPhone.slice(-9) === oldPhone.slice(-9);

  return clean(existing.client_name).toLowerCase() === clean(inputs.clientName).toLowerCase();
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || null, lastName: parts.slice(1).join(" ") || null };
}

function serialise<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function syncClientContactFromInputs(opts: {
  userId: string;
  inputs: ClientInputs;
  source?: string | null;
  notes?: string | null;
  extraFields?: Record<string, unknown>;
}) {
  const fullName = clean(opts.inputs.clientName) || "Unnamed client";
  const email = clean(opts.inputs.clientEmail) || null;
  const phone = clean(opts.inputs.clientPhone);
  const { firstName, lastName } = splitName(fullName);

  let existing: { id: string; custom_fields: Record<string, unknown> | null; lead_source: string | null } | null = null;
  if (phone) {
    const { data } = await supabase
      .from("sms_contacts")
      .select("id, custom_fields, lead_source")
      .eq("phone", phone)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    existing = data as typeof existing;
  }
  if (!existing && email) {
    const { data } = await supabase
      .from("sms_contacts")
      .select("id, custom_fields, lead_source")
      .ilike("email", email)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    existing = data as typeof existing;
  }

  const customFields = {
    ...(existing?.custom_fields ?? {}),
    age: opts.inputs.age ? String(opts.inputs.age) : null,
    annual_income: opts.inputs.annualIncome ?? null,
    retirement_age: opts.inputs.retirementAge ?? null,
    goal_balance: opts.inputs.goalBalance ?? null,
    desired_income_amount: opts.inputs.desiredIncomeAmount ?? null,
    desired_income_frequency: opts.inputs.desiredIncomeFrequency ?? null,
    super_fund_name: opts.inputs.fundName || null,
    super_balance: opts.inputs.superBalance ?? null,
    model_label: opts.inputs.modelLabel || null,
    growth_assets_pct: opts.inputs.growthAssetsPct ?? null,
    gross_return: opts.inputs.grossReturn ?? null,
    report_inputs: serialise(opts.inputs),
    last_report_saved_at: new Date().toISOString(),
    ...(opts.extraFields ?? {}),
  };

  if (existing?.id) {
    await supabase
      .from("sms_contacts")
      .update({
        full_name: fullName,
        first_name: firstName,
        last_name: lastName,
        email,
        phone: phone || undefined,
        notes: opts.notes ?? undefined,
        lead_source: existing.lead_source || opts.source || null,
        custom_fields: customFields,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", existing.id);
    return existing.id;
  }

  if (!phone) return null;

  const { data } = await supabase
    .from("sms_contacts")
    .insert({
      user_id: opts.userId,
      full_name: fullName,
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      notes: opts.notes || null,
      lead_source: opts.source || "Report Generator",
      custom_fields: customFields,
    } as never)
    .select("id")
    .single();

  return (data as { id?: string } | null)?.id ?? null;
}

export async function saveClientReportSnapshot(opts: {
  userId: string;
  reportId?: string | null;
  inputs: ClientInputs;
  summary: unknown;
  research?: unknown;
  pdfPath?: string | null;
  source?: string | null;
  notes?: string | null;
  extraContactFields?: Record<string, unknown>;
}) {
  const clientEmail = clean(opts.inputs.clientEmail) || null;
  const reportPayload = {
    email: clientEmail,
    client_name: clean(opts.inputs.clientName) || "Unnamed client",
    inputs: serialise(opts.inputs),
    summary: serialise(opts.summary),
    research: opts.research ? serialise(opts.research) : null,
    ...(opts.pdfPath !== undefined ? { pdf_path: opts.pdfPath } : {}),
  };

  let shouldUpdate = false;
  if (opts.reportId) {
    const { data: existing } = await supabase
      .from("reports")
      .select("id, client_name, email, inputs")
      .eq("id", opts.reportId)
      .maybeSingle();
    shouldUpdate = !!existing && isSameClient(existing as any, opts.inputs);
  }

  const saved = shouldUpdate && opts.reportId
    ? await supabase.from("reports").update(reportPayload as never).eq("id", opts.reportId).select("id").single()
    : await supabase.from("reports").insert({ ...reportPayload, user_id: opts.userId } as never).select("id").single();

  if (saved.error) throw saved.error;

  await syncClientContactFromInputs({
    userId: opts.userId,
    inputs: opts.inputs,
    source: opts.source,
    notes: opts.notes,
    extraFields: opts.extraContactFields,
  });

  return (saved.data as { id?: string } | null)?.id ?? opts.reportId ?? null;
}