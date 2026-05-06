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
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-navy via-navy to-cyan/20 p-6 sm:p-8 border border-cyan/10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(195_95%_50%/0.08),transparent_60%)]" />
          <div className="absolute top-4 right-6 opacity-[0.04]">
            <span className="text-[120px] font-black tracking-tighter text-white select-none">LEAP</span>
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-1">
              <div className="w-12 h-12 rounded-xl bg-cyan/15 backdrop-blur-sm flex items-center justify-center border border-cyan/20">
                <Phone className="w-5 h-5 text-cyan" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight font-heading">L.E.A.P</h1>
                  <span className="px-2.5 py-0.5 rounded-md bg-cyan/15 text-cyan text-[10px] font-bold tracking-widest uppercase border border-cyan/20">Beta</span>
                </div>
                <p className="text-sm text-white/50 mt-0.5">Lead Engagement Automation Platform</p>
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
