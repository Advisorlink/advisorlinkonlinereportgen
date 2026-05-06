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

  return (
    <CRMLayout>
      <div className="p-6 max-w-[1400px] mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Dialer</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Automated AI-powered phone calls with real Australian voices
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-muted/50 p-1 h-auto flex-wrap">
            <TabsTrigger value="dashboard" className="gap-2 data-[state=active]:bg-background">
              <BarChart3 className="w-4 h-4" /> Dashboard
            </TabsTrigger>
            <TabsTrigger value="scripts" className="gap-2 data-[state=active]:bg-background">
              <FileText className="w-4 h-4" /> Scripts
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="gap-2 data-[state=active]:bg-background">
              <Phone className="w-4 h-4" /> Campaigns
            </TabsTrigger>
            <TabsTrigger value="leads" className="gap-2 data-[state=active]:bg-background">
              <Users className="w-4 h-4" /> Leads
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-2 data-[state=active]:bg-background">
              <ScrollText className="w-4 h-4" /> Call Logs
            </TabsTrigger>
            <TabsTrigger value="numbers" className="gap-2 data-[state=active]:bg-background">
              <PhoneCall className="w-4 h-4" /> Phone Numbers
            </TabsTrigger>
            <TabsTrigger value="voices" className="gap-2 data-[state=active]:bg-background">
              <Mic className="w-4 h-4" /> Voices
            </TabsTrigger>
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
