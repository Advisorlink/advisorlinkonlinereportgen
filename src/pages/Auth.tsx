import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Lock, Shield } from "lucide-react";

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
    // Check blocked
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
    return <div className="min-h-screen grid place-items-center bg-secondary/40 text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="min-h-screen grid place-items-center bg-navy text-navy-foreground p-6">
      <div className="w-full max-w-md bg-white text-foreground rounded-xl shadow-elevated p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-cyan grid place-items-center">
            <Shield className="w-5 h-5 text-cyan-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-heading text-navy">
              {ownerClaimed ? "Owner Sign In" : "Claim Ownership"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {ownerClaimed ? "Restricted access" : "First signup becomes the permanent owner"}
            </p>
          </div>
        </div>

        <form onSubmit={ownerClaimed ? handleLogin : handleClaimOwner} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete={ownerClaimed ? "current-password" : "new-password"} required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" disabled={busy} className="w-full bg-navy text-navy-foreground hover:bg-navy/90">
            <Lock className="w-4 h-4 mr-2" />
            {busy ? "Working…" : ownerClaimed ? "Sign In" : "Claim Owner Account"}
          </Button>
        </form>

        {ownerClaimed && (
          <p className="mt-4 text-[11px] text-center text-muted-foreground">
            Signups are disabled. Only the owner account can sign in.
          </p>
        )}
      </div>
    </div>
  );
}
