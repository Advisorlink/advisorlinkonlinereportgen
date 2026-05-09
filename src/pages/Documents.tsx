import { useEffect, useState } from "react";
import { CRMLayout } from "@/components/CRMLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Download, Eye, FileText, Image as ImageIcon, RefreshCw, Search, Send, Shield, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { SendUploadLinkDialog } from "@/components/documents/SendUploadLinkDialog";

type ClientDocument = {
  id: string;
  client_name: string;
  client_email: string;
  client_phone: string | null;
  document_type: string;
  file_path: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  status: string;
  consent_given: boolean;
  notes: string | null;
  created_at: string;
};

const docTypeLabels: Record<string, string> = {
  id_front: "ID — Front",
  id_back: "ID — Back",
  super_statement: "Super Statement",
  other: "Other",
};

function formatBytes(bytes: number | null) {
  if (!bytes) return "—";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

export default function Documents() {
  const [docs, setDocs] = useState<ClientDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<{ doc: ClientDocument; url: string } | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("client_documents")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setDocs((data as ClientDocument[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const getSignedUrl = async (path: string) => {
    const { data, error } = await supabase.storage
      .from("client-documents")
      .createSignedUrl(path, 60 * 10);
    if (error || !data) {
      toast.error("Could not load file");
      return null;
    }
    return data.signedUrl;
  };

  const handlePreview = async (doc: ClientDocument) => {
    const url = await getSignedUrl(doc.file_path);
    if (url) setPreview({ doc, url });
  };

  const handleDownload = async (doc: ClientDocument) => {
    const url = await getSignedUrl(doc.file_path);
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.file_name;
    a.click();
  };

  const handleDelete = async (doc: ClientDocument) => {
    if (!confirm(`Delete ${doc.file_name}?`)) return;
    await supabase.storage.from("client-documents").remove([doc.file_path]);
    const { error } = await supabase.from("client_documents").delete().eq("id", doc.id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); load(); }
  };

  const filtered = docs.filter((d) => {
    const q = search.toLowerCase();
    return (
      d.client_name.toLowerCase().includes(q) ||
      d.client_email.toLowerCase().includes(q) ||
      (d.client_phone || "").toLowerCase().includes(q) ||
      d.file_name.toLowerCase().includes(q)
    );
  });

  // Group by client (name+email)
  const grouped = filtered.reduce<Record<string, ClientDocument[]>>((acc, d) => {
    const key = `${d.client_name}|${d.client_email}`;
    (acc[key] ||= []).push(d);
    return acc;
  }, {});

  return (
    <CRMLayout>
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              <Shield className="w-7 h-7 text-primary" />
              Client Documents
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Securely uploaded identification and financial documents.
            </p>
          </div>
          <Button onClick={load} variant="outline" size="sm" className="gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, phone, file..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {loading ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">Loading...</CardContent></Card>
        ) : Object.keys(grouped).length === 0 ? (
          <Card><CardContent className="p-12 text-center text-muted-foreground">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
            No documents submitted yet. Share <code className="text-foreground bg-muted px-1.5 py-0.5 rounded">/upload</code> with your clients.
          </CardContent></Card>
        ) : (
          Object.entries(grouped).map(([key, items]) => {
            const [name, email] = key.split("|");
            return (
              <Card key={key}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span>{name}</span>
                    <span className="text-sm font-normal text-muted-foreground">{email}</span>
                    <Badge variant="secondary" className="ml-auto">{items.length} file{items.length > 1 ? "s" : ""}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>File</TableHead>
                          <TableHead className="hidden sm:table-cell">Size</TableHead>
                          <TableHead className="hidden md:table-cell">Uploaded</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((d) => (
                          <TableRow key={d.id}>
                            <TableCell>
                              <Badge variant="outline">{docTypeLabels[d.document_type] || d.document_type}</Badge>
                            </TableCell>
                            <TableCell className="max-w-[200px]">
                              <div className="flex items-center gap-2 truncate">
                                {d.mime_type?.startsWith("image/") ? (
                                  <ImageIcon className="w-4 h-4 shrink-0 text-muted-foreground" />
                                ) : (
                                  <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
                                )}
                                <span className="truncate text-sm">{d.file_name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{formatBytes(d.file_size)}</TableCell>
                            <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                              {format(new Date(d.created_at), "dd MMM yyyy, h:mma")}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button size="icon" variant="ghost" onClick={() => handlePreview(d)} title="Preview">
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button size="icon" variant="ghost" onClick={() => handleDownload(d)} title="Download">
                                  <Download className="w-4 h-4" />
                                </Button>
                                <Button size="icon" variant="ghost" onClick={() => handleDelete(d)} title="Delete" className="text-destructive hover:text-destructive">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="truncate">{preview?.doc.file_name}</DialogTitle>
          </DialogHeader>
          {preview && (
            <div className="w-full max-h-[75vh] overflow-auto rounded-lg bg-muted">
              {preview.doc.mime_type?.startsWith("image/") ? (
                <img src={preview.url} alt={preview.doc.file_name} className="w-full h-auto" />
              ) : preview.doc.mime_type === "application/pdf" ? (
                <iframe src={preview.url} title={preview.doc.file_name} className="w-full h-[75vh]" />
              ) : (
                <div className="p-8 text-center">
                  <p className="text-sm text-muted-foreground mb-4">Preview not available for this file type.</p>
                  <Button onClick={() => preview && handleDownload(preview.doc)} className="gap-2">
                    <Download className="w-4 h-4" /> Download
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </CRMLayout>
  );
}
