import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Monitor, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function MeetingJoin() {
  const [meetingId, setMeetingId] = useState("");
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "ended">("idle");
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const iceServers = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ];

  const joinMeeting = useCallback(async () => {
    const mid = meetingId.trim().toLowerCase();
    if (!mid) { setError("Please enter a meeting ID"); return; }
    setError("");
    setStatus("connecting");

    // Check if meeting exists
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

    const clientId = crypto.randomUUID();
    const pc = new RTCPeerConnection({ iceServers });
    pcRef.current = pc;

    pc.ontrack = (e) => {
      if (videoRef.current && e.streams[0]) {
        videoRef.current.srcObject = e.streams[0];
        setStatus("connected");
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
        setStatus("ended");
        toast.info("The host has ended the screen share");
      }
    };

    const ch = supabase.channel(`meeting:${mid}`, {
      config: { broadcast: { self: false } },
    });

    ch.on("broadcast", { event: "offer" }, async ({ payload }) => {
      if (payload.clientId !== clientId) return;
      await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      ch.send({ type: "broadcast", event: "answer", payload: { sdp: answer, clientId } });
    });

    ch.on("broadcast", { event: "ice-candidate" }, async ({ payload }) => {
      if (payload.from !== "host") return;
      if (payload.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
      }
    });

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        ch.send({ type: "broadcast", event: "ice-candidate", payload: { candidate: e.candidate, clientId, from: "client" } });
      }
    };

    await ch.subscribe();
    channelRef.current = ch;

    // Tell host we want to join
    ch.send({ type: "broadcast", event: "join", payload: { clientId } });
  }, [meetingId]);

  useEffect(() => {
    return () => {
      pcRef.current?.close();
      channelRef.current?.unsubscribe();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy via-[hsl(215_50%_15%)] to-[hsl(215_60%_8%)] flex flex-col">
      {/* Header */}
      <header className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-cyan flex items-center justify-center">
            <span className="text-xs font-black text-cyan-foreground">AL</span>
          </div>
          <p className="text-white/80 text-sm font-semibold">Advisor Link Online</p>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        {status === "idle" || status === "connecting" ? (
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-cyan/20 flex items-center justify-center mx-auto mb-4">
                <Monitor className="w-8 h-8 text-cyan" />
              </div>
              <h1 className="text-2xl font-bold text-white font-heading">Join Meeting</h1>
              <p className="text-white/50 text-sm mt-2">
                Please wait for your consultant to give you the meeting ID
              </p>
            </div>

            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-white/60 mb-2 block">Enter your meeting ID</label>
                <Input
                  value={meetingId}
                  onChange={(e) => setMeetingId(e.target.value)}
                  placeholder="e.g. a1b2c3d4"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/30 text-center text-lg font-mono tracking-widest h-14"
                  onKeyDown={(e) => e.key === "Enter" && joinMeeting()}
                  disabled={status === "connecting"}
                />
              </div>
              {error && <p className="text-sm text-red-400 text-center">{error}</p>}
              <Button
                className="w-full bg-cyan text-cyan-foreground hover:bg-cyan/90 h-12 text-base font-semibold"
                onClick={joinMeeting}
                disabled={status === "connecting"}
              >
                {status === "connecting" ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Connecting...</>
                ) : (
                  <><Monitor className="w-5 h-5 mr-2" /> Start Your Meeting</>
                )}
              </Button>
            </div>

            <p className="text-center text-white/30 text-xs mt-6">
              Powered by Advisor Link Online
            </p>
          </div>
        ) : status === "connected" ? (
          <div className="w-full h-full flex flex-col items-center">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full max-h-[85vh] rounded-xl bg-black shadow-2xl"
            />
            <p className="text-white/40 text-xs mt-4">You are viewing your consultant's screen</p>
          </div>
        ) : (
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-4">
              <Monitor className="w-8 h-8 text-white/40" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Meeting Ended</h2>
            <p className="text-white/50 text-sm mb-6">Your consultant has ended the screen share</p>
            <Button variant="outline" className="border-white/20 text-white hover:bg-white/10" onClick={() => { setStatus("idle"); setMeetingId(""); }}>
              Join Another Meeting
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
