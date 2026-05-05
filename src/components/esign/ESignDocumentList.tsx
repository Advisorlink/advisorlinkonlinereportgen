import { useState, useEffect } from "react";
import { ArrowLeft, Clock, CheckCircle, Send, Mail, Eye, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ESignDoc {
  id: string;
  document_name: string;
  status: string;
  client_name: string | null;
  client_email: string | null;
  signing_token: string;
  sent_at: string | null;
  signed_at: string | null;
  created_at: string;
  original_pdf_path: string | null;
  signed_pdf_path: string | null;
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  draft: { label: "Draft", color: "bg-muted text-muted-foreground", icon: Clock },
  sent: { label: "Awaiting Signature", color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20", icon: Send },
  signed: { label: "Signed", color: "bg-green-500/10 text-green-400 border-green-500/20", icon: CheckCircle },
  completed: { label: "Completed", color: "bg-cyan/10 text-cyan border-cyan/20", icon: CheckCircle },
};

export function ESignDocumentList({ onBack }: { onBack: () => void }) {
  const [docs, setDocs] = useState<ESignDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [resendDoc, setResendDoc] = useState<ESignDoc | null>(null);
  const [resendEmail, setResendEmail] = useState("");
  const [resending, setResending] = useState(false);

  useEffect(() => {
    loadDocs();
  }, []);

  const loadDocs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("esign_documents")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setDocs(data as ESignDoc[]);
    setLoading(false);
  };

  const handleResend = async () => {
    if (!resendDoc || !resendEmail.trim()) return;
    setResending(true);
    try {
      const signingUrl = `${window.location.origin}/esign/sign?token=${resendDoc.signing_token}`;
      await supabase.functions.invoke("send-esign-email", {
        body: {
          to: resendEmail,
          clientName: resendDoc.client_name || "Client",
          signingUrl,
          documentName: resendDoc.document_name,
        },
      });

      // Update resend email on record
      await supabase
        .from("esign_documents")
        .update({ resend_email: resendEmail, sent_at: new Date().toISOString() })
        .eq("id", resendDoc.id);

      toast.success(`Document resent to ${resendEmail}`);
      setResendDoc(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to resend");
    } finally {
      setResending(false);
    }
  };

  const handleDownloadSigned = async (doc: ESignDoc) => {
    if (!doc.signed_pdf_path) {
      toast.error("No signed document available yet");
      return;
    }
    const { data } = await supabase.storage
      .from("esign-documents")
      .createSignedUrl(doc.signed_pdf_path, 300);
    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to E-Sign Docs
      </button>

      <h2 className="text-xl font-bold mb-6">Review Documents</h2>

      {loading ? (
        <p className="text-center text-muted-foreground py-12">Loading...</p>
      ) : docs.length === 0 ? (
        <div className="text-center py-12">
          <Mail className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No documents sent yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {docs.map((doc) => {
            const st = statusConfig[doc.status] || statusConfig.draft;
            return (
              <div key={doc.id} className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-border/80 transition-all">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate">{doc.document_name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {doc.client_name} • {doc.client_email}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {doc.sent_at ? `Sent ${new Date(doc.sent_at).toLocaleDateString()}` : "Not sent"}
                    {doc.signed_at && ` • Signed ${new Date(doc.signed_at).toLocaleDateString()}`}
                  </p>
                </div>
                <Badge className={`${st.color} border`}>
                  <st.icon className="w-3 h-3 mr-1" />
                  {st.label}
                </Badge>
                <div className="flex gap-1">
                  {doc.status === "sent" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setResendDoc(doc);
                        setResendEmail(doc.client_email || "");
                      }}
                      className="gap-1"
                    >
                      <RotateCw className="w-3 h-3" /> Resend
                    </Button>
                  )}
                  {(doc.status === "signed" || doc.status === "completed") && (
                    <Button size="sm" variant="outline" onClick={() => handleDownloadSigned(doc)} className="gap-1">
                      <Eye className="w-3 h-3" /> View
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Resend Dialog */}
      <Dialog open={!!resendDoc} onOpenChange={(o) => !o && setResendDoc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resend Document</DialogTitle>
            <DialogDescription>
              Resend this document to a different email address with the same details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Document: <span className="font-semibold text-foreground">{resendDoc?.document_name}</span>
            </p>
            <Input
              placeholder="New email address"
              value={resendEmail}
              onChange={(e) => setResendEmail(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResendDoc(null)}>Cancel</Button>
            <Button onClick={handleResend} disabled={resending}>
              {resending ? "Sending..." : "Resend"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
