import { useEffect, useMemo, useState } from "react";
import { CRMLayout } from "@/components/CRMLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Eye, FileText, Image as ImageIcon, RefreshCw, Search, Send, Shield,
  Trash2, ChevronRight, ArrowLeft, Mail, Phone, Calendar, FileCheck2, X, HardDrive, Pencil, Check,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { SendUploadLinkDialog } from "@/components/documents/SendUploadLinkDialog";
import { GoogleDriveFolderPicker } from "@/components/documents/GoogleDriveFolderPicker";

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
  license: "Driver's Licence",
  super_statement: "Super Statement",
  statement: "Statement",
  screenshot: "Screenshot",
  other: "Other",
};

function formatBytes(bytes: number | null) {
  if (!bytes) return "—";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

const AVATAR_GRADIENTS = [
  "from-sky-500 to-indigo-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-fuchsia-500 to-pink-600",
  "from-violet-500 to-purple-600",
  "from-rose-500 to-red-600",
];
function gradientFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
}

type ClientGroup = {
  key: string;
  name: string;
  email: string;
  phone: string | null;
  items: ClientDocument[];
  latest: string;
};

export default function Documents() {
  const [docs, setDocs] = useState<ClientDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [openClient, setOpenClient] = useState<ClientGroup | null>(null);
  const [preview, setPreview] = useState<{ doc: ClientDocument; url: string } | null>(null);
  const [sendOpen, setSendOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("send") === "1";
  });
  const [drivePicker, setDrivePicker] = useState<{ docIds: string[] } | null>(null);

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

  const handleDelete = async (doc: ClientDocument) => {
    if (!confirm(`Delete ${doc.file_name}?`)) return;
    await supabase.storage.from("client-documents").remove([doc.file_path]);
    const { error } = await supabase.from("client_documents").delete().eq("id", doc.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Deleted");
    setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    setOpenClient((g) =>
      g ? { ...g, items: g.items.filter((d) => d.id !== doc.id) } : g
    );
  };

  const handleDeleteGroup = async (group: ClientGroup) => {
    const count = group.items.length;
    if (!confirm(
      `Delete the entire document package for ${group.name}?\n\nThis will permanently remove ${count} file${count > 1 ? "s" : ""}. This action cannot be undone.`
    )) return;
    const paths = group.items.map((d) => d.file_path);
    const ids = group.items.map((d) => d.id);
    await supabase.storage.from("client-documents").remove(paths);
    const { error } = await supabase.from("client_documents").delete().in("id", ids);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Deleted ${count} file${count > 1 ? "s" : ""} for ${group.name}`);
    setDocs((prev) => prev.filter((d) => !ids.includes(d.id)));
    setOpenClient(null);
  };

  const handleRename = async (doc: ClientDocument, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === doc.file_name) return;
    const { error } = await supabase
      .from("client_documents")
      .update({ file_name: trimmed })
      .eq("id", doc.id);
    if (error) {
      toast.error("Rename failed", { description: error.message });
      return;
    }
    toast.success("Renamed");
    setDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, file_name: trimmed } : d)));
    setOpenClient((g) =>
      g
        ? { ...g, items: g.items.map((d) => (d.id === doc.id ? { ...d, file_name: trimmed } : d)) }
        : g
    );
    setPreview((p) => (p && p.doc.id === doc.id ? { ...p, doc: { ...p.doc, file_name: trimmed } } : p));
  };

  const filteredDocs = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return docs;
    return docs.filter(
      (d) =>
        d.client_name.toLowerCase().includes(q) ||
        d.client_email.toLowerCase().includes(q) ||
        (d.client_phone || "").toLowerCase().includes(q) ||
        d.file_name.toLowerCase().includes(q)
    );
  }, [docs, search]);

  const groups: ClientGroup[] = useMemo(() => {
    const map = new Map<string, ClientGroup>();
    for (const d of filteredDocs) {
      const key = `${d.client_name}|${d.client_email}`;
      const existing = map.get(key);
      if (existing) {
        existing.items.push(d);
        if (d.created_at > existing.latest) existing.latest = d.created_at;
      } else {
        map.set(key, {
          key,
          name: d.client_name,
          email: d.client_email,
          phone: d.client_phone,
          items: [d],
          latest: d.created_at,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => (a.latest < b.latest ? 1 : -1));
  }, [filteredDocs]);

  // Keep open client in sync after refresh/delete
  useEffect(() => {
    if (!openClient) return;
    const fresh = groups.find((g) => g.key === openClient.key);
    if (fresh) setOpenClient(fresh);
    else setOpenClient(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docs]);

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
          <div className="flex gap-2">
            <Button onClick={() => setSendOpen(true)} size="sm" className="gap-2">
              <Send className="w-4 h-4" /> Send upload link
            </Button>
            <Button onClick={load} variant="outline" size="sm" className="gap-2">
              <RefreshCw className="w-4 h-4" /> Refresh
            </Button>
          </div>
        </div>
        <SendUploadLinkDialog open={sendOpen} onOpenChange={setSendOpen} />

        {/* Stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile icon={Shield} label="Clients" value={groups.length} />
          <StatTile icon={FileCheck2} label="Documents" value={filteredDocs.length} />
          <StatTile
            icon={ImageIcon}
            label="Images"
            value={filteredDocs.filter((d) => d.mime_type?.startsWith("image/")).length}
          />
          <StatTile
            icon={FileText}
            label="PDFs"
            value={filteredDocs.filter((d) => d.mime_type === "application/pdf").length}
          />
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
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-5 h-36 bg-muted/40" />
              </Card>
            ))}
          </div>
        ) : groups.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
              No documents submitted yet. Share{" "}
              <code className="text-foreground bg-muted px-1.5 py-0.5 rounded">/upload</code>{" "}
              with your clients.
            </CardContent>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map((g) => (
              <ClientCard
                key={g.key}
                group={g}
                onOpen={() => setOpenClient(g)}
                onDelete={() => handleDeleteGroup(g)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ===== Client detail dialog ===== */}
      <Dialog open={!!openClient} onOpenChange={(o) => !o && setOpenClient(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          {openClient && (
            <>
              <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-6 pt-6 pb-5 border-b">
                <DialogHeader className="space-y-0">
                  <div className="flex items-center gap-4">
                    <div
                      className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${gradientFor(openClient.key)} text-white grid place-items-center font-semibold text-lg shadow-md`}
                    >
                      {initialsOf(openClient.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <DialogTitle className="text-xl truncate">{openClient.name}</DialogTitle>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5" /> {openClient.email}
                        </span>
                        {openClient.phone && (
                          <span className="inline-flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5" /> {openClient.phone}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDistanceToNow(new Date(openClient.latest), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                    <Badge variant="secondary">
                      {openClient.items.length} file{openClient.items.length > 1 ? "s" : ""}
                    </Badge>
                  </div>
                </DialogHeader>
              </div>

              <div className="px-5 pt-4 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    setDrivePicker({ docIds: openClient.items.map((i) => i.id) })
                  }
                  className="gap-2"
                >
                  <HardDrive className="w-4 h-4" />
                  Send all to Google Drive
                </Button>
                <div className="flex-1" />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDeleteGroup(openClient)}
                  className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete entire package
                </Button>
              </div>

              <div className="p-5 max-h-[60vh] overflow-y-auto">
                <div className="grid sm:grid-cols-2 gap-3">
                  {openClient.items.map((d) => (
                    <FileTile
                      key={d.id}
                      doc={d}
                      onPreview={() => handlePreview(d)}
                      onDelete={() => handleDelete(d)}
                      onSendToDrive={() => setDrivePicker({ docIds: [d.id] })}
                      onRename={(name) => handleRename(d, name)}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== File preview dialog ===== */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-5xl p-0 overflow-hidden">
          {preview && (
            <>
              <div className="flex items-center justify-between gap-3 border-b px-5 py-3">
                <div className="min-w-0">
                  <DialogTitle className="truncate text-base">{preview.doc.file_name}</DialogTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {docTypeLabels[preview.doc.document_type] || preview.doc.document_type} •{" "}
                    {formatBytes(preview.doc.file_size)} •{" "}
                    {format(new Date(preview.doc.created_at), "dd MMM yyyy, h:mma")}
                  </p>
                </div>
              </div>
              <div className="bg-muted/40 max-h-[80vh] overflow-auto flex items-center justify-center">
                {preview.doc.mime_type?.startsWith("image/") ? (
                  <img
                    src={preview.url}
                    alt={preview.doc.file_name}
                    className="max-w-full max-h-[80vh] object-contain"
                  />
                ) : preview.doc.mime_type === "application/pdf" ? (
                  <iframe
                    src={preview.url}
                    title={preview.doc.file_name}
                    className="w-full h-[80vh] bg-white"
                  />
                ) : (
                  <div className="p-12 text-center text-sm text-muted-foreground">
                    Preview not available for this file type.
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <GoogleDriveFolderPicker
        open={!!drivePicker}
        onOpenChange={(o) => !o && setDrivePicker(null)}
        docIds={drivePicker?.docIds ?? []}
        fileCount={drivePicker?.docIds.length ?? 0}
      />
    </CRMLayout>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Shield;
  label: string;
  value: number;
}) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="text-xl font-semibold leading-tight">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function ClientCard({
  group,
  onOpen,
  onDelete,
}: {
  group: ClientGroup;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const types = Array.from(new Set(group.items.map((i) => i.document_type)));
  return (
    <div
      className="group relative rounded-2xl border bg-card hover:border-primary/40 hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 overflow-hidden"
    >
      <button onClick={onOpen} className="block w-full text-left">
        <div className="p-5">
          <div className="flex items-start gap-3">
            <div
              className={`h-12 w-12 rounded-xl bg-gradient-to-br ${gradientFor(group.key)} text-white grid place-items-center font-semibold shadow-sm shrink-0`}
            >
              {initialsOf(group.name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold truncate">{group.name}</div>
              <div className="text-xs text-muted-foreground truncate mt-0.5">{group.email}</div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground/60 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </div>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {types.slice(0, 3).map((t) => (
              <Badge key={t} variant="outline" className="text-[10px] font-medium">
                {docTypeLabels[t] || t}
              </Badge>
            ))}
            {types.length > 3 && (
              <Badge variant="outline" className="text-[10px]">+{types.length - 3}</Badge>
            )}
          </div>
        </div>
        <div className="border-t bg-muted/30 px-5 py-2.5 flex items-center justify-between text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <FileCheck2 className="w-3.5 h-3.5" />
            {group.items.length} document{group.items.length > 1 ? "s" : ""}
          </span>
          <span>{formatDistanceToNow(new Date(group.latest), { addSuffix: true })}</span>
        </div>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute top-3 right-3 h-7 w-7 rounded-full bg-background/80 backdrop-blur border border-border/60 text-muted-foreground grid place-items-center opacity-0 group-hover:opacity-100 hover:text-destructive hover:border-destructive/40 hover:bg-destructive/10 transition-all"
        title="Delete entire package"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function FileTile({
  doc,
  onPreview,
  onDelete,
  onSendToDrive,
  onRename,
}: {
  doc: ClientDocument;
  onPreview: () => void;
  onDelete: () => void;
  onSendToDrive?: () => void;
  onRename?: (name: string) => void;
}) {
  const isImage = doc.mime_type?.startsWith("image/");
  const isPdf = doc.mime_type === "application/pdf";
  const [thumb, setThumb] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(doc.file_name);

  useEffect(() => {
    let cancelled = false;
    if (!isImage) return;
    supabase.storage
      .from("client-documents")
      .createSignedUrl(doc.file_path, 60 * 10)
      .then(({ data }) => {
        if (!cancelled && data?.signedUrl) setThumb(data.signedUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [doc.file_path, isImage]);

  useEffect(() => {
    if (!editing) setDraft(doc.file_name);
  }, [doc.file_name, editing]);

  const saveRename = () => {
    if (onRename) onRename(draft);
    setEditing(false);
  };

  return (
    <div className="group relative rounded-xl border bg-card overflow-hidden hover:border-primary/40 hover:shadow-md transition-all">
      <button
        onClick={onPreview}
        className="block w-full text-left"
      >
        <div className="aspect-[4/3] bg-muted relative overflow-hidden">
          {isImage && thumb ? (
            <img
              src={thumb}
              alt={doc.file_name}
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : isPdf ? (
            <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-rose-500/10 to-rose-500/5">
              <FileText className="w-10 h-10 text-rose-500/70" />
            </div>
          ) : (
            <div className="absolute inset-0 grid place-items-center">
              <FileText className="w-10 h-10 text-muted-foreground/50" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
            <Badge className="bg-white/90 text-foreground hover:bg-white text-[10px] gap-1">
              <Eye className="w-3 h-3" /> View
            </Badge>
          </div>
        </div>
      </button>
      <div className="p-3">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline" className="text-[10px]">
            {docTypeLabels[doc.document_type] || doc.document_type}
          </Badge>
        </div>
        {editing ? (
          <div className="flex items-center gap-1.5">
            <Input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  saveRename();
                } else if (e.key === "Escape") {
                  setDraft(doc.file_name);
                  setEditing(false);
                }
              }}
              className="h-8 text-sm"
            />
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={saveRename} title="Save">
              <Check className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={() => {
                setDraft(doc.file_name);
                setEditing(false);
              }}
              title="Cancel"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 group/name">
            <div className="text-sm font-medium truncate flex-1" title={doc.file_name}>
              {doc.file_name}
            </div>
            {onRename && (
              <button
                onClick={() => setEditing(true)}
                className="opacity-0 group-hover/name:opacity-100 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity shrink-0"
                title="Rename"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
        <div className="text-xs text-muted-foreground mt-0.5">
          {formatBytes(doc.file_size)} • {format(new Date(doc.created_at), "dd MMM, h:mma")}
        </div>
      </div>
      <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {onSendToDrive && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSendToDrive();
            }}
            className="h-7 w-7 rounded-full bg-black/50 text-white grid place-items-center hover:bg-primary transition-all"
            title="Send to Google Drive"
          >
            <HardDrive className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="h-7 w-7 rounded-full bg-black/50 text-white grid place-items-center hover:bg-destructive transition-all"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
