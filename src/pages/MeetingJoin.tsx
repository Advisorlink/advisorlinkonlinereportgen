import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Maximize2, Monitor, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import logoSvg from "@/assets/logo.svg";
import heroImg from "@/assets/meeting-hero.jpg";

const iceServers = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
];

const SESSION_KEY = "alo_meeting_session";

interface SavedMeetingSession {
  meetingId: string;
  clientId: string;
}

const loadSavedSession = (): SavedMeetingSession | null => {
  if (typeof window === "undefined") return null;
  const saved = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
  if (!saved) return null;
  try {
    return JSON.parse(saved) as SavedMeetingSession;
  } catch {
    return null;
  }
};

const persistSession = (session: SavedMeetingSession) => {
  const value = JSON.stringify(session);
  localStorage.setItem(SESSION_KEY, value);
  sessionStorage.setItem(SESSION_KEY, value);
};

const clearSavedSession = () => {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
};

export default function MeetingJoin() {
  const [meetingId, setMeetingId] = useState("");
  const [status, setStatus] = useState<"idle" | "connecting" | "waiting" | "connected" | "ended">("idle");
  const [error, setError] = useState("");
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false);
  const [fullscreenDismissed, setFullscreenDismissed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const viewingRef = useRef<HTMLDivElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const clientIdRef = useRef<string>(crypto.randomUUID());
  const meetingIdRef = useRef("");
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const fullscreenDismissedRef = useRef(false);
  const reconnectTimerRef = useRef<number | null>(null);
  const lastJoinRequestRef = useRef(0);

  // Persist session so mobile users can navigate away and come back
  const saveSession = (mid: string) => {
    meetingIdRef.current = mid;
    persistSession({ meetingId: mid, clientId: clientIdRef.current });
  };
  const clearSession = () => {
    meetingIdRef.current = "";
    clearSavedSession();
  };

  useEffect(() => {
    fullscreenDismissedRef.current = fullscreenDismissed;
  }, [fullscreenDismissed]);

  const requestFreshOffer = useCallback((reason = "resume") => {
    const ch = channelRef.current;
    const mid = meetingIdRef.current;
    if (!ch || !mid) return;

    const now = Date.now();
    if (now - lastJoinRequestRef.current < 1200) return;
    lastJoinRequestRef.current = now;

    pcRef.current?.close();
    pcRef.current = null;
    remoteStreamRef.current = null;
    setRemoteStream(null);
    setStatus("waiting");
    ch.send({ type: "broadcast", event: "join", payload: { clientId: clientIdRef.current, reason } });
  }, []);

  const markMeetingEnded = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    remoteStreamRef.current = null;
    setRemoteStream(null);
    setShowFullscreenPrompt(false);
    setStatus("ended");
    clearSession();
  }, []);

  const setupPeerConnection = useCallback((ch: ReturnType<typeof supabase.channel>) => {
    pcRef.current?.close();
    const pc = new RTCPeerConnection({ iceServers });
    pcRef.current = pc;

    pc.ontrack = (e) => {
      if (e.streams[0]) {
        remoteStreamRef.current = e.streams[0];
        setRemoteStream(e.streams[0]);
        setStatus("connected");
        if (!fullscreenDismissedRef.current) setShowFullscreenPrompt(true);
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
        setStatus("waiting");
        remoteStreamRef.current = null;
        setRemoteStream(null);
        if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = window.setTimeout(() => requestFreshOffer("ice-reconnect"), 900);
        toast.info("Reconnecting to the screen share...");
      }
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        ch.send({ type: "broadcast", event: "ice-candidate", payload: { candidate: e.candidate, clientId: clientIdRef.current, from: "client" } });
      }
    };

    return pc;
  }, [requestFreshOffer]);

  const connectToMeeting = useCallback(async (mid: string, cid: string) => {
    if (channelRef.current) {
      await supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    pcRef.current?.close();
    pcRef.current = null;
    meetingIdRef.current = mid;

    const ch = supabase.channel(`meeting:${mid}`, {
      config: {
        broadcast: { self: false },
        presence: { key: `client-${cid}` },
      },
    });

    ch.on("broadcast", { event: "offer" }, async ({ payload }) => {
      if (payload.clientId !== cid) return;
      const pc = pcRef.current || setupPeerConnection(ch);
      await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      ch.send({ type: "broadcast", event: "answer", payload: { sdp: answer, clientId: cid } });
    });

    ch.on("broadcast", { event: "ice-candidate" }, async ({ payload }) => {
      if (payload.from !== "host") return;
      if (payload.candidate && pcRef.current) {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
      }
    });

    ch.on("broadcast", { event: "screen-ready" }, () => {
      ch.send({ type: "broadcast", event: "join", payload: { clientId: cid } });
    });

    ch.on("broadcast", { event: "meeting-ended" }, () => {
      markMeetingEnded();
      toast.info("The host has ended the meeting");
    });

    await ch.subscribe(async (subscribeStatus) => {
      if (subscribeStatus === "SUBSCRIBED") {
        await ch.track({ role: "client", clientId: cid });
        ch.send({ type: "broadcast", event: "join", payload: { clientId: cid } });
      }
    });
    channelRef.current = ch;
    setStatus("waiting");
  }, [markMeetingEnded, setupPeerConnection]);

  const joinMeeting = useCallback(async () => {
    const mid = meetingId.trim();
    if (!mid) { setError("Please enter a meeting ID"); return; }
    setError("");
    setStatus("connecting");

    const { data: meeting } = await supabase
      .from("meetings")
      .select("*")
      .eq("meeting_id", mid)
      .single();

    if (!meeting) {
      setError("Meeting not found. Please check the ID and try again.");
      setStatus("idle");
      return;
    }

    if (meeting.status === "ended") {
      setError("This meeting has already ended.");
      setStatus("idle");
      return;
    }

    const cid = clientIdRef.current;
    saveSession(mid);
    await connectToMeeting(mid, cid);
  }, [meetingId, connectToMeeting]);

  const openFullscreen = useCallback(async () => {
    const target = viewingRef.current;
    const video = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void; webkitSupportsFullscreen?: boolean }) | null;
    try {
      if (target?.requestFullscreen) {
        await target.requestFullscreen();
      } else if (video?.webkitEnterFullscreen && video.webkitSupportsFullscreen !== false) {
        video.webkitEnterFullscreen();
      }
      setFullscreenDismissed(true);
      setShowFullscreenPrompt(false);
    } catch {
      toast.error("Fullscreen could not be opened on this device");
    }
  }, []);

  // Restore session on mount (mobile navigation back)
  useEffect(() => {
    const saved = loadSavedSession();
    if (saved) {
      const { meetingId: mid, clientId: cid } = saved;
      clientIdRef.current = cid;
      meetingIdRef.current = mid;
      setMeetingId(mid);
      setStatus("connecting");
      supabase.from("meetings").select("status").eq("meeting_id", mid).single().then(({ data }) => {
        if (data && data.status !== "ended") {
          connectToMeeting(mid, cid);
        } else {
          clearSession();
          if (data?.status === "ended") setStatus("ended");
          else setStatus("idle");
        }
      });
    }
  }, [connectToMeeting]);

  useEffect(() => {
    return () => {
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      setRemoteStream(null);
      pcRef.current?.close();
      if (channelRef.current) {
        channelRef.current.send({ type: "broadcast", event: "leave", payload: { clientId: clientIdRef.current } });
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && meetingIdRef.current && status !== "ended") {
        supabase.from("meetings").select("status").eq("meeting_id", meetingIdRef.current).single().then(({ data }) => {
          if (data?.status === "ended") {
            markMeetingEnded();
            return;
          }
          if (!remoteStreamRef.current || pcRef.current?.iceConnectionState === "disconnected" || pcRef.current?.iceConnectionState === "failed") {
            requestFreshOffer("visible-resume");
          }
        });
      }
    };

    window.addEventListener("pageshow", handleVisibilityChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleVisibilityChange);
    return () => {
      window.removeEventListener("pageshow", handleVisibilityChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleVisibilityChange);
    };
  }, [markMeetingEnded, requestFreshOffer, status]);

  useEffect(() => {
    if (videoRef.current && remoteStream) {
      videoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, status]);

  // ----- Connected / viewing screen share -----
  if (status === "connected") {
    return (
      <div ref={viewingRef} className="min-h-screen min-h-[100dvh] bg-black flex flex-col relative">
        <header className="px-4 py-3 bg-black/80 backdrop-blur-sm flex items-center justify-between shrink-0">
          <img src={logoSvg} alt="Advisor Link Online" className="h-7 sm:h-8" />
          <span className="text-white/50 text-xs font-mono">ID: {meetingId}</span>
        </header>
        <main className="flex-1 flex items-center justify-center p-2 sm:p-4">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full max-h-[calc(100dvh-80px)] rounded-lg bg-black shadow-2xl object-contain"
          />
        </main>
        {showFullscreenPrompt && (
          <div className="fixed inset-x-3 bottom-5 z-50 mx-auto max-w-sm rounded-2xl border border-white/15 bg-black/85 p-4 text-white shadow-2xl backdrop-blur-xl sm:bottom-8">
            <button
              type="button"
              aria-label="Close fullscreen prompt"
              className="absolute right-3 top-3 rounded-full p-1 text-white/60 transition-colors hover:text-white"
              onClick={() => {
                setFullscreenDismissed(true);
                setShowFullscreenPrompt(false);
              }}
            >
              <X className="h-4 w-4" />
            </button>
            <div className="pr-7">
              <p className="text-base font-semibold">Make this full screen?</p>
              <p className="mt-1 text-sm text-white/60">This makes the shared screen easier to read on your phone.</p>
            </div>
            <div className="mt-4 flex gap-2">
              <Button className="h-11 flex-1 rounded-xl" onClick={openFullscreen}>
                <Maximize2 className="mr-2 h-4 w-4" /> Yes, full screen
              </Button>
              <Button
                variant="outline"
                className="h-11 rounded-xl border-white/15 bg-white/10 text-white hover:bg-white/15 hover:text-white"
                onClick={() => {
                  setFullscreenDismissed(true);
                  setShowFullscreenPrompt(false);
                }}
              >
                Not now
              </Button>
            </div>
          </div>
        )}
        <p className="text-white/30 text-[10px] text-center pb-2">You are viewing your consultant's screen</p>
      </div>
    );
  }

  // ----- Ended -----
  if (status === "ended") {
    return (
      <div className="min-h-screen min-h-[100dvh] relative flex flex-col">
        <div className="absolute inset-0 -z-10">
          <img src={heroImg} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-[hsl(210_60%_12%/0.75)]" />
        </div>
        <header className="px-4 sm:px-8 py-4 flex items-center justify-between">
          <img src={logoSvg} alt="Advisor Link Online" className="h-8 sm:h-10" />
        </header>
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur flex items-center justify-center mx-auto mb-5">
              <Monitor className="w-8 h-8 text-white/50" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Meeting Ended</h2>
            <p className="text-white/60 text-sm sm:text-base mb-8">Your consultant has ended the meeting. Thank you for joining.</p>
            <Button
              className="bg-[hsl(170_90%_45%)] hover:bg-[hsl(170_90%_40%)] text-white font-semibold px-8 h-12 rounded-full text-base"
              onClick={() => { setStatus("idle"); setMeetingId(""); }}
            >
              Join Another Meeting
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // ----- Idle / Connecting / Waiting (main landing) -----
  return (
    <div className="min-h-screen min-h-[100dvh] relative flex flex-col">
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <img src={heroImg} alt="" className="w-full h-full object-cover" width={1920} height={1080} />
        <div className="absolute inset-0 bg-gradient-to-b from-[hsl(210_60%_12%/0.6)] via-[hsl(210_60%_12%/0.7)] to-[hsl(210_60%_12%/0.85)]" />
      </div>

      {/* Header */}
      <header className="px-4 sm:px-8 py-4 flex items-center justify-between shrink-0">
        <img src={logoSvg} alt="Advisor Link Online" className="h-8 sm:h-10" />
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-8">
        {/* Hero text */}
        <div className="text-center mb-6 sm:mb-10 max-w-2xl">
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold text-white leading-tight tracking-tight">
            Welcome To Your Advisor Link Online Meeting.
          </h1>
          <p className="text-[hsl(170_80%_60%)] text-sm sm:text-base mt-3">
            Please wait for your consultant to call you with your meeting ID so you can view their screen
          </p>
        </div>

        {/* Card */}
        <div className="w-full max-w-md">
          <div className="bg-white/[0.08] backdrop-blur-xl border border-white/[0.12] rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-2xl">
            {status === "waiting" ? (
              <div className="text-center space-y-4">
                <Loader2 className="w-10 h-10 text-[hsl(170_80%_55%)] animate-spin mx-auto" />
                <h2 className="text-lg sm:text-xl font-semibold text-white">You're in the meeting</h2>
                <p className="text-white/50 text-sm">Waiting for your consultant to share their screen...</p>
                <div className="bg-white/5 rounded-xl p-3 mt-2">
                  <p className="text-white/40 text-xs">Meeting ID: <span className="font-mono font-bold text-white/80 text-base">{meetingId}</span></p>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-xl sm:text-2xl font-semibold text-white text-center mb-6">Start a Meeting</h2>
                <div className="space-y-4">
                  <Input
                    value={meetingId}
                    onChange={(e) => setMeetingId(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="Enter your meeting ID"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="bg-white/90 border-0 text-gray-800 placeholder:text-gray-400 text-center text-lg font-mono tracking-widest h-14 rounded-xl focus-visible:ring-[hsl(170_80%_55%)] focus-visible:ring-2"
                    onKeyDown={(e) => e.key === "Enter" && joinMeeting()}
                    disabled={status === "connecting"}
                  />
                  {error && <p className="text-sm text-red-400 text-center">{error}</p>}
                  <Button
                    className="w-full bg-[hsl(220_80%_55%)] hover:bg-[hsl(220_80%_48%)] text-white h-12 sm:h-14 text-base font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-[hsl(220_80%_55%/0.3)]"
                    onClick={joinMeeting}
                    disabled={status === "connecting"}
                  >
                    {status === "connecting" ? (
                      <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Connecting...</>
                    ) : (
                      "Start Meeting"
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function Footer() {
  return (
    <footer className="px-4 sm:px-8 py-6 text-center space-y-3 shrink-0">
      <p className="text-white/40 text-xs sm:text-sm max-w-lg mx-auto">
        With AdvisorLink, we connect you to fully Licensed and Vetted advisors to take the guesswork out of who to trust.
      </p>
      <div className="flex items-center justify-center gap-4 text-white/30 text-xs">
        <a href="https://advisorlinkonline.com.au/privacy-policy/" target="_blank" rel="noopener noreferrer" className="hover:text-white/60 transition-colors underline underline-offset-2">
          Privacy Policy
        </a>
        <a href="https://advisorlinkonline.com.au/terms-and-conditions/" target="_blank" rel="noopener noreferrer" className="hover:text-white/60 transition-colors underline underline-offset-2">
          Terms and Conditions
        </a>
      </div>
      <p className="text-white/20 text-[10px]">© {new Date().getFullYear()} Advisor Link Online. All rights reserved.</p>
    </footer>
  );
}
