import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useMeetingHost } from "@/hooks/useMeetingHost";
import { Circle, Copy, Monitor, Presentation, ScreenShare, ScreenShareOff, StopCircle, UserCheck, UserX } from "lucide-react";

export function MeetingHostDock() {
  const navigate = useNavigate();
  const {
    activeMeeting,
    clientConnected,
    clientCount,
    sharing,
    pausedSlide,
    setPausedSlide,
    startScreenShare,
    stopScreenShare,
    endMeeting,
    copyMeetingId,
  } = useMeetingHost();

  if (!activeMeeting) return null;

  return (
    <section className="border-b border-border bg-navy text-navy-foreground px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button onClick={() => navigate("/presentations")} className="flex min-w-0 items-center gap-3 text-left">
          <div className="w-9 h-9 rounded-lg bg-cyan/20 flex items-center justify-center shrink-0">
            <Monitor className="w-5 h-5 text-cyan" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold truncate">{activeMeeting.client_name}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-navy-foreground/65">
              <span className="font-mono font-semibold text-navy-foreground">ID {activeMeeting.meeting_id}</span>
              <span className="flex items-center gap-1">
                <Circle className={`w-2.5 h-2.5 ${sharing ? "fill-online text-online" : "fill-muted-foreground text-muted-foreground"}`} />
                {sharing ? "Sharing screen" : "Ready to share"}
              </span>
              <span className={`flex items-center gap-1 ${clientConnected ? "text-online" : "text-navy-foreground/45"}`}>
                {clientConnected ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
                {clientConnected ? (clientCount === 1 ? "Client connected" : `${clientCount} clients connected`) : "Waiting for client"}
              </span>
            </div>
          </div>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {pausedSlide != null && (
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-3 text-xs animate-pulse"
              onClick={() => {
                const slide = pausedSlide;
                setPausedSlide(null);
                navigate("/presentations", { state: { resumeSlide: slide } });
              }}
            >
              <Presentation className="w-3.5 h-3.5 mr-1" />
              <span>Resume Presentation</span>
            </Button>
          )}
          <Button className="bg-navy-foreground/10 border border-navy-foreground/20 text-navy-foreground hover:bg-navy-foreground/20 h-9 px-3 text-xs" onClick={copyMeetingId}>
            <Copy className="w-3.5 h-3.5 mr-1" />
            <span>Copy ID</span>
          </Button>
          {sharing ? (
            <Button className="bg-secondary text-secondary-foreground hover:bg-secondary/90 h-9 px-3 text-xs" onClick={stopScreenShare}>
              <ScreenShareOff className="w-3.5 h-3.5 mr-1" />
              <span>Stop Sharing</span>
            </Button>
          ) : (
            <Button className="bg-cyan text-cyan-foreground hover:bg-cyan/90 h-9 px-3 text-xs" onClick={startScreenShare}>
              <ScreenShare className="w-3.5 h-3.5 mr-1" />
              <span>Share Screen</span>
            </Button>
          )}
          <Button className="bg-destructive text-destructive-foreground hover:bg-destructive/90 h-9 px-3 text-xs" onClick={endMeeting}>
            <StopCircle className="w-3.5 h-3.5 mr-1" />
            <span>End</span>
          </Button>
        </div>
      </div>
    </section>
  );
}