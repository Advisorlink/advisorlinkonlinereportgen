import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CRMLayout } from "@/components/CRMLayout";
import { ESignTemplates } from "@/components/esign/ESignTemplates";
import {
  FileSignature,
  Eye,
  PenTool,
  LayoutTemplate,
  Clock,
  Shield,
  Send,
  FolderOpen,
  ArrowRight,
  FileText,
} from "lucide-react";
import { ESignNewRequest } from "@/components/esign/ESignNewRequest";
import { ESignDocumentList } from "@/components/esign/ESignDocumentList";
import { LetterheadGenerator } from "@/components/esign/LetterheadGenerator";

const menuItems = [
  {
    id: "esign",
    label: "New E-Sign",
    icon: Send,
    description: "Upload & prepare a document for electronic signature",
    gradient: "from-cyan/20 to-cyan/5",
    iconColor: "text-cyan",
    available: true,
  },
  {
    id: "review",
    label: "Review Docs",
    icon: Eye,
    description: "Track and review all sent & signed documents",
    gradient: "from-primary/20 to-primary/5",
    iconColor: "text-primary",
    available: true,
  },
  {
    id: "templates",
    label: "Templates",
    icon: LayoutTemplate,
    description: "Create reusable templates to speed up your workflow",
    gradient: "from-cyan/20 to-cyan/5",
    iconColor: "text-cyan",
    available: true,
  },
  {
    id: "letterhead",
    label: "Letterhead",
    icon: FileText,
    description: "Type a letter on your branded letterhead and download as a signed PDF",
    gradient: "from-primary/20 to-primary/5",
    iconColor: "text-primary",
    available: true,
  },
  {
    id: "archive",
    label: "Archive",
    icon: FolderOpen,
    description: "Access completed and archived document history",
    gradient: "from-muted-foreground/10 to-muted/10",
    iconColor: "text-muted-foreground",
    available: false,
  },
];

const stats = [
  { label: "Avg. Signing Time", value: "< 2 min", icon: Clock },
  { label: "Secure & Encrypted", value: "256-bit SSL", icon: Shield },
  { label: "Documents Ready", value: "Instant", icon: FileSignature },
];

export default function ESign() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [prefillClient, setPrefillClient] = useState<{ name?: string; email?: string; phone?: string } | null>(null);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setPrefillClient({
        name: searchParams.get("name") || "",
        email: searchParams.get("email") || "",
        phone: searchParams.get("phone") || "",
      });
      setActiveSection("esign");
      // Clear params so refresh/back doesn't re-trigger
      const next = new URLSearchParams(searchParams);
      ["new", "name", "email", "phone", "advisor"].forEach(k => next.delete(k));
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  if (activeSection === "esign") {
    return (
      <CRMLayout>
        <ESignNewRequest
          onBack={() => { setActiveSection(null); setTemplateFile(null); setTemplateName(""); setPrefillClient(null); }}
          initialFile={templateFile}
          initialFileName={templateName}
          prefillClient={prefillClient}
        />
      </CRMLayout>
    );
  }

  if (activeSection === "review") {
    return (
      <CRMLayout>
        <ESignDocumentList onBack={() => setActiveSection(null)} />
      </CRMLayout>
    );
  }

  if (activeSection === "templates") {
    return (
      <CRMLayout>
        <ESignTemplates
          onBack={() => setActiveSection(null)}
          onSelectTemplate={(file, name) => {
            setTemplateFile(file);
            setTemplateName(name);
            setActiveSection("esign");
          }}
        />
      </CRMLayout>
    );
  }

  return (
    <CRMLayout>
      <div className="max-w-5xl mx-auto py-10 px-4 space-y-10">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card to-cyan/5 p-8">
          <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-cyan/5 blur-3xl" />
          <div className="relative flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-cyan/10 ring-1 ring-cyan/20">
              <FileSignature className="h-7 w-7 text-cyan" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                E-Sign Centre
              </h1>
              <p className="mt-1 text-muted-foreground max-w-lg">
                Send, sign, and manage documents electronically - fast, secure, and paperless.
              </p>
            </div>
          </div>

          {/* Quick stats */}
          <div className="relative mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/60 backdrop-blur-sm px-4 py-3"
              >
                <stat.icon className="h-5 w-5 text-cyan/70" />
                <div>
                  <p className="text-sm font-semibold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => item.available && setActiveSection(item.id)}
              disabled={!item.available}
              className={`group relative flex flex-col items-start gap-4 p-6 rounded-2xl border transition-all duration-300 text-left ${
                item.available
                  ? "border-border bg-card hover:border-cyan/50 hover:shadow-xl hover:shadow-cyan/5 hover:-translate-y-0.5"
                  : "border-border/50 bg-card/60 opacity-50 cursor-not-allowed"
              }`}
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${item.gradient} transition-transform group-hover:scale-110`}>
                <item.icon className={`h-6 w-6 ${item.iconColor}`} />
              </div>

              <div>
                <span className="text-base font-semibold text-foreground block">
                  {item.label}
                </span>
                <span className="mt-1 text-xs text-muted-foreground leading-relaxed block">
                  {item.description}
                </span>
              </div>

              {item.available ? (
                <div className="flex items-center gap-1 text-xs font-medium text-cyan opacity-0 group-hover:opacity-100 transition-opacity">
                  Open <ArrowRight className="h-3 w-3" />
                </div>
              ) : (
                <span className="text-[10px] font-semibold bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                  Coming Soon
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Bottom tip */}
        <div className="text-center text-xs text-muted-foreground/60">
          <PenTool className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
          All signatures are legally binding and stored securely.
        </div>
      </div>
    </CRMLayout>
  );
}
