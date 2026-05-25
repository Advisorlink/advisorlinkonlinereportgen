import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ClientInputsProvider } from "@/hooks/useClientInputs";
import { MeetingHostProvider } from "@/hooks/useMeetingHost";
import { SoftphoneProvider } from "@/hooks/useSoftphone";
import { SoftphoneDock } from "@/components/softphone/SoftphoneDock";
import { ProtectedApp } from "@/components/ProtectedApp";
import AICaller from "./pages/AICaller.tsx";
import Phone from "./pages/Phone.tsx";
import FactFind from "./pages/FactFind.tsx";
import Auth from "./pages/Auth.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Pipeline from "./pages/Pipeline.tsx";
import Presentations from "./pages/Presentations.tsx";
import Index from "./pages/Index.tsx";
import Admin from "./pages/Admin.tsx";
import Referrals from "./pages/Referrals.tsx";
import Messages from "./pages/Messages.tsx";
import SMSHub from "./pages/SMSHub.tsx";
import ESign from "./pages/ESign.tsx";
import ESignPublic from "./pages/ESignPublic.tsx";
import ReferralForm from "./pages/ReferralForm.tsx";
import ReferralLanding from "./pages/ReferralLanding.tsx";
import MeetingJoin from "./pages/MeetingJoin.tsx";
import UploadDocuments from "./pages/UploadDocuments.tsx";
import StatementUpload from "./pages/StatementUpload.tsx";
import LicenseUpload from "./pages/LicenseUpload.tsx";
import Documents from "./pages/Documents.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ClientInputsProvider>
            <MeetingHostProvider>
              <SoftphoneProvider>
                <Routes>
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/dashboard" element={<ProtectedApp><Dashboard /></ProtectedApp>} />
                  <Route path="/pipeline" element={<ProtectedApp><Pipeline /></ProtectedApp>} />
                  <Route path="/presentations" element={<ProtectedApp><Presentations /></ProtectedApp>} />
                  <Route path="/" element={<ProtectedApp><Index /></ProtectedApp>} />
                  <Route path="/admin" element={<ProtectedApp><Admin /></ProtectedApp>} />
                  <Route path="/referrals" element={<ProtectedApp><Referrals /></ProtectedApp>} />
                  <Route path="/messages" element={<ProtectedApp><Messages /></ProtectedApp>} />
                  <Route path="/sms-hub" element={<ProtectedApp><SMSHub /></ProtectedApp>} />
                  <Route path="/esign" element={<ProtectedApp><ESign /></ProtectedApp>} />
                  <Route path="/ai-caller" element={<ProtectedApp><AICaller /></ProtectedApp>} />
                  <Route path="/phone" element={<ProtectedApp><Phone /></ProtectedApp>} />
                  <Route path="/fact-find" element={<ProtectedApp><FactFind /></ProtectedApp>} />
                  <Route path="/refer" element={<ReferralForm />} />
                  <Route path="/refer/claim" element={<ReferralLanding />} />
                  <Route path="/meeting/join" element={<MeetingJoin />} />
                  <Route path="/esign/sign" element={<ESignPublic />} />
                  <Route path="/upload" element={<UploadDocuments />} />
                  <Route path="/upload-statement" element={<StatementUpload />} />
                  <Route path="/upload-license" element={<LicenseUpload />} />
                  <Route path="/documents" element={<ProtectedApp><Documents /></ProtectedApp>} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
                <SoftphoneDock />
              </SoftphoneProvider>
            </MeetingHostProvider>
          </ClientInputsProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
