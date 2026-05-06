import { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  LayoutTemplate,
  FileText,
  Trash2,
  Clock,
  CloudUpload,
  MoreVertical,
  Pencil,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Template {
  id: string;
  name: string;
  description: string | null;
  pdf_path: string;
  fields: any[];
  created_at: string;
  updated_at: string;
}

interface Props {
  onBack: () => void;
  onSelectTemplate: (templateFile: File, templateName: string, fields: any[]) => void;
}

export function ESignTemplates({ onBack, onSelectTemplate }: Props) {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Create dialog
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newFile, setNewFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Edit dialog
  const [editTemplate, setEditTemplate] = useState<Template | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // Delete confirm
  const [deleteTemplate, setDeleteTemplate] = useState<Template | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Selecting
  const [selecting, setSelecting] = useState<string | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("esign_templates")
      .select("*")
      .order("updated_at", { ascending: false });
    if (data) setTemplates(data as unknown as Template[]);
    setLoading(false);
  };

  const filtered = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(search.toLowerCase()))
  );

  const handleCreate = async () => {
    if (!newName.trim() || !newFile || !user) return;
    setCreating(true);
    try {
      const filePath = `templates/${user.id}/${Date.now()}_${newFile.name}`;
      const { error: upErr } = await supabase.storage
        .from("esign-documents")
        .upload(filePath, newFile);
      if (upErr) throw upErr;

      const { error: dbErr } = await supabase.from("esign_templates").insert({
        user_id: user.id,
        name: newName.trim(),
        description: newDesc.trim() || null,
        pdf_path: filePath,
        fields: [],
      } as any);
      if (dbErr) throw dbErr;

      toast.success("Template created!");
      setShowCreate(false);
      setNewName("");
      setNewDesc("");
      setNewFile(null);
      loadTemplates();
    } catch (err: any) {
      toast.error(err.message || "Failed to create template");
    } finally {
      setCreating(false);
    }
  };

  const handleEdit = async () => {
    if (!editTemplate || !editName.trim()) return;
    const { error } = await supabase
      .from("esign_templates")
      .update({ name: editName.trim(), description: editDesc.trim() || null } as any)
      .eq("id", editTemplate.id);
    if (error) {
      toast.error("Failed to update");
    } else {
      toast.success("Template updated");
      setEditTemplate(null);
      loadTemplates();
    }
  };

  const handleDelete = async () => {
    if (!deleteTemplate) return;
    setDeleting(true);
    try {
      await supabase.storage.from("esign-documents").remove([deleteTemplate.pdf_path]);
      const { error } = await supabase
        .from("esign_templates")
        .delete()
        .eq("id", deleteTemplate.id);
      if (error) throw error;
      toast.success("Template deleted");
      setDeleteTemplate(null);
      loadTemplates();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  const handleSelect = async (template: Template) => {
    setSelecting(template.id);
    try {
      const { data, error } = await supabase.storage
        .from("esign-documents")
        .download(template.pdf_path);
      if (error || !data) throw error || new Error("Download failed");
      const file = new File([data], `${template.name}.pdf`, { type: "application/pdf" });
      onSelectTemplate(file, template.name, template.fields || []);
    } catch (err: any) {
      toast.error("Failed to load template PDF");
    } finally {
      setSelecting(null);
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f && f.type === "application/pdf") {
      setNewFile(f);
    } else {
      toast.error("Please upload a PDF file");
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Back */}
      <button
        onClick={onBack}
        className="group flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-all"
      >
        <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
        Back to E-Sign Centre
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan/10 ring-1 ring-cyan/20">
              <LayoutTemplate className="h-5 w-5 text-cyan" />
            </div>
            Templates
          </h1>
          <p className="text-sm text-muted-foreground mt-2 ml-[52px]">
            Save your commonly-used documents as templates for quick access
          </p>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          className="gap-2 rounded-xl bg-cyan hover:bg-cyan/90 text-white shadow-lg shadow-cyan/20 h-11 px-5"
        >
          <Plus className="w-4 h-4" /> New Template
        </Button>
      </div>

      {/* Search */}
      {templates.length > 0 && (
        <div className="relative mb-6">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11 rounded-xl"
          />
        </div>
      )}

      {/* Template Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 border-2 border-cyan border-t-transparent rounded-full animate-spin" />
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted/60 mb-4">
            <LayoutTemplate className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">No templates yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm mb-6">
            Create your first template by uploading a PDF — like a Pure ATC or TPA form — for quick reuse.
          </p>
          <Button
            onClick={() => setShowCreate(true)}
            className="gap-2 rounded-xl bg-cyan hover:bg-cyan/90 text-white h-11 px-6"
          >
            <Plus className="w-4 h-4" /> Create Template
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((t) => (
            <div
              key={t.id}
              className="group relative flex flex-col rounded-2xl border border-border bg-card hover:border-cyan/40 hover:shadow-xl hover:shadow-cyan/5 transition-all duration-300"
            >
              {/* Card top accent */}
              <div className="h-1.5 rounded-t-2xl bg-gradient-to-r from-cyan/60 to-cyan/20" />

              <div className="flex-1 p-5 flex flex-col">
                {/* Icon + menu */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan/10 group-hover:bg-cyan/15 transition-colors">
                    <FileText className="w-5 h-5 text-cyan" />
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-xl">
                      <DropdownMenuItem
                        onClick={() => {
                          setEditTemplate(t);
                          setEditName(t.name);
                          setEditDesc(t.description || "");
                        }}
                        className="gap-2"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setDeleteTemplate(t)}
                        className="gap-2 text-destructive focus:text-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Name & description */}
                <h3 className="font-semibold text-foreground mb-1 truncate">{t.name}</h3>
                {t.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                    {t.description}
                  </p>
                )}

                <div className="mt-auto pt-3 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Clock className="w-3 h-3" /> {formatDate(t.updated_at)}
                  </span>
                  <Button
                    size="sm"
                    onClick={() => handleSelect(t)}
                    disabled={selecting === t.id}
                    className="gap-1.5 rounded-lg bg-cyan hover:bg-cyan/90 text-white text-xs h-8 px-3 shadow-md shadow-cyan/15"
                  >
                    {selecting === t.id ? (
                      "Loading..."
                    ) : (
                      <>
                        Use <ArrowRight className="w-3 h-3" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Template Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Template</DialogTitle>
            <DialogDescription>
              Upload a PDF and give it a name for quick reuse.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Template Name *</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Pure ATC / TPA"
                className="rounded-xl h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Description</Label>
              <Input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Brief description (optional)"
                className="rounded-xl h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">PDF Document *</Label>
              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleFileDrop}
                className={`flex flex-col items-center gap-3 p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                  isDragging
                    ? "border-cyan bg-cyan/10"
                    : newFile
                    ? "border-cyan/40 bg-cyan/5"
                    : "border-border hover:border-cyan/40 hover:bg-cyan/5"
                }`}
              >
                {newFile ? (
                  <>
                    <FileText className="w-6 h-6 text-cyan" />
                    <span className="text-sm font-medium text-foreground truncate max-w-full">
                      {newFile.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      Click or drag to replace
                    </span>
                  </>
                ) : (
                  <>
                    <CloudUpload className="w-6 h-6 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Drop PDF here or <span className="text-cyan font-medium">browse</span>
                    </span>
                  </>
                )}
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f && f.type === "application/pdf") setNewFile(f);
                    else if (f) toast.error("Please upload a PDF");
                  }}
                />
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !newName.trim() || !newFile}
              className="rounded-xl bg-cyan hover:bg-cyan/90 text-white"
            >
              {creating ? "Creating..." : "Create Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editTemplate} onOpenChange={(o) => !o && setEditTemplate(null)}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
            <DialogDescription>Update template name and description.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Name *</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="rounded-xl h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Description</Label>
              <Input
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="rounded-xl h-11"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTemplate(null)} className="rounded-xl">
              Cancel
            </Button>
            <Button
              onClick={handleEdit}
              disabled={!editName.trim()}
              className="rounded-xl bg-cyan hover:bg-cyan/90 text-white"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteTemplate} onOpenChange={(o) => !o && setDeleteTemplate(null)}>
        <DialogContent className="rounded-2xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteTemplate?.name}"? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTemplate(null)} className="rounded-xl">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-xl"
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
