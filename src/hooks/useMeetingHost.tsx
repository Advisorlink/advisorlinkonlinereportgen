import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface MeetingRow {
  id: string;
  meeting_id: string;
  client_name: string;
  status: string;
  created_at: string;
}

interface StartMeetingInput {
  id: string;
  client_name: string;
  email: string | null;
}

interface MeetingHostContextValue {
  activeMeeting: MeetingRow | null;
  clientConnected: boolean;
  clientCount: number;
  sharing: boolean;
  screenSharePaused: boolean;
  stream: MediaStream | null;
  micOn: boolean;
  recording: boolean;
  meetingJoinUrl: string;
  meetingVersion: number;
  pausedSlide: number | null;
  setPausedSlide: (slide: number | null) => void;
  startMeeting: (report: StartMeetingInput) => Promise<boolean>;
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => void;
  togglePauseScreenShare: () => void;
  endMeeting: () => Promise<void>;
  toggleMic: () => Promise<void>;
  toggleRecording: () => void;
  copyMeetingLink: () => void;
  copyMeetingId: () => void;
}

const MeetingHostContext = createContext<MeetingHostContextValue | null>(null);

const iceServers = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  {
    urls: "turn:openrelay.metered.ca:80",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:443",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:443?transport=tcp",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
];

export function MeetingHostProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [activeMeeting, setActiveMeeting] = useState<MeetingRow | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [sharing, setSharing] = useState(false);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [micOn, setMicOn] = useState(false);
  const [recorder, setRecorder] = useState<MediaRecorder | null>(null);
  const [recording, setRecording] = useState(false);
  const [clientCount, setClientCount] = useState(0);
  const [meetingVersion, setMeetingVersion] = useState(0);
  const [pausedSlide, setPausedSlide] = useState<number | null>(null);
  const [screenSharePaused, setScreenSharePaused] = useState(false);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const streamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const activeMeetingRef = useRef<MeetingRow | null>(null);
  const clientsRef = useRef<Set<string>>(new Set());

  const bumpMeetingVersion = () => setMeetingVersion((v) => v + 1);

  const updateActiveMeeting = useCallback((meeting: MeetingRow | null) => {
    activeMeetingRef.current = meeting;
    setActiveMeeting(meeting);
  }, []);

  const cleanupPeerConnections = useCallback(() => {
    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current = new Map();
  }, []);

  const stopScreenShare = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
    setSharing(false);
    setScreenSharePaused(false);
    cleanupPeerConnections();
    toast.info("Screen sharing stopped");
  }, [cleanupPeerConnections]);

  const setupPeerConnection = useCallback((ch: ReturnType<typeof supabase.channel>, clientId: string, displayStream: MediaStream) => {
    const existing = peerConnectionsRef.current.get(clientId);
    existing?.close();

    const pc = new RTCPeerConnection({ iceServers });
    displayStream.getTracks().forEach((track) => pc.addTrack(track, displayStream));
    micStreamRef.current?.getAudioTracks().forEach((track) => pc.addTrack(track, micStreamRef.current!));

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        ch.send({ type: "broadcast", event: "ice-candidate", payload: { candidate: event.candidate, clientId, from: "host" } });
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "closed") {
        peerConnectionsRef.current.delete(clientId);
      }
    };

    pc.createOffer().then(async (offer) => {
      await pc.setLocalDescription(offer);
      ch.send({ type: "broadcast", event: "offer", payload: { sdp: offer, clientId } });
    });

    peerConnectionsRef.current.set(clientId, pc);
  }, []);

  const setupSignalingChannel = useCallback((meeting: MeetingRow) => {
    if (channelRef.current) supabase.removeChannel(channelRef.current);

    clientsRef.current = new Set();
    setClientCount(0);

    const ch = supabase.channel(`meeting:${meeting.meeting_id}`, {
      config: {
        broadcast: { self: false },
        presence: { key: `host-${profile?.id ?? "host"}` },
      },
    });

    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState();
      const clients = new Set<string>();
      Object.values(state).flat().forEach((presence) => {
        const p = presence as { role?: string; clientId?: string };
        if (p.role === "client" && p.clientId) clients.add(p.clientId);
      });
      clientsRef.current = clients;
      setClientCount(clients.size);
    });

    ch.on("broadcast", { event: "join" }, async ({ payload }) => {
      const clientId = payload.clientId as string;
      clientsRef.current.add(clientId);
      setClientCount(clientsRef.current.size);
      if (streamRef.current) setupPeerConnection(ch, clientId, streamRef.current);
    });

    ch.on("broadcast", { event: "answer" }, async ({ payload }) => {
      const pc = peerConnectionsRef.current.get(payload.clientId) || [...peerConnectionsRef.current.values()][0];
      if (pc && payload.sdp) await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
    });

    ch.on("broadcast", { event: "ice-candidate" }, async ({ payload }) => {
      if (payload.from === "host") return;
      const pc = peerConnectionsRef.current.get(payload.clientId) || [...peerConnectionsRef.current.values()][0];
      if (pc && payload.candidate) await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
    });

    ch.on("broadcast", { event: "leave" }, ({ payload }) => {
      if (payload.clientId) {
        clientsRef.current.delete(payload.clientId);
        setClientCount(clientsRef.current.size);
      }
    });

    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") await ch.track({ role: "host" });
    });

    channelRef.current = ch;
  }, [profile?.id, setupPeerConnection]);

  const cleanStaleMeetings = useCallback(async () => {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await supabase
      .from("meetings")
      .update({ status: "ended", ended_at: new Date().toISOString() } as never)
      .in("status", ["waiting", "active"])
      .lt("created_at", cutoff);
  }, []);

  const restoreActiveMeeting = useCallback(async () => {
    if (!profile?.is_owner) return;
    const { data } = await supabase
      .from("meetings")
      .select("*")
      .eq("host_user_id", profile.id)
      .in("status", ["waiting", "active"])
      .order("created_at", { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      const meeting = data[0] as MeetingRow;
      updateActiveMeeting(meeting);
      setupSignalingChannel(meeting);
    }
  }, [profile, setupSignalingChannel, updateActiveMeeting]);

  useEffect(() => {
    if (!profile?.is_owner) return;
    cleanStaleMeetings().then(restoreActiveMeeting);
  }, [profile?.id, profile?.is_owner, cleanStaleMeetings, restoreActiveMeeting]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      micStreamRef.current?.getTracks().forEach((track) => track.stop());
      cleanupPeerConnections();
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [cleanupPeerConnections]);

  const startMeeting = useCallback(async (report: StartMeetingInput) => {
    if (!profile?.id) return false;

    const isGuest = report.id.startsWith("guest-");
    const { data, error } = await supabase.from("meetings").insert({
      host_user_id: profile.id,
      report_id: isGuest ? null : report.id,
      client_name: report.client_name,
      client_email: report.email,
      status: "waiting",
    } as never).select().single();

    if (error || !data) {
      toast.error("Failed to create meeting");
      return false;
    }

    const meeting = data as MeetingRow;
    updateActiveMeeting(meeting);
    setClientCount(0);
    setSharing(false);
    setupSignalingChannel(meeting);
    await supabase.from("meetings").update({ status: "waiting", started_at: new Date().toISOString() } as never).eq("id", meeting.id);
    bumpMeetingVersion();
    toast.success("Meeting created! Share the meeting ID with your client.");
    return true;
  }, [profile?.id, setupSignalingChannel, updateActiveMeeting]);

  const startScreenShare = useCallback(async () => {
    const meeting = activeMeetingRef.current;
    if (!meeting || !channelRef.current) return;

    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      streamRef.current = displayStream;
      setStream(displayStream);
      setSharing(true);

      displayStream.getVideoTracks()[0]?.addEventListener("ended", () => stopScreenShare(), { once: true });

      await supabase.from("meetings").update({ status: "active" } as never).eq("id", meeting.id);
      updateActiveMeeting({ ...meeting, status: "active" });
      bumpMeetingVersion();

      await channelRef.current.send({ type: "broadcast", event: "screen-ready", payload: {} });
      clientsRef.current.forEach((clientId) => setupPeerConnection(channelRef.current!, clientId, displayStream));

      toast.success("Screen sharing started!");
    } catch (error) {
      console.error("Screen share failed:", error);
      toast.error("Screen sharing was cancelled or denied");
    }
  }, [setupPeerConnection, stopScreenShare, updateActiveMeeting]);

  const endMeeting = useCallback(async () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    micStreamRef.current = null;
    setStream(null);
    setMicStream(null);
    setMicOn(false);
    setSharing(false);
    setClientCount(0);

    if (recorder && recorder.state !== "inactive") recorder.stop();
    setRecorder(null);
    setRecording(false);
    cleanupPeerConnections();

    if (channelRef.current) {
      await channelRef.current.send({ type: "broadcast", event: "meeting-ended", payload: {} });
      await supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const meeting = activeMeetingRef.current;
    if (meeting) await supabase.from("meetings").update({ status: "ended", ended_at: new Date().toISOString() } as never).eq("id", meeting.id);
    updateActiveMeeting(null);
    bumpMeetingVersion();
    toast.info("Meeting ended");
  }, [cleanupPeerConnections, recorder, updateActiveMeeting]);

  const toggleMic = useCallback(async () => {
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
      setMicStream(null);
      setMicOn(false);
      peerConnectionsRef.current.forEach((pc) => {
        pc.getSenders().forEach((sender) => {
          if (sender.track?.kind === "audio") pc.removeTrack(sender);
        });
      });
      return;
    }

    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = mic;
      setMicStream(mic);
      setMicOn(true);
      peerConnectionsRef.current.forEach((pc) => mic.getTracks().forEach((track) => pc.addTrack(track, mic)));
    } catch {
      toast.error("Microphone access denied");
    }
  }, []);

  const toggleRecording = useCallback(() => {
    if (recording && recorder) {
      recorder.stop();
      setRecording(false);
      return;
    }

    if (!streamRef.current) {
      toast.error("No screen share active");
      return;
    }

    const tracks = [...streamRef.current.getTracks()];
    if (micStreamRef.current) tracks.push(...micStreamRef.current.getAudioTracks());
    const combined = new MediaStream(tracks);
    const recordedChunks: Blob[] = [];
    const mr = new MediaRecorder(combined, { mimeType: "video/webm" });

    mr.ondataavailable = (event) => {
      if (event.data.size > 0) recordedChunks.push(event.data);
    };
    mr.onstop = () => {
      const meeting = activeMeetingRef.current;
      const blob = new Blob(recordedChunks, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `Meeting-${meeting?.meeting_id || "recording"}-${new Date().toISOString().slice(0, 10)}.webm`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success("Recording downloaded!");
    };

    mr.start();
    setRecorder(mr);
    setRecording(true);
    toast.success("Recording started");
  }, [recorder, recording]);

  const meetingJoinUrl = `${window.location.origin}/meeting/join`;

  const copyMeetingLink = useCallback(() => {
    navigator.clipboard.writeText(meetingJoinUrl);
    toast.success("Meeting join link copied!");
  }, [meetingJoinUrl]);

  const copyMeetingId = useCallback(() => {
    const meeting = activeMeetingRef.current;
    if (!meeting) return;
    navigator.clipboard.writeText(meeting.meeting_id);
    toast.success("Meeting ID copied!");
  }, []);

  const togglePauseScreenShare = useCallback(() => {
    if (!streamRef.current) return;
    const videoTrack = streamRef.current.getVideoTracks()[0];
    if (!videoTrack) return;
    const newPaused = !screenSharePaused;
    videoTrack.enabled = !newPaused;
    setScreenSharePaused(newPaused);
    toast.info(newPaused ? "Screen share paused - client sees last frame" : "Screen share resumed");
  }, [screenSharePaused]);

  const value = useMemo<MeetingHostContextValue>(() => ({
    activeMeeting,
    clientConnected: clientCount > 0,
    clientCount,
    sharing,
    screenSharePaused,
    stream,
    micOn,
    recording,
    meetingJoinUrl,
    meetingVersion,
    pausedSlide,
    setPausedSlide,
    startMeeting,
    startScreenShare,
    stopScreenShare,
    togglePauseScreenShare,
    endMeeting,
    toggleMic,
    toggleRecording,
    copyMeetingLink,
    copyMeetingId,
  }), [activeMeeting, clientCount, sharing, screenSharePaused, stream, micOn, recording, meetingJoinUrl, meetingVersion, pausedSlide, startMeeting, startScreenShare, stopScreenShare, togglePauseScreenShare, endMeeting, toggleMic, toggleRecording, copyMeetingLink, copyMeetingId]);

  return <MeetingHostContext.Provider value={value}>{children}</MeetingHostContext.Provider>;
}

export function useMeetingHost() {
  const ctx = useContext(MeetingHostContext);
  if (!ctx) throw new Error("useMeetingHost must be used inside MeetingHostProvider");
  return ctx;
}