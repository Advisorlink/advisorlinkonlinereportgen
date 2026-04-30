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
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null, session: null, profile: null, loading: true, signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (uid: string): Promise<Profile | null> => {
    // Retry a few times — the profile row is created by a trigger on signup
    // and may briefly be unavailable on the very first login after claim.
    for (let i = 0; i < 5; i++) {
      const { data } = await supabase
        .from("profiles")
        .select("id,email,is_owner,is_blocked")
        .eq("id", uid)
        .maybeSingle();
      if (data) {
        setProfile(data as Profile);
        return data as Profile;
      }
      await new Promise(r => setTimeout(r, 300));
    }
    setProfile(null);
    return null;
  };

  useEffect(() => {
    let mounted = true;

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      if (!mounted) return;
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        // Defer profile lookup off the auth callback to avoid deadlocks
        setTimeout(() => {
          if (mounted) loadProfile(sess.user.id);
        }, 0);
      } else {
        setProfile(null);
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

  const signOut = async () => {
    if (user) {
      await supabase.from("activity_log").insert({
        user_id: user.id, email: user.email, event_type: "logout",
      });
    }
    await supabase.auth.signOut();
  };

  return <Ctx.Provider value={{ user, session, profile, loading, signOut }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
