import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ClientInputsProvider } from "@/hooks/useClientInputs";
import { ProtectedApp } from "@/components/ProtectedApp";
import Auth from "./pages/Auth.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Presentations from "./pages/Presentations.tsx";
import Index from "./pages/Index.tsx";
import Admin from "./pages/Admin.tsx";
import Referrals from "./pages/Referrals.tsx";
import ReferralForm from "./pages/ReferralForm.tsx";
import ReferralLanding from "./pages/ReferralLanding.tsx";
import MeetingJoin from "./pages/MeetingJoin.tsx";
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
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/dashboard" element={<ProtectedApp><Dashboard /></ProtectedApp>} />
              <Route path="/presentations" element={<ProtectedApp><Presentations /></ProtectedApp>} />
              <Route path="/" element={<ProtectedApp><Index /></ProtectedApp>} />
              <Route path="/admin" element={<ProtectedApp><Admin /></ProtectedApp>} />
              <Route path="/referrals" element={<ProtectedApp><Referrals /></ProtectedApp>} />
              <Route path="/refer" element={<ReferralForm />} />
              <Route path="/refer/claim" element={<ReferralLanding />} />
              <Route path="/meeting/join" element={<MeetingJoin />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </ClientInputsProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
