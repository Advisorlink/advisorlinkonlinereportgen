import { useState } from "react";
import { CRMLayout } from "@/components/CRMLayout";
import { FileSignature, Eye, FilePlus, PenTool, LayoutTemplate } from "lucide-react";
import { ESignNewRequest } from "@/components/esign/ESignNewRequest";
import { ESignDocumentList } from "@/components/esign/ESignDocumentList";

const menuItems = [
  { id: "esign", label: "E-Sign", icon: PenTool, description: "Send a document for electronic signature" },
  { id: "review", label: "Review Docs", icon: Eye, description: "Review sent & signed documents" },
  { id: "templates", label: "Create Template", icon: LayoutTemplate, description: "Create reusable document templates" },
];

export default function ESign() {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  if (activeSection === "esign") {
    return (
      <CRMLayout>
        <ESignNewRequest onBack={() => setActiveSection(null)} />
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

  return (
    <CRMLayout>
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 rounded-xl bg-cyan/10">
            <FileSignature className="w-7 h-7 text-cyan" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">E-Sign Docs</h1>
            <p className="text-sm text-muted-foreground">Send, sign, and manage documents electronically</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              disabled={item.id === "templates"}
              className="group relative flex flex-col items-center gap-3 p-8 rounded-2xl border border-border bg-card hover:border-cyan/40 hover:shadow-lg hover:shadow-cyan/5 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <div className="p-4 rounded-xl bg-cyan/10 group-hover:bg-cyan/20 transition-colors">
                <item.icon className="w-8 h-8 text-cyan" />
              </div>
              <span className="text-lg font-semibold text-foreground">{item.label}</span>
              <span className="text-xs text-muted-foreground text-center">{item.description}</span>
              {item.id === "templates" && (
                <span className="absolute top-3 right-3 text-[10px] font-semibold bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                  Coming Soon
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </CRMLayout>
  );
}
