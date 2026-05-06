import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  id: string;
  email: string;
  is_owner: boolean;
  is_blocked: boolean;
}

interface AuthCtx {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  authError: string | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  authError: null,
  refreshProfile: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const loadProfile = async (uid: string): Promise<Profile | null> => {
    // Retry a few times — the profile row is created by a trigger on signup
    // and may briefly be unavailable on the very first login after claim.
    let lastError: string | null = null;
    setAuthError(null);
    for (let i = 0; i < 8; i++) {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,email,is_owner,is_blocked")
        .eq("id", uid)
        .maybeSingle();
      if (error) lastError = error.message;
      if (data) {
        setProfile(data as Profile);
        setAuthError(null);
        return data as Profile;
      }
      await new Promise(r => setTimeout(r, 750));
    }
    setProfile(null);
    setAuthError(lastError ?? "Owner profile could not be found.");
    return null;
  };

  useEffect(() => {
    let mounted = true;

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      if (!mounted) return;
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        // Only reload profile if user changed — don't clear on token refreshes
        setAuthError(null);
        setTimeout(() => {
          if (mounted) loadProfile(sess.user.id);
        }, 0);
      } else {
        setProfile(null);
        setAuthError(null);
      }
    });

    // Initial load — wait for profile before unblocking the UI
    (async () => {
      const { data: { session: s } } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) await loadProfile(s.user.id);
      if (mounted) setLoading(false);
    })();

    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  const refreshProfile = async () => {
    if (user) await loadProfile(user.id);
  };

  const signOut = async () => {
    if (user) {
      await supabase.from("activity_log").insert({
        user_id: user.id, email: user.email, event_type: "logout",
      });
    }
    await supabase.auth.signOut();
  };

  return <Ctx.Provider value={{ user, session, profile, loading, authError, refreshProfile, signOut }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
