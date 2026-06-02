import { supabase } from "@/integrations/supabase/client";

export type ClientDocumentUploadPayload = {
  clientName: string;
  clientEmail: string;
  clientPhone?: string | null;
  documentType: string;
  notes?: string | null;
  file: File;
};

export async function uploadClientDocumentSubmission(payload: ClientDocumentUploadPayload) {
  const form = new FormData();
  form.append("file", payload.file);
  form.append("clientName", payload.clientName);
  form.append("clientEmail", payload.clientEmail);
  form.append("documentType", payload.documentType);
  if (payload.clientPhone) form.append("clientPhone", payload.clientPhone);
  if (payload.notes) form.append("notes", payload.notes);

  const { data, error } = await supabase.functions.invoke("upload-client-document", {
    body: form,
  });

  if (error) throw error;
  if ((data as { error?: string } | null)?.error) throw new Error((data as { error: string }).error);
  return data as { id: string; path: string };
}