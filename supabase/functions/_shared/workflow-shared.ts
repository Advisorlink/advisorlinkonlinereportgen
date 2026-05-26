// Helpers for invoking workflow triggers from anywhere.
export async function fireWorkflowTrigger(
  triggerType: string,
  context: Record<string, unknown>,
): Promise<void> {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return;
  try {
    await fetch(`${url}/functions/v1/workflow-trigger`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": key,
        "Authorization": `Bearer ${key}`,
      },
      body: JSON.stringify({ triggerType, context }),
    });
  } catch (e) {
    console.warn("fireWorkflowTrigger failed", triggerType, e);
  }
}
