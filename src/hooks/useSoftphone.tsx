import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Device, Call } from "@twilio/voice-sdk";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type CallState = {
  direction: "inbound" | "outbound";
  from: string;
  to: string;
  contactName?: string | null;
  contactId?: string | null;
  dealId?: string | null;
  startedAt: number;
  status: "ringing" | "in-progress" | "connecting";
  isMuted: boolean;
  isOnHold: boolean;
};

type Ctx = {
  ready: boolean;
  registering: boolean;
  callerId: string | null;
  identity: string | null;
  incoming: Call | null;
  active: CallState | null;
  initialize: () => Promise<void>;
  bootstrap: () => Promise<void>;
  dial: (number: string, meta?: { contactName?: string; contactId?: string; dealId?: string }) => Promise<void>;
  answer: () => void;
  reject: () => void;
  hangup: () => void;
  toggleMute: () => void;
  toggleHold: () => void;
  sendDigit: (d: string) => void;
};

const SoftphoneCtx = createContext<Ctx | null>(null);

type ContactMatch = { name: string | null; contactId?: string | null; dealId?: string | null };

function normalizeDialNumber(input: string) {
  const raw = input.trim();
  if (!raw) return "";
  const value = raw.replace(/[^\d+]/g, "");
  if (value.startsWith("+")) return value;
  if (value.startsWith("0011")) return `+${value.slice(4)}`;
  if (value.startsWith("00")) return `+${value.slice(2)}`;
  if (value.startsWith("61")) return `+${value}`;
  if (value.startsWith("0")) return `+61${value.slice(1)}`;
  if (/^4\d{8}$/.test(value)) return `+61${value}`;
  return `+${value}`;
}

function isE164(number: string) {
  return /^\+[1-9]\d{7,14}$/.test(number);
}

function notifyIncomingCall(title: string, body: string) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.([700, 250, 700, 250, 700]);
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const n = new Notification(title, { body, tag: "crm-incoming-call", requireInteraction: true });
  n.onclick = () => {
    window.focus();
    window.location.assign("/phone");
    n.close();
  };
}

async function lookupCaller(rawNumber: string): Promise<ContactMatch> {
  const digits = rawNumber.replace(/[^0-9]/g, "").slice(-9);
  if (!digits) return { name: null };
  try {
    const { data: contact } = await supabase
      .from("sms_contacts")
      .select("id, full_name")
      .ilike("phone", `%${digits}%`)
      .limit(1)
      .maybeSingle();
    if (contact) return { name: contact.full_name, contactId: contact.id };
    const { data: deal } = await supabase
      .from("pipeline_deals")
      .select("id, client_name")
      .ilike("client_phone", `%${digits}%`)
      .limit(1)
      .maybeSingle();
    if (deal) return { name: deal.client_name, dealId: deal.id };
  } catch (_e) { /* noop */ }
  return { name: null };
}

