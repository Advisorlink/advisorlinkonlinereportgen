import { useState } from "react";
import { CRMLayout } from "@/components/CRMLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, FileText, Users, BarChart3, ScrollText, PhoneCall, Mic } from "lucide-react";
import { AICallerDashboard } from "@/components/ai-caller/AICallerDashboard";
import { AICallerScripts } from "@/components/ai-caller/AICallerScripts";
import { AICallerCampaigns } from "@/components/ai-caller/AICallerCampaigns";
import { AICallerLeads } from "@/components/ai-caller/AICallerLeads";
import { AICallerCallLogs } from "@/components/ai-caller/AICallerCallLogs";
import { AICallerPhoneNumbers } from "@/components/ai-caller/AICallerPhoneNumbers";
import { AICallerVoices } from "@/components/ai-caller/AICallerVoices";

export default function AICaller() {
  const [activeTab, setActiveTab] = useState("dashboard");

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "scripts", label: "Scripts", icon: FileText },
    { id: "campaigns", label: "Campaigns", icon: Phone },
    { id: "leads", label: "Leads", icon: Users },
    { id: "logs", label: "Call Logs", icon: ScrollText },
    { id: "numbers", label: "Numbers", icon: PhoneCall },
    { id: "voices", label: "Voices", icon: Mic },
  ];

  return (
    <CRMLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
        {/* Hero header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-accent/30 p-6 sm:p-8">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3QgZmlsbD0idXJsKCNnKSIgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIvPjwvc3ZnPg==')] opacity-60" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
                <Phone className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-heading">AI Dialer</h1>
                <p className="text-sm text-white/70">Automated AI-powered calling with real Australian voices</p>
              </div>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-card border border-border p-1.5 h-auto flex flex-wrap gap-1 rounded-xl shadow-sm">
            {tabs.map(tab => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md"
              >
                <tab.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="dashboard"><AICallerDashboard onNavigate={setActiveTab} /></TabsContent>
          <TabsContent value="scripts"><AICallerScripts /></TabsContent>
          <TabsContent value="campaigns"><AICallerCampaigns /></TabsContent>
          <TabsContent value="leads"><AICallerLeads /></TabsContent>
          <TabsContent value="logs"><AICallerCallLogs /></TabsContent>
          <TabsContent value="numbers"><AICallerPhoneNumbers /></TabsContent>
          <TabsContent value="voices"><AICallerVoices /></TabsContent>
        </Tabs>
      </div>
    </CRMLayout>
  );
}
