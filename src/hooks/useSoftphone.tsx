import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Device, Call } from "@twilio/voice-sdk";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type CapacitorBridge = { isNativePlatform?: () => boolean };

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

export type TwilioNumberOption = { phone_number: string; friendly_name: string | null };

type Ctx = {
  ready: boolean;
  registering: boolean;
  callerId: string | null;
  identity: string | null;
  incoming: Call | null;
  incomingMatch: ContactMatch | null;
  active: CallState | null;
  availableNumbers: TwilioNumberOption[];
  selectedCallerId: string | null;
  setSelectedCallerId: (n: string) => void;
  initialize: () => Promise<void>;
  bootstrap: () => Promise<void>;
  dial: (number: string, meta?: { contactName?: string; contactId?: string; dealId?: string; fromNumber?: string }) => Promise<void>;
  answer: () => void;
  reject: () => void;
  hangup: () => void;
  toggleMute: () => void;
  toggleHold: () => void;
  sendDigit: (d: string) => void;
};

const SoftphoneCtx = createContext<Ctx | null>(null);
const CALLER_ID_STORAGE_KEY = "softphone:selectedCallerId";

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

function callNotificationId(seed: string) {
  return Math.max(1, Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 7001) % 2147483647);
}

async function notifyNativeIncomingCall(title: string, body: string, extra: Record<string, string>) {
  const capacitor = (window as Window & { Capacitor?: CapacitorBridge }).Capacitor;
  const isNative = typeof capacitor?.isNativePlatform === "function" && capacitor.isNativePlatform();
  if (!isNative) return;

  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    let permission = await LocalNotifications.checkPermissions();
    if (permission.display === "prompt") permission = await LocalNotifications.requestPermissions();
    if (permission.display !== "granted") return;

    await LocalNotifications.createChannel?.({
      id: "calls",
      name: "Incoming calls",
      description: "AdvisorLink Online call alerts",
      importance: 5,
      visibility: 1,
      sound: "default",
      vibration: true,
      lights: true,
      lightColor: "#22d3ee",
    });

    await LocalNotifications.schedule({
      notifications: [{
        id: callNotificationId(extra.sid || extra.from || String(Date.now())),
        title,
        body,
        largeBody: body,
        summaryText: "AdvisorLink Online",
        channelId: "calls",
        sound: "default",
        autoCancel: true,
        interruptionLevel: "timeSensitive",
        extra: { ...extra, route: "/phone" },
      }],
    });
  } catch (e) {
    console.error("Native call notification failed", e);
  }
}

