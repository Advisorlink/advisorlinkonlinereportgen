import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { isHostAllowed } from "@/lib/security";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { usePushNotifications } from "@/hooks/usePushNotifications";

export function ProtectedApp({ children }: { children: ReactNode }) {
  const { user, profile, loading, authError, refreshProfile } = useAuth();
  usePushNotifications();

  // Domain lock — refuse to render on unauthorized hosts
  if (!isHostAllowed()) {
    return (
      <div className="min-h-screen grid place-items-center bg-navy text-navy-foreground p-6">
        <div className="max-w-md text-center">
          <ShieldAlert className="w-16 h-16 mx-auto mb-4 text-cyan" />
          <h1 className="text-2xl font-bold font-heading mb-2">Unauthorized Host</h1>
          <p className="text-sm opacity-80">
            This application is not licensed to run on this domain.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="min-h-screen grid place-items-center bg-secondary/40 text-sm text-muted-foreground">Loading…</div>;
  }

  if (!user) return <Navigate to="/auth" replace />;

  if (authError) {
    return (
      <div className="min-h-screen grid place-items-center bg-navy text-navy-foreground p-6">
        <div className="max-w-md text-center">
          <ShieldAlert className="w-16 h-16 mx-auto mb-4 text-cyan" />
          <h1 className="text-2xl font-bold font-heading mb-2">Owner Check Failed</h1>
          <p className="text-sm opacity-80 mb-4">{authError}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button variant="outline" className="bg-transparent border-white/20 text-navy-foreground hover:bg-white/10" onClick={refreshProfile}>Try Again</Button>
            <Button variant="outline" className="bg-transparent border-white/20 text-navy-foreground hover:bg-white/10" onClick={() => supabase.auth.signOut()}>Sign Out</Button>
          </div>
        </div>
      </div>
    );
  }

  // User exists but profile hasn't loaded yet — keep waiting briefly instead of denying.
  if (!profile) {
    return <div className="min-h-screen grid place-items-center bg-secondary/40 text-sm text-muted-foreground">Verifying owner…</div>;
  }

  if (profile?.is_blocked) {
    return (
      <div className="min-h-screen grid place-items-center bg-navy text-navy-foreground p-6">
        <div className="max-w-md text-center">
          <ShieldAlert className="w-16 h-16 mx-auto mb-4 text-destructive" />
          <h1 className="text-2xl font-bold font-heading mb-2">Account Blocked</h1>
          <p className="text-sm opacity-80 mb-4">Your access has been revoked by the owner.</p>
          <Button variant="outline" className="bg-transparent border-white/20 text-navy-foreground hover:bg-white/10" onClick={() => supabase.auth.signOut()}>Sign Out</Button>
        </div>
      </div>
    );
  }

  // Server-gating: refuse to render unless this user is the owner.
  // (In single-owner mode, only the owner should ever reach this.)
  if (!profile?.is_owner) {
    return (
      <div className="min-h-screen grid place-items-center bg-navy text-navy-foreground p-6">
        <div className="max-w-md text-center">
          <ShieldAlert className="w-16 h-16 mx-auto mb-4 text-cyan" />
          <h1 className="text-2xl font-bold font-heading mb-2">Access Denied</h1>
          <p className="text-sm opacity-80 mb-4">This app is restricted to its owner.</p>
          <Button variant="outline" className="bg-transparent border-white/20 text-navy-foreground hover:bg-white/10" onClick={() => supabase.auth.signOut()}>Sign Out</Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
