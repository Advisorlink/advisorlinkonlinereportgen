import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Folder, ChevronRight, ArrowLeft, Loader2, Search, Check, HardDrive, FolderPlus, X } from "lucide-react";

type DriveFolder = { id: string; name: string };

// Default destination folder in Google Drive (My Drive › ...)
const DEFAULT_FOLDER_ID = "1ntFxL3PqQxM36x4BoS789yRbfZddLRm4";
const DEFAULT_FOLDER_NAME = "Default client folder";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  docIds: string[];
  fileCount: number;
  onSent?: () => void;
};

export function GoogleDriveFolderPicker({ open, onOpenChange, docIds, fileCount, onSent }: Props) {
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [stack, setStack] = useState<{ id: string | null; name: string }[]>([{ id: null, name: "My Drive" }]);
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const current = stack[stack.length - 1];

  const load = async (parent: string | null, q: string | null) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("gdrive-send", {
        body: { action: "list_folders", parent, q: q || null },
      });
      if (error) throw error;
      setFolders((data as any)?.folders ?? []);
    } catch (e: any) {
      toast.error("Couldn't load Google Drive folders", { description: e?.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setStack([{ id: null, name: "My Drive" }]);
    setSearch("");
    load(null, null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => load(current.id, search.trim() || null), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const enter = (f: DriveFolder) => {
    setStack((s) => [...s, { id: f.id, name: f.name }]);
    setSearch("");
    load(f.id, null);
  };

  const back = () => {
    if (stack.length <= 1) return;
    const next = stack.slice(0, -1);
    setStack(next);
    setSearch("");
    load(next[next.length - 1].id, null);
  };

  const createFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("gdrive-send", {
        body: { action: "create_folder", parent: current.id ?? "root", name },
      });
      if (error) throw error;
      const folder = (data as any)?.folder as DriveFolder | undefined;
      toast.success(`Created "${name}"`);
      setNewFolderOpen(false);
      setNewFolderName("");
      if (folder) {
        // Open the new folder so user can send straight into it
        setStack((s) => [...s, { id: folder.id, name: folder.name }]);
        setSearch("");
        load(folder.id, null);
      } else {
        load(current.id, search.trim() || null);
      }
    } catch (e: any) {
      toast.error("Couldn't create folder", { description: e?.message });
    } finally {
      setCreating(false);
    }
  };

  const sendToFolder = async (folderId: string, folderName: string) => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("gdrive-send", {
        body: { action: "send", folder_id: folderId, doc_ids: docIds },
      });
      if (error) throw error;
      const results = (data as any)?.results || [];
      const ok = results.filter((r: any) => r.ok).length;
      const fail = results.length - ok;
      if (ok > 0) toast.success(`Sent ${ok} file${ok > 1 ? "s" : ""} to ${folderName}`);
      if (fail > 0) toast.error(`${fail} file${fail > 1 ? "s" : ""} failed`);
      onOpenChange(false);
      onSent?.();
    } catch (e: any) {
      toast.error("Send failed", { description: e?.message });
    } finally {
      setSending(false);
    }
  };

  const sendHere = async () => {
    if (!current.id) {
      toast.error("Pick a folder", { description: "Open a folder first or create one in Google Drive." });
      return;
    }
    await sendToFolder(current.id, current.name);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-primary" /> Send to Google Drive
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Choose a folder for {fileCount} file{fileCount !== 1 ? "s" : ""}.
          </p>
        </DialogHeader>

        {/* Breadcrumb / back */}
        <div className="px-5 flex items-center gap-2 pb-2">
          <Button variant="ghost" size="sm" onClick={back} disabled={stack.length <= 1} className="gap-1.5">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <div className="text-sm font-medium truncate flex items-center gap-1.5">
            {stack.map((s, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
                <span className={i === stack.length - 1 ? "" : "text-muted-foreground"}>{s.name}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="px-5 pb-2 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search folders in this location"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setNewFolderOpen((v) => !v);
              setNewFolderName("");
            }}
            className="gap-1.5 shrink-0"
            title="Create new folder here"
          >
            <FolderPlus className="w-4 h-4" /> New folder
          </Button>
        </div>

        {newFolderOpen && (
          <div className="px-5 pb-2">
            <div className="flex gap-2 rounded-lg border bg-muted/40 p-2">
              <Input
                autoFocus
                placeholder={`New folder in "${current.name}" (e.g. client name)`}
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    await createFolder();
                  } else if (e.key === "Escape") {
                    setNewFolderOpen(false);
                  }
                }}
                className="h-9"
              />
              <Button size="sm" onClick={createFolder} disabled={creating || !newFolderName.trim()} className="gap-1.5">
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Create
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setNewFolderOpen(false)} className="px-2">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        <div className="px-2 pb-2 max-h-[50vh] overflow-y-auto">
          {loading ? (
            <div className="py-10 grid place-items-center text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : folders.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No folders here. Use "Send here" to drop files in this location, or open a subfolder.
            </div>
          ) : (
            <ul className="space-y-0.5">
              {folders.map((f) => (
                <li key={f.id}>
                  <button
                    onClick={() => enter(f)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted text-left transition-colors"
                  >
                    <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                    <span className="flex-1 truncate text-sm">{f.name}</span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/60" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter className="px-5 py-3 border-t bg-muted/30 sm:justify-between gap-2">
          <span className="text-xs text-muted-foreground self-center truncate">
            Sending to: <span className="font-medium text-foreground">{current.name}</span>
          </span>
          <Button onClick={sendHere} disabled={sending || !current.id} className="gap-2">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Send here
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