function notifyIncomingCall(title: string, body: string, extra: Record<string, string>) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.([700, 250, 700, 250, 700]);
  void notifyNativeIncomingCall(title, body, extra);
  if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") return;
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
  const initializingRef = useRef(false);
  const activeCallRef = useRef<Call | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const callMatchesRef = useRef(new WeakMap<Call, ContactMatch>());
  const [ready, setReady] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [callerId, setCallerId] = useState<string | null>(null);
  const [identity, setIdentity] = useState<string | null>(null);
  const [incoming, setIncoming] = useState<Call | null>(null);
  const [incomingMatch, setIncomingMatch] = useState<ContactMatch | null>(null);
  const [active, setActive] = useState<CallState | null>(null);
  const [availableNumbers, setAvailableNumbers] = useState<TwilioNumberOption[]>([]);
  const [selectedCallerId, setSelectedCallerIdState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(CALLER_ID_STORAGE_KEY);
  });
  const setSelectedCallerId = useCallback((n: string) => {
    setSelectedCallerIdState(n);
    try { window.localStorage.setItem(CALLER_ID_STORAGE_KEY, n); } catch { /* noop */ }
  }, []);

  // Load list of available Twilio numbers to choose from
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("sms_twilio_numbers")
        .select("phone_number, friendly_name, provider, is_default")
        .eq("provider", "twilio")
        .order("is_default", { ascending: false });
      if (cancelled) return;
      const rows = ((data || []) as Array<{ phone_number: string; friendly_name: string | null }>);
      setAvailableNumbers(rows);
      setSelectedCallerIdState((curr) => {
        if (curr && rows.some((r) => r.phone_number === curr)) return curr;
        return rows[0]?.phone_number ?? null;
      });
    })();
    return () => { cancelled = true; };
  }, []);


  const fetchToken = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke("twilio-voice-token");
    if (error) throw error;
    return data as { token: string; identity: string; caller_id: string };
  }, []);

  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleReconnect = useCallback((delayMs = 1500) => {
    if (reconnectTimerRef.current) return;
    reconnectTimerRef.current = setTimeout(async () => {
      reconnectTimerRef.current = null;
      try {
        const d = deviceRef.current;
        if (d) {
          try { d.destroy(); } catch { /* noop */ }
          deviceRef.current = null;
          setReady(false);
        }
        await initializeRef.current?.();
      } catch (e) { console.error("Twilio reconnect failed", e); }
    }, delayMs);
  }, []);

  const initializeRef = useRef<(() => Promise<void>) | null>(null);

  const initialize = useCallback(async () => {
    if (deviceRef.current || initializingRef.current) return;
    initializingRef.current = true;
    setRegistering(true);
    try {
      const { token, identity: id, caller_id } = await fetchToken();
      setIdentity(id);
      setCallerId(caller_id);
      const device = new Device(token, { logLevel: 1, allowIncomingWhileBusy: false, closeProtection: true });
      deviceRef.current = device;
      device.on("registered", () => setReady(true));
      device.on("unregistered", () => {
        setReady(false);
        scheduleReconnect(2000);
      });
      device.on("error", (e: { code?: number; message?: string }) => {
        console.error("Twilio Device error", e);
        const code = e?.code;
        // 31005 websocket closed, 31009 transport, 20104 token expired, 31204 jwt issues
        const recoverable = code === 31005 || code === 31009 || code === 20104 || code === 31204 || code === 31000;
        if (recoverable) {
          toast.message("Phone reconnecting…");
          scheduleReconnect(1000);
        } else {
          toast.error(`Phone error: ${e?.message || e}`);
        }
      });
      device.on("tokenWillExpire", async () => {
        try {
          const r = await fetchToken();
          device.updateToken(r.token);
        } catch (e) { console.error("token refresh failed", e); }
      });
      device.on("incoming", async (call: Call) => {
        const from = call.parameters?.From || "Unknown";
        const sid = call.parameters?.CallSid || "incoming-call";
        notifyIncomingCall("Incoming AdvisorLink call", `${from} is calling ${caller_id}`, { type: "call", from, sid, route: "/phone" });
        toast.message("Incoming call", {
          description: `${from} is calling ${caller_id}`,
          duration: 30_000,
          action: { label: "Open", onClick: () => window.location.assign("/phone") },
        });
        callMatchesRef.current.set(call, { name: null });
        setIncomingMatch({ name: null });
        setIncoming(call);
        const clearIncoming = () => {
          setIncoming((c) => (c === call ? null : c));
          setIncomingMatch(null);
        };
        call.on("cancel", clearIncoming);
        call.on("disconnect", clearIncoming);
        call.on("reject", clearIncoming);
        const match = await lookupCaller(from);
        callMatchesRef.current.set(call, match);
        setIncomingMatch(match);
        setIncoming((c) => (c === call ? call : c));
        if (match.name) {
          toast.message("Incoming call", {
            description: `${match.name} is calling ${caller_id}`,
            duration: 30_000,
            action: { label: "Open", onClick: () => window.location.assign("/phone") },
          });
        }
      });
      await device.register();
    } catch (e) {
      const d = deviceRef.current;
      if (d) {
        try { d.destroy(); } catch { /* noop */ }
        deviceRef.current = null;
      }
      setReady(false);
      console.error("initialize failed", e);
      toast.error(`Couldn't start phone: ${String(e)}`);
    } finally {
      initializingRef.current = false;
      setRegistering(false);
    }
  }, [fetchToken, scheduleReconnect]);

  // Keep latest initialize in a ref so scheduleReconnect can call it without circular deps
  useEffect(() => { initializeRef.current = initialize; }, [initialize]);

  // Reconnect when app returns to foreground / regains network (mobile websockets often die)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && !deviceRef.current) {
        initialize().catch(() => { /* noop */ });
      }
    };
    const onOnline = () => {
      if (!deviceRef.current) initialize().catch(() => { /* noop */ });
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("focus", onVisible);
    };
  }, [initialize]);

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
      lookupMeta = { ...meta, contactName: m.name ?? undefined, contactId: m.contactId ?? undefined, dealId: m.dealId ?? undefined };
    }
    const fromNumber = meta?.fromNumber || selectedCallerId || "";
    const params: Record<string, string> = { To: normalized };
    if (fromNumber) params.CallerId = fromNumber;
    const call = await device.connect({ params });
    attachCall(call, {
      direction: "outbound",
      from: fromNumber || callerId || "",
      to: normalized,
      contactName: lookupMeta?.contactName ?? null,
      contactId: lookupMeta?.contactId ?? null,
      dealId: lookupMeta?.dealId ?? null,
      startedAt: Date.now(),
      status: "connecting",
    });
  }, [attachCall, callerId, initialize, selectedCallerId]);


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
    setIncomingMatch(null);
  }, [attachCall, callerId, incoming]);

  const reject = useCallback(() => {
    incoming?.reject();
    setIncoming(null);
    setIncomingMatch(null);
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
    ready, registering, callerId, identity, incoming, incomingMatch, active,
    initialize, bootstrap, dial, answer, reject, hangup, toggleMute, toggleHold, sendDigit,
  }), [ready, registering, callerId, identity, incoming, incomingMatch, active, initialize, bootstrap, dial, answer, reject, hangup, toggleMute, toggleHold, sendDigit]);

  return <SoftphoneCtx.Provider value={value}>{children}</SoftphoneCtx.Provider>;
}

export function useSoftphone() {
  const ctx = useContext(SoftphoneCtx);
  if (!ctx) throw new Error("useSoftphone must be used inside SoftphoneProvider");
  return ctx;
}
