import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CRMLayout } from "@/components/CRMLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Monitor, Play, Copy, StopCircle, Search, Mic, MicOff, Circle } from "lucide-react";
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
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [micOn, setMicOn] = useState(false);
  const [recorder, setRecorder] = useState<MediaRecorder | null>(null);
  const [recording, setRecording] = useState(false);
  const [chunks, setChunks] = useState<Blob[]>([]);

  // Realtime channel for signaling
  const [channel, setChannel] = useState<ReturnType<typeof supabase.channel> | null>(null);
  const [peerConnections, setPeerConnections] = useState<Map<string, RTCPeerConnection>>(new Map());

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

  const startMeeting = async () => {
    if (!selectedReport) return;
    setConfirmOpen(false);

    // Create meeting in DB
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

    // Start screen sharing
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true, // system audio if available
      });

      setStream(displayStream);

      // Listen for screen share stop
      displayStream.getVideoTracks()[0].addEventListener("ended", () => {
        endMeeting(meeting.meeting_id);
      });

      // Set up Realtime signaling channel
      const ch = supabase.channel(`meeting:${meeting.meeting_id}`, {
        config: { broadcast: { self: false } },
      });

      ch.on("broadcast", { event: "join" }, async ({ payload }) => {
        // A client wants to join — create a peer connection and send offer
        const clientId = payload.clientId as string;
        const pc = new RTCPeerConnection({ iceServers });

        // Add screen tracks to the connection
        displayStream.getTracks().forEach((track) => pc.addTrack(track, displayStream));

        pc.onicecandidate = (e) => {
          if (e.candidate) {
            ch.send({ type: "broadcast", event: "ice-candidate", payload: { candidate: e.candidate, clientId, from: "host" } });
          }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        ch.send({ type: "broadcast", event: "offer", payload: { sdp: offer, clientId } });

        setPeerConnections((prev) => new Map(prev).set(clientId, pc));
      });

      ch.on("broadcast", { event: "answer" }, async ({ payload }) => {
        const pc = peerConnections.get(payload.clientId) || [...peerConnections.values()][0];
        if (pc && payload.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        }
      });

      ch.on("broadcast", { event: "ice-candidate" }, async ({ payload }) => {
        if (payload.from === "host") return;
        const pc = peerConnections.get(payload.clientId) || [...peerConnections.values()][0];
        if (pc && payload.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        }
      });

      await ch.subscribe();
      setChannel(ch);

      // Update meeting status
      await supabase.from("meetings").update({ status: "active", started_at: new Date().toISOString() } as never).eq("id", meeting.id);
      setActiveMeeting({ ...meeting, status: "active" });
      loadData();

      toast.success("Screen sharing started! Share the meeting ID with your client.");
    } catch (e) {
      console.error("Screen share failed:", e);
      toast.error("Screen sharing was cancelled or denied");
      await supabase.from("meetings").delete().eq("id", meeting.id);
      setActiveMeeting(null);
    }
  };

  const endMeeting = async (meetingId?: string) => {
    const mid = meetingId || activeMeeting?.meeting_id;

    // Stop all streams
    stream?.getTracks().forEach((t) => t.stop());
    micStream?.getTracks().forEach((t) => t.stop());
    setStream(null);
    setMicStream(null);
    setMicOn(false);

    // Stop recorder
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    setRecorder(null);
    setRecording(false);

    // Close peer connections
    peerConnections.forEach((pc) => pc.close());
    setPeerConnections(new Map());

    // Unsubscribe channel
    if (channel) {
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

      // Remove mic tracks from all peer connections
      peerConnections.forEach((pc) => {
        const senders = pc.getSenders();
        senders.forEach((s) => {
          if (s.track?.kind === "audio" && micStream.getTracks().includes(s.track)) {
            pc.removeTrack(s);
          }
        });
      });
    } else {
      try {
        const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
        setMicStream(mic);
        setMicOn(true);

        // Add mic to all peer connections
        peerConnections.forEach((pc) => {
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

    // Combine screen + mic into one stream for recording
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
            <Monitor className="w-4 h-4" /> Start Presentation
          </Button>
        </div>

        {/* Active meeting panel */}
        {activeMeeting && (
          <div className="bg-gradient-to-r from-navy to-[hsl(215_50%_18%)] rounded-xl p-6 text-white space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-xs text-white/60 font-semibold uppercase tracking-wider">Active Meeting</p>
                <p className="text-lg font-bold mt-1">{activeMeeting.client_name}</p>
              </div>
              <div className="flex items-center gap-4">
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

            <div className="flex flex-wrap gap-3">
              <Button variant="outline" size="sm" className="border-white/20 text-white hover:bg-white/10" onClick={copyMeetingLink}>
                <Copy className="w-4 h-4 mr-1" /> Copy Join Link
              </Button>
              <Button variant="outline" size="sm" className="border-white/20 text-white hover:bg-white/10" onClick={toggleMic}>
                {micOn ? <MicOff className="w-4 h-4 mr-1" /> : <Mic className="w-4 h-4 mr-1" />}
                {micOn ? "Mute" : "Unmute"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={`border-white/20 text-white hover:bg-white/10 ${recording ? "border-red-400 text-red-300" : ""}`}
                onClick={toggleRecording}
              >
                <Circle className={`w-4 h-4 mr-1 ${recording ? "fill-red-500 text-red-500 animate-pulse" : ""}`} />
                {recording ? "Stop Recording" : "Record"}
              </Button>
              <Button variant="destructive" size="sm" onClick={() => endMeeting()}>
                <StopCircle className="w-4 h-4 mr-1" /> End Meeting
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
              Begin a screen-sharing presentation with <strong>{selectedReport?.client_name}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="bg-secondary/50 rounded-lg p-4 text-center">
            <Monitor className="w-10 h-10 mx-auto text-cyan mb-2" />
            <p className="text-sm text-muted-foreground">
              A unique meeting ID will be generated. Your client can join at:
            </p>
            <p className="text-sm font-semibold text-navy mt-1">{meetingJoinUrl}</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button className="bg-cyan text-cyan-foreground hover:bg-cyan/90 gap-2" onClick={startMeeting}>
              <Play className="w-4 h-4" /> Start Meeting
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </CRMLayout>
  );
}
