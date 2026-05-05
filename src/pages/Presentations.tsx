import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMeetingHost } from "@/hooks/useMeetingHost";
import { CRMLayout } from "@/components/CRMLayout";
import { PresentationSlideshow } from "@/components/PresentationSlideshow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Monitor, Play, Copy, StopCircle, Search, Mic, MicOff, Circle, ScreenShare, ScreenShareOff, UserCheck, UserX, Presentation } from "lucide-react";
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
  const {
    activeMeeting,
    clientConnected,
    clientCount,
    sharing,
    stream,
    micOn,
    recording,
    meetingJoinUrl,
    meetingVersion,
    startMeeting,
    startScreenShare,
    stopScreenShare,
    endMeeting,
    toggleMic,
    toggleRecording,
    copyMeetingLink,
    copyMeetingId,
  } = useMeetingHost();
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [meetings, setMeetings] = useState<MeetingRow[]>([]);
  const [search, setSearch] = useState("");
  const [selectOpen, setSelectOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ReportRow | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const hostPreviewRef = useRef<HTMLVideoElement>(null);

  const loadData = async () => {
    const [{ data: r }, { data: m }] = await Promise.all([
      supabase.from("reports").select("id, client_name, email, created_at").order("created_at", { ascending: false }),
      supabase.from("meetings").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    setReports((r as ReportRow[]) || []);
    setMeetings((m as MeetingRow[]) || []);
  };

  useEffect(() => {
    if (!profile?.is_owner) return;
    loadData();
  }, [profile?.is_owner, meetingVersion]);

  useEffect(() => {
    if (hostPreviewRef.current) {
      hostPreviewRef.current.srcObject = stream;
    }
  }, [stream]);

  const filteredReports = useMemo(() => reports.filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return r.client_name.toLowerCase().includes(q) || (r.email ?? "").toLowerCase().includes(q);
  }), [reports, search]);

  const handleSelectClient = (r: ReportRow) => {
    setSelectedReport(r);
    setSelectOpen(false);
    setConfirmOpen(true);
  };

  const handleStartMeeting = async () => {
    if (!selectedReport) return;
    setConfirmOpen(false);
    const created = await startMeeting(selectedReport);
    if (created) loadData();
  };

  const getDisplayStatus = (m: MeetingRow) => {
    if (activeMeeting && m.id === activeMeeting.id) return activeMeeting.status;
    if (m.status === "waiting" || m.status === "active") return "ended";
    return m.status;
  };

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

        {activeMeeting && (
          <div className="bg-gradient-to-r from-navy to-primary rounded-xl p-6 text-navy-foreground space-y-5">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <p className="text-xs text-navy-foreground/60 font-semibold uppercase tracking-wider">Active Meeting</p>
                <p className="text-lg font-bold mt-1">{activeMeeting.client_name}</p>
                <p className="text-xs text-navy-foreground/50 mt-1">
                  {sharing ? "Your screen is live" : "Meeting room is ready — share your screen when you are ready"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-2">
                  {clientConnected ? (
                    <>
                      <div className="w-3 h-3 rounded-full bg-online animate-pulse" />
                      <UserCheck className="w-4 h-4 text-online" />
                      <span className="text-sm font-semibold text-online">
                        {clientCount === 1 ? "Client Connected" : `${clientCount} Clients Connected`}
                      </span>
                    </>
                  ) : (
                    <>
                      <div className="w-3 h-3 rounded-full bg-navy-foreground/30" />
                      <UserX className="w-4 h-4 text-navy-foreground/40" />
                      <span className="text-sm font-medium text-navy-foreground/40">Waiting for client...</span>
                    </>
                  )}
                </div>
                <div className="text-center">
                  <p className="text-xs text-navy-foreground/60 mb-1">Meeting ID</p>
                  <button
                    onClick={copyMeetingId}
                    className="font-mono text-xl font-bold tracking-widest bg-navy-foreground/10 rounded-lg px-4 py-2 hover:bg-navy-foreground/20 transition"
                  >
                    {activeMeeting.meeting_id}
                  </button>
                </div>
              </div>
            </div>

            {sharing && stream && (
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_260px] gap-4 items-stretch">
                <div className="rounded-lg overflow-hidden bg-background/10 border border-navy-foreground/10 min-h-[220px]">
                  <video
                    ref={hostPreviewRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full max-h-[360px] object-contain bg-foreground"
                  />
                </div>
                <div className="rounded-lg bg-navy-foreground/10 border border-navy-foreground/10 p-4 flex flex-col justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-navy-foreground/60">Host Preview</p>
                    <p className="text-sm mt-2 text-navy-foreground/80">This is the screen your client can see after entering the meeting ID.</p>
                  </div>
                  <div className="text-sm font-semibold text-online flex items-center gap-2">
                    <Circle className="w-3 h-3 fill-current animate-pulse" />
                    Live Screen Share
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              {!sharing ? (
                <Button className="bg-cyan text-cyan-foreground hover:bg-cyan/90 h-10 px-5 text-sm font-semibold" onClick={startScreenShare}>
                  <ScreenShare className="w-4 h-4 mr-2" />
                  <span>Share Screen</span>
                </Button>
              ) : (
                <Button className="bg-secondary text-secondary-foreground hover:bg-secondary/90 h-10 px-5 text-sm font-semibold" onClick={stopScreenShare}>
                  <ScreenShareOff className="w-4 h-4 mr-2" />
                  <span>Stop Sharing</span>
                </Button>
              )}

              <Button className="bg-navy-foreground/10 border border-navy-foreground/20 text-navy-foreground hover:bg-navy-foreground/20 h-10 px-4 text-sm font-medium" onClick={copyMeetingLink}>
                <Copy className="w-4 h-4 mr-2" />
                <span>Copy Join Link</span>
              </Button>
              <Button className="bg-navy-foreground/10 border border-navy-foreground/20 text-navy-foreground hover:bg-navy-foreground/20 h-10 px-4 text-sm font-medium" onClick={copyMeetingId}>
                <Copy className="w-4 h-4 mr-2" />
                <span>Copy Meeting ID</span>
              </Button>
              <Button className={`bg-navy-foreground/10 border border-navy-foreground/20 text-navy-foreground hover:bg-navy-foreground/20 h-10 px-4 text-sm font-medium ${micOn ? "bg-online/30 border-online/50" : ""}`} onClick={toggleMic}>
                {micOn ? <MicOff className="w-4 h-4 mr-2" /> : <Mic className="w-4 h-4 mr-2" />}
                <span>{micOn ? "Mute Mic" : "Unmute Mic"}</span>
              </Button>
              <Button
                className={`bg-navy-foreground/10 border border-navy-foreground/20 text-navy-foreground hover:bg-navy-foreground/20 h-10 px-4 text-sm font-medium ${recording ? "bg-destructive/30 border-destructive/50 text-destructive-foreground" : ""}`}
                onClick={toggleRecording}
                disabled={!sharing}
              >
                <Circle className={`w-4 h-4 mr-2 ${recording ? "fill-destructive text-destructive animate-pulse" : ""}`} />
                <span>{recording ? "Stop Recording" : "Start Recording"}</span>
              </Button>
              <Button className="bg-destructive text-destructive-foreground hover:bg-destructive/90 h-10 px-4 text-sm font-medium" onClick={endMeeting}>
                <StopCircle className="w-4 h-4 mr-2" />
                <span>End Meeting</span>
              </Button>
            </div>

            <p className="text-xs text-navy-foreground/50">
              Share this link with your client: <span className="text-cyan font-medium break-all">{meetingJoinUrl}</span> — they'll enter the meeting ID to see your screen.
            </p>
          </div>
        )}

        <div className="bg-card rounded-xl shadow-elevated p-6">
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
                  {meetings.map((m) => {
                    const displayStatus = getDisplayStatus(m);
                    return (
                      <tr key={m.id} className="border-b border-border/50">
                        <td className="py-2 pr-4 font-medium">{m.client_name}</td>
                        <td className="py-2 pr-4 font-mono text-xs">{m.meeting_id}</td>
                        <td className="py-2 pr-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            displayStatus === "active" ? "bg-online/15 text-online" :
                            displayStatus === "waiting" ? "bg-cyan/15 text-cyan" :
                            "bg-muted text-muted-foreground"
                          }`}>{displayStatus}</span>
                        </td>
                        <td className="py-2 text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

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
            <p className="text-sm font-semibold text-navy mt-1 break-all">{meetingJoinUrl}</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button className="bg-cyan text-cyan-foreground hover:bg-cyan/90 gap-2" onClick={handleStartMeeting}>
              <Play className="w-4 h-4" />
              <span>Start Meeting</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </CRMLayout>
  );
}