export function SoftphoneProvider({ children }: { children: React.ReactNode }) {
  const deviceRef = useRef<Device | null>(null);
  const activeCallRef = useRef<Call | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const callMatchesRef = useRef(new WeakMap<Call, ContactMatch>());
  const [ready, setReady] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [callerId, setCallerId] = useState<string | null>(null);
  const [identity, setIdentity] = useState<string | null>(null);
  const [incoming, setIncoming] = useState<Call | null>(null);
  const [active, setActive] = useState<CallState | null>(null);

  const fetchToken = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke("twilio-voice-token");
    if (error) throw error;
    return data as { token: string; identity: string; caller_id: string };
  }, []);

  const initialize = useCallback(async () => {
    if (deviceRef.current || registering) return;
    setRegistering(true);
    try {
      const { token, identity: id, caller_id } = await fetchToken();
      setIdentity(id);
      setCallerId(caller_id);
      const device = new Device(token, { logLevel: 1, allowIncomingWhileBusy: false });
      device.on("registered", () => setReady(true));
      device.on("unregistered", () => setReady(false));
      device.on("error", (e) => {
        console.error("Twilio Device error", e);
        toast.error(`Phone error: ${e.message || e}`);
      });
      device.on("tokenWillExpire", async () => {
        try {
          const r = await fetchToken();
          device.updateToken(r.token);
        } catch (e) { console.error("token refresh failed", e); }
      });
      device.on("incoming", async (call: Call) => {
        const from = call.parameters?.From || "Unknown";
        callMatchesRef.current.set(call, { name: null });
        setIncoming(call);
        call.on("cancel", () => setIncoming((c) => (c === call ? null : c)));
        call.on("disconnect", () => setIncoming((c) => (c === call ? null : c)));
        call.on("reject", () => setIncoming((c) => (c === call ? null : c)));
        const match = await lookupCaller(from);
        callMatchesRef.current.set(call, match);
        setIncoming((c) => (c === call ? call : c));
        notifyIncomingCall("Incoming CRM call", `${match.name || from} is calling ${caller_id}`);
        toast.message(`Incoming call from ${match.name || from}`);
      });
      await device.register();
      deviceRef.current = device;
    } catch (e) {
      console.error("initialize failed", e);
      toast.error(`Couldn't start phone: ${String(e)}`);
    } finally {
      setRegistering(false);
    }
  }, [fetchToken, registering]);

  const bootstrap = useCallback(async () => {
    const { error } = await supabase.functions.invoke("twilio-voice-bootstrap");
    if (error) throw error;
  }, []);

  const attachCall = useCallback((call: Call, state: Omit<CallState, "isMuted" | "isOnHold">) => {
    activeCallRef.current = call;
    setActive({ ...state, isMuted: false, isOnHold: false });
    call.on("accept", () => {
      setActive((s) => (s ? { ...s, status: "in-progress" } : s));
    });
    call.on("disconnect", () => {
      activeCallRef.current = null;
      setActive(null);
    });
    call.on("cancel", () => {
      activeCallRef.current = null;
      setActive(null);
    });
    call.on("reject", () => {
      activeCallRef.current = null;
      setActive(null);
    });
    call.on("error", (e: unknown) => {
      const message = e instanceof Error ? e.message : String(e);
      toast.error(`Call error: ${message}`);
    });
  }, []);

  const dial = useCallback<Ctx["dial"]>(async (number, meta) => {
    const normalized = normalizeDialNumber(number);
    if (!isE164(normalized)) {
      toast.error("That phone number is invalid. Try 0400 000 000 or +61400000000.");
      return;
    }
    if (!deviceRef.current) await initialize();
    const device = deviceRef.current;
    if (!device) return;
    let lookupMeta = meta;
    if (!lookupMeta?.contactName) {
      const m = await lookupCaller(normalized);
      lookupMeta = { contactName: m.name ?? undefined, contactId: m.contactId ?? undefined, dealId: m.dealId ?? undefined };
    }
    const call = await device.connect({ params: { To: normalized } });
    attachCall(call, {
      direction: "outbound",
      from: callerId || "",
      to: normalized,
      contactName: lookupMeta?.contactName ?? null,
      contactId: lookupMeta?.contactId ?? null,
      dealId: lookupMeta?.dealId ?? null,
      startedAt: Date.now(),
      status: "connecting",
    });
  }, [attachCall, callerId, initialize]);

  const answer = useCallback(() => {
    if (!incoming) return;
    const match = callMatchesRef.current.get(incoming);
    const from = incoming.parameters?.From || "Unknown";
    const to = incoming.parameters?.To || callerId || "";
    incoming.accept();
    attachCall(incoming, {
      direction: "inbound",
      from,
      to,
      contactName: match?.name ?? null,
      contactId: match?.contactId ?? null,
      dealId: match?.dealId ?? null,
      startedAt: Date.now(),
      status: "in-progress",
    });
    setIncoming(null);
  }, [attachCall, callerId, incoming]);

  const reject = useCallback(() => {
    incoming?.reject();
    setIncoming(null);
  }, [incoming]);

  const hangup = useCallback(() => {
    activeCallRef.current?.disconnect();
    activeCallRef.current = null;
    setActive(null);
  }, []);

  const toggleMute = useCallback(() => {
    const c = activeCallRef.current;
    if (!c) return;
    const next = !c.isMuted();
    c.mute(next);
    setActive((s) => (s ? { ...s, isMuted: next } : s));
  }, []);

  const toggleHold = useCallback(() => {
    const c = activeCallRef.current;
    if (!c) return;
    setActive((s) => {
      if (!s) return s;
      const next = !s.isOnHold;
      // Mute mic + silence remote audio as a simple hold implementation
      c.mute(next);
      const audio = remoteAudioRef.current;
      if (audio) audio.muted = next;
      return { ...s, isOnHold: next, isMuted: next ? true : s.isMuted };
    });
  }, []);

  const sendDigit = useCallback((d: string) => {
    activeCallRef.current?.sendDigits(d);
  }, []);

  // Mount a single audio element so we can mute remote audio for hold
  useEffect(() => {
    const a = document.createElement("audio");
    a.autoplay = true;
    a.style.display = "none";
    document.body.appendChild(a);
    remoteAudioRef.current = a;
    return () => { a.remove(); remoteAudioRef.current = null; };
  }, []);

  // Auto-init when user is signed in
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (mounted && data.session) {
        initialize().catch(() => { /* surfaced via toast */ });
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) initialize().catch(() => { /* noop */ });
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, [initialize]);

  const value = useMemo<Ctx>(() => ({
    ready, registering, callerId, identity, incoming, active,
    initialize, bootstrap, dial, answer, reject, hangup, toggleMute, toggleHold, sendDigit,
  }), [ready, registering, callerId, identity, incoming, active, initialize, bootstrap, dial, answer, reject, hangup, toggleMute, toggleHold, sendDigit]);

  return <SoftphoneCtx.Provider value={value}>{children}</SoftphoneCtx.Provider>;
}

export function useSoftphone() {
  const ctx = useContext(SoftphoneCtx);
  if (!ctx) throw new Error("useSoftphone must be used inside SoftphoneProvider");
  return ctx;
}
