import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CRMLayout } from "@/components/CRMLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Monitor, Play, Copy, StopCircle, Search, Mic, MicOff, Circle, ScreenShare, ScreenShareOff, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface ReportRow {
  id: string;
  client_name: string;
  email: string | null;
  created_at: string;
}

interface MeetingRow {
  id: string;
  meeting_id: string;
  client_name: string;
  status: string;
  created_at: string;
}

export default function Presentations() {
  const { profile } = useAuth();
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [meetings, setMeetings] = useState<MeetingRow[]>([]);
  const [search, setSearch] = useState("");
  const [selectOpen, setSelectOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ReportRow | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [activeMeeting, setActiveMeeting] = useState<MeetingRow | null>(null);

  // Screen share / recording state
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [sharing, setSharing] = useState(false);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [micOn, setMicOn] = useState(false);
  const [recorder, setRecorder] = useState<MediaRecorder | null>(null);
  const [recording, setRecording] = useState(false);
  const [chunks, setChunks] = useState<Blob[]>([]);

  // Client connected state
  const [clientConnected, setClientConnected] = useState(false);

  // Realtime channel for signaling
  const [channel, setChannel] = useState<ReturnType<typeof supabase.channel> | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const streamRef = useRef<MediaStream | null>(null);

  const iceServers = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ];

  useEffect(() => {
    if (!profile?.is_owner) return;
    loadData();
  }, [profile]);

  const loadData = async () => {
    const [{ data: r }, { data: m }] = await Promise.all([
      supabase.from("reports").select("id, client_name, email, created_at").order("created_at", { ascending: false }),
      supabase.from("meetings").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    setReports((r as ReportRow[]) || []);
    setMeetings((m as MeetingRow[]) || []);
  };

  const filteredReports = reports.filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return r.client_name.toLowerCase().includes(q) || (r.email ?? "").toLowerCase().includes(q);
  });

  const handleSelectClient = (r: ReportRow) => {
    setSelectedReport(r);
    setSelectOpen(false);
    setConfirmOpen(true);
  };

  // Step 1: Start meeting — just creates DB record + signaling channel (NO screen share yet)
  const startMeeting = async () => {
    if (!selectedReport) return;
    setConfirmOpen(false);

    const { data, error } = await supabase.from("meetings").insert({
      host_user_id: profile!.id,
      report_id: selectedReport.id,
      client_name: selectedReport.client_name,
      client_email: selectedReport.email,
      status: "waiting",
    } as never).select().single();

    if (error || !data) {
      toast.error("Failed to create meeting");
      return;
    }

    const meeting = data as MeetingRow;
    setActiveMeeting(meeting);
    setClientConnected(false);
    setSharing(false);

    // Set up Realtime signaling channel
    const ch = supabase.channel(`meeting:${meeting.meeting_id}`, {
      config: { broadcast: { self: false } },
    });

    ch.on("broadcast", { event: "join" }, async ({ payload }) => {
      const clientId = payload.clientId as string;
      setClientConnected(true);
      toast.success("Client has joined the meeting!");

      // If screen is already being shared, set up WebRTC for this client
      const currentStream = streamRef.current;
      if (currentStream) {
        setupPeerConnection(ch, clientId, currentStream);
      }
    });

    ch.on("broadcast", { event: "answer" }, async ({ payload }) => {
      const pcs = peerConnectionsRef.current;
      const pc = pcs.get(payload.clientId) || [...pcs.values()][0];
      if (pc && payload.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      }
    });

    ch.on("broadcast", { event: "ice-candidate" }, async ({ payload }) => {
      if (payload.from === "host") return;
      const pcs = peerConnectionsRef.current;
      const pc = pcs.get(payload.clientId) || [...pcs.values()][0];
      if (pc && payload.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
      }
    });

    ch.on("broadcast", { event: "leave" }, () => {
      setClientConnected(false);
      toast.info("Client has left the meeting");
    });

    await ch.subscribe();
    setChannel(ch);

    await supabase.from("meetings").update({ status: "waiting", started_at: new Date().toISOString() } as never).eq("id", meeting.id);
    loadData();

    toast.success("Meeting created! Share the meeting ID with your client.");
  };

  const setupPeerConnection = (ch: ReturnType<typeof supabase.channel>, clientId: string, displayStream: MediaStream) => {
    const pc = new RTCPeerConnection({ iceServers });

    displayStream.getTracks().forEach((track) => pc.addTrack(track, displayStream));

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        ch.send({ type: "broadcast", event: "ice-candidate", payload: { candidate: e.candidate, clientId, from: "host" } });
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
        setClientConnected(false);
      }
    };

    pc.createOffer().then(async (offer) => {
      await pc.setLocalDescription(offer);
      ch.send({ type: "broadcast", event: "offer", payload: { sdp: offer, clientId } });
    });

    peerConnectionsRef.current.set(clientId, pc);
  };

  // Step 2: Share screen — triggered by a separate button
  const startScreenShare = async () => {
    if (!activeMeeting || !channel) return;

    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      setStream(displayStream);
      streamRef.current = displayStream;
      setSharing(true);

      displayStream.getVideoTracks()[0].addEventListener("ended", () => {
        stopScreenShare();
      });

      // Update meeting status to active
      await supabase.from("meetings").update({ status: "active" } as never).eq("id", activeMeeting.id);
      setActiveMeeting((prev) => prev ? { ...prev, status: "active" } : null);
      loadData();

      // If a client is already connected, set up peer connections
      // The client will re-join via broadcast, which will trigger setupPeerConnection
      // Notify any connected clients to re-join to pick up the stream
      channel.send({ type: "broadcast", event: "screen-ready", payload: {} });

      toast.success("Screen sharing started!");
    } catch (e) {
      console.error("Screen share failed:", e);
      toast.error("Screen sharing was cancelled or denied");
    }
  };

  const stopScreenShare = () => {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
    streamRef.current = null;
    setSharing(false);

    // Close peer connections (clients will see stream end)
    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current = new Map();

    toast.info("Screen sharing stopped");
  };

  const endMeeting = async () => {
    // Stop all streams
    stream?.getTracks().forEach((t) => t.stop());
    micStream?.getTracks().forEach((t) => t.stop());
    setStream(null);
    streamRef.current = null;
    setMicStream(null);
    setMicOn(false);
    setSharing(false);
    setClientConnected(false);

    // Stop recorder
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    setRecorder(null);
    setRecording(false);

    // Close peer connections
    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current = new Map();

    // Notify clients
    if (channel) {
      channel.send({ type: "broadcast", event: "meeting-ended", payload: {} });
      await channel.unsubscribe();
      setChannel(null);
    }

    // Update DB
    if (activeMeeting) {
      await supabase.from("meetings").update({ status: "ended", ended_at: new Date().toISOString() } as never).eq("id", activeMeeting.id);
    }

    setActiveMeeting(null);
    loadData();
    toast.info("Meeting ended");
  };

  const toggleMic = async () => {
    if (micOn && micStream) {
      micStream.getTracks().forEach((t) => t.stop());
      setMicStream(null);
      setMicOn(false);

      peerConnectionsRef.current.forEach((pc) => {
        const senders = pc.getSenders();
        senders.forEach((s) => {
          if (s.track?.kind === "audio") {
            pc.removeTrack(s);
          }
        });
      });
    } else {
      try {
        const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
        setMicStream(mic);
        setMicOn(true);

        peerConnectionsRef.current.forEach((pc) => {
          mic.getTracks().forEach((t) => pc.addTrack(t, mic));
        });
      } catch {
        toast.error("Microphone access denied");
      }
    }
  };

  const toggleRecording = () => {
    if (recording && recorder) {
      recorder.stop();
      setRecording(false);
      return;
    }

    if (!stream) {
      toast.error("No screen share active");
      return;
    }

    const tracks = [...stream.getTracks()];
    if (micStream) tracks.push(...micStream.getAudioTracks());
    const combined = new MediaStream(tracks);

    const newChunks: Blob[] = [];
    const mr = new MediaRecorder(combined, { mimeType: "video/webm" });
    mr.ondataavailable = (e) => { if (e.data.size > 0) newChunks.push(e.data); };
    mr.onstop = () => {
      const blob = new Blob(newChunks, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Meeting-${activeMeeting?.meeting_id || "recording"}-${new Date().toISOString().slice(0, 10)}.webm`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Recording downloaded!");
    };
    mr.start();
    setRecorder(mr);
    setChunks(newChunks);
    setRecording(true);
    toast.success("Recording started");
  };

  const copyMeetingLink = () => {
    if (!activeMeeting) return;
    const url = `${window.location.origin}/meeting/join`;
    navigator.clipboard.writeText(url);
    toast.success("Meeting join link copied!");
  };

  const copyMeetingId = () => {
    if (!activeMeeting) return;
    navigator.clipboard.writeText(activeMeeting.meeting_id);
    toast.success("Meeting ID copied!");
  };

  const meetingJoinUrl = `${window.location.origin}/meeting/join`;

  return (
    <CRMLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold font-heading text-navy">Presentations</h1>
            <p className="text-sm text-muted-foreground mt-1">Screen share with clients in real-time</p>
          </div>
          <Button
            className="bg-cyan text-cyan-foreground hover:bg-cyan/90 gap-2"
            onClick={() => setSelectOpen(true)}
            disabled={!!activeMeeting}
          >
            <Monitor className="w-4 h-4" />
            <span>Start Presentation</span>
          </Button>
        </div>

        {/* Active meeting panel */}
        {activeMeeting && (
          <div className="bg-gradient-to-r from-navy to-[hsl(215_50%_18%)] rounded-xl p-6 text-white space-y-5">
            {/* Top row: client info + meeting ID + client status */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-xs text-white/60 font-semibold uppercase tracking-wider">Active Meeting</p>
                <p className="text-lg font-bold mt-1">{activeMeeting.client_name}</p>
              </div>
              <div className="flex items-center gap-6">
                {/* Client status indicator */}
                <div className="flex items-center gap-2">
                  {clientConnected ? (
                    <>
                      <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                      <UserCheck className="w-4 h-4 text-emerald-400" />
                      <span className="text-sm font-semibold text-emerald-400">Client Connected</span>
                    </>
                  ) : (
                    <>
                      <div className="w-3 h-3 rounded-full bg-white/30" />
                      <UserX className="w-4 h-4 text-white/40" />
                      <span className="text-sm font-medium text-white/40">Waiting for client...</span>
                    </>
                  )}
                </div>
                {/* Meeting ID */}
                <div className="text-center">
                  <p className="text-xs text-white/60 mb-1">Meeting ID</p>
                  <button
                    onClick={copyMeetingId}
                    className="font-mono text-xl font-bold tracking-widest bg-white/10 rounded-lg px-4 py-2 hover:bg-white/20 transition"
                  >
                    {activeMeeting.meeting_id}
                  </button>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap gap-3">
              {/* Share / Stop Share Screen button */}
              {!sharing ? (
                <Button className="bg-cyan text-cyan-foreground hover:bg-cyan/90 h-10 px-5 text-sm font-semibold" onClick={startScreenShare}>
                  <ScreenShare className="w-4 h-4 mr-2" />
                  <span>Share Screen</span>
                </Button>
              ) : (
                <Button className="bg-amber-600 text-white hover:bg-amber-700 h-10 px-5 text-sm font-semibold" onClick={stopScreenShare}>
                  <ScreenShareOff className="w-4 h-4 mr-2" />
                  <span>Stop Sharing</span>
                </Button>
              )}

              <Button className="bg-white/10 border border-white/20 text-white hover:bg-white/20 h-10 px-4 text-sm font-medium" onClick={copyMeetingLink}>
                <Copy className="w-4 h-4 mr-2" />
                <span>Copy Join Link</span>
              </Button>
              <Button className="bg-white/10 border border-white/20 text-white hover:bg-white/20 h-10 px-4 text-sm font-medium" onClick={copyMeetingId}>
                <Copy className="w-4 h-4 mr-2" />
                <span>Copy Meeting ID</span>
              </Button>
              <Button className={`bg-white/10 border border-white/20 text-white hover:bg-white/20 h-10 px-4 text-sm font-medium ${micOn ? "bg-emerald-600/30 border-emerald-400/50" : ""}`} onClick={toggleMic}>
                {micOn ? <MicOff className="w-4 h-4 mr-2" /> : <Mic className="w-4 h-4 mr-2" />}
                <span>{micOn ? "Mute Mic" : "Unmute Mic"}</span>
              </Button>
              <Button
                className={`bg-white/10 border border-white/20 text-white hover:bg-white/20 h-10 px-4 text-sm font-medium ${recording ? "bg-red-600/30 border-red-400/50 text-red-200" : ""}`}
                onClick={toggleRecording}
                disabled={!sharing}
              >
                <Circle className={`w-4 h-4 mr-2 ${recording ? "fill-red-500 text-red-500 animate-pulse" : ""}`} />
                <span>{recording ? "Stop Recording" : "Start Recording"}</span>
              </Button>
              <Button className="bg-red-600 text-white hover:bg-red-700 h-10 px-4 text-sm font-medium" onClick={endMeeting}>
                <StopCircle className="w-4 h-4 mr-2" />
                <span>End Meeting</span>
              </Button>
            </div>

            <p className="text-xs text-white/50">
              Share this link with your client: <span className="text-cyan font-medium">{meetingJoinUrl}</span> — they'll enter the meeting ID to see your screen.
            </p>
          </div>
        )}

        {/* Past meetings */}
        <div className="bg-white rounded-xl shadow-elevated p-6">
          <h2 className="text-lg font-bold font-heading text-navy mb-4">Meeting History</h2>
          {meetings.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No meetings yet. Start your first presentation!</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-border">
                    <th className="py-2 pr-4 font-semibold text-muted-foreground">Client</th>
                    <th className="py-2 pr-4 font-semibold text-muted-foreground">Meeting ID</th>
                    <th className="py-2 pr-4 font-semibold text-muted-foreground">Status</th>
                    <th className="py-2 font-semibold text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {meetings.map((m) => (
                    <tr key={m.id} className="border-b border-border/50">
                      <td className="py-2 pr-4 font-medium">{m.client_name}</td>
                      <td className="py-2 pr-4 font-mono text-xs">{m.meeting_id}</td>
                      <td className="py-2 pr-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          m.status === "active" ? "bg-emerald-100 text-emerald-700" :
                          m.status === "waiting" ? "bg-amber-100 text-amber-700" :
                          "bg-muted text-muted-foreground"
                        }`}>{m.status}</span>
                      </td>
                      <td className="py-2 text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Select client dialog */}
      <Dialog open={selectOpen} onOpenChange={setSelectOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-navy font-heading">Select Client</DialogTitle>
            <DialogDescription>Choose a client to present to</DialogDescription>
          </DialogHeader>
          <div className="relative mb-3">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search clients..." className="pl-9" />
          </div>
          <div className="max-h-[300px] overflow-y-auto space-y-1">
            {filteredReports.map((r) => (
              <button
                key={r.id}
                onClick={() => handleSelectClient(r)}
                className="w-full text-left px-4 py-3 rounded-lg hover:bg-secondary/50 transition flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-navy">{r.client_name}</p>
                  <p className="text-xs text-muted-foreground">{r.email || "No email"}</p>
                </div>
                <p className="text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</p>
              </button>
            ))}
            {filteredReports.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No clients found</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm start meeting dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-navy font-heading">Start Meeting</DialogTitle>
            <DialogDescription>
              Create a meeting room for <strong>{selectedReport?.client_name}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="bg-secondary/50 rounded-lg p-4 text-center">
            <Monitor className="w-10 h-10 mx-auto text-cyan mb-2" />
            <p className="text-sm text-muted-foreground">
              A unique meeting ID will be generated. You can share your screen when you're ready.
            </p>
            <p className="text-sm font-semibold text-navy mt-1">{meetingJoinUrl}</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button className="bg-cyan text-cyan-foreground hover:bg-cyan/90 gap-2" onClick={startMeeting}>
              <Play className="w-4 h-4" />
              <span>Start Meeting</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </CRMLayout>
  );
}
