import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Lock, Shield, Sparkles } from "lucide-react";
import logoSvg from "@/assets/logo.svg";

const credSchema = z.object({
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(8, "Min 8 characters").max(128),
});

export default function Auth() {
  const nav = useNavigate();
  const [ownerClaimed, setOwnerClaimed] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) nav("/", { replace: true });
    });
    supabase
      .from("app_config")
      .select("owner_user_id")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => setOwnerClaimed(!!data?.owner_user_id));
  }, [nav]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = credSchema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
    if (error) {
      toast.error(error.message);
      setBusy(false);
      return;
    }
    const { data: prof } = await supabase.from("profiles").select("is_blocked").eq("id", data.user!.id).maybeSingle();
    if (prof?.is_blocked) {
      await supabase.from("activity_log").insert({ user_id: data.user!.id, email: parsed.data.email, event_type: "access_denied", details: { reason: "blocked" } });
      await supabase.auth.signOut();
      toast.error("This account has been blocked.");
      setBusy(false);
      return;
    }
    await supabase.from("profiles").update({ last_login_at: new Date().toISOString() }).eq("id", data.user!.id);
    await supabase.from("activity_log").insert({ user_id: data.user!.id, email: parsed.data.email, event_type: "login" });
    toast.success("Welcome back");
    nav("/", { replace: true });
  };

  const handleClaimOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = credSchema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    if (error) {
      toast.error(error.message);
      setBusy(false);
      return;
    }
    toast.success("Owner account created. Signing in…");
    await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
    nav("/", { replace: true });
  };

  if (ownerClaimed === null) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <div className="w-5 h-5 border-2 border-cyan border-t-transparent rounded-full animate-spin" />
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(215,58%,10%)] via-[hsl(215,58%,14%)] to-[hsl(215,50%,18%)] p-6 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-cyan/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-cyan/3 rounded-full blur-[100px]" />
      
      <div className="w-full max-w-md relative">
        {/* Logo above card */}
        <div className="flex justify-center mb-8">
          <img src={logoSvg} alt="Advisor Link Online" className="h-10 drop-shadow-2xl" />
        </div>

        <div className="bg-white/[0.97] backdrop-blur-xl rounded-2xl shadow-2xl shadow-black/20 p-8 border border-white/20">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-xl gradient-accent grid place-items-center shadow-lg shadow-cyan/25">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold font-heading text-foreground">
                {ownerClaimed ? "Welcome back" : "Claim Ownership"}
              </h1>
              <p className="text-xs text-muted-foreground">
                {ownerClaimed ? "Sign in to your account" : "First signup becomes the permanent owner"}
              </p>
            </div>
          </div>

          <form onSubmit={ownerClaimed ? handleLogin : handleClaimOwner} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium text-muted-foreground">Email</Label>
              <Input
                id="email" type="email" autoComplete="email" required
                value={email} onChange={(e) => setEmail(e.target.value)}
                className="h-11 bg-muted/50 border-border/60 focus:border-cyan focus:ring-cyan/20"
                placeholder="you@company.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium text-muted-foreground">Password</Label>
              <Input
                id="password" type="password" autoComplete={ownerClaimed ? "current-password" : "new-password"}
                required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)}
                className="h-11 bg-muted/50 border-border/60 focus:border-cyan focus:ring-cyan/20"
                placeholder="••••••••"
              />
            </div>
            <Button
              type="submit" disabled={busy}
              className="w-full h-11 gradient-accent text-white border-0 shadow-lg shadow-cyan/25 hover:shadow-cyan/35 transition-all font-medium"
            >
              <Lock className="w-4 h-4 mr-2" />
              {busy ? "Working…" : ownerClaimed ? "Sign In" : "Claim Owner Account"}
            </Button>
          </form>

          {ownerClaimed && (
            <p className="mt-5 text-[11px] text-center text-muted-foreground/70">
              Signups are disabled. Only the owner account can sign in.
            </p>
          )}
        </div>

        <p className="text-center text-white/30 text-[11px] mt-6">
          Powered by Advisor Link Online
        </p>
      </div>
    </div>
  );
}
