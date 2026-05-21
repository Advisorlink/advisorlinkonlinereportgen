import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Circle, Maximize, Minimize, Pause, Play, X } from "lucide-react";

const SLIDE_SRCS = [
  "/slides/slide-01.jpg",
  "/slides/slide-02.jpg",
  "/slides/slide-03.jpg",
  "/slides/slide-04.jpg",
  "/slides/slide-05.jpg",
  "/slides/slide-06.jpg",
  "/slides/slide-07.jpg",
  "/slides/slide-09.jpg",
  "/slides/slide-10.jpg",
  "/slides/slide-11.jpg",
  "/slides/slide-12.jpg",
  "/slides/slide-13.jpg",
  "/slides/slide-14.jpg",
  "/slides/slide-16.jpg",
  "/slides/slide-17.jpg",

];
const TOTAL_SLIDES = SLIDE_SRCS.length;

interface Props {
  clientName: string;
  meetingId?: string;
  clientConnected?: boolean;
  clientCount?: number;
  screenSharePaused?: boolean;
  onTogglePauseShare?: () => void;
  onClose: () => void;
  onShareReport?: (currentSlide: number) => void;
  onFinish?: () => void;
  initialSlide?: number;
}

export function PresentationSlideshow({ clientName, meetingId, clientConnected, clientCount = 0, screenSharePaused, onTogglePauseShare, onClose, onShareReport, onFinish, initialSlide = 0 }: Props) {
  const [current, setCurrent] = useState(initialSlide);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Slides are React components — nothing to preload.

  const prev = useCallback(() => setCurrent((c) => Math.max(0, c - 1)), []);
  const next = useCallback(() => {
    setCurrent((c) => {
      if (c >= TOTAL_SLIDES - 1) {
        if (onFinish) {
          if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
          onFinish();
        }
        return c;
      }
      return c + 1;
    });
  }, [onFinish]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") prev();
      else if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        next();
      } else if (e.key === "Escape" && !document.fullscreenElement) {
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [prev, next, onClose]);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Auto-enter fullscreen on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      if (containerRef.current && !document.fullscreenElement) {
        containerRef.current.requestFullscreen().catch(() => {});
      }
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await containerRef.current.requestFullscreen();
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x > rect.width / 2) next();
    else prev();
  };

  const handleShareReport = async (e: React.MouseEvent) => {
    e.stopPropagation();
    // Exit fullscreen first if needed
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
    onShareReport?.(current);
  };

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col bg-black ${isFullscreen ? "w-screen h-screen" : "rounded-xl overflow-hidden"}`}
    >
      {/* Top bar — hidden by default, shows on hover */}
      <div
        className="absolute top-0 left-0 right-0 z-10 transition-opacity duration-300 opacity-0 hover:opacity-100"
      >
        <div className="flex items-center justify-between px-5 py-3 bg-black/85 backdrop-blur-md border-b border-white/10">
          {/* Left: Client info */}
          <div className="flex items-center gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-white text-base font-bold tracking-wide">
                {clientName}
              </span>
              {meetingId && (
                <span className="text-white text-sm font-mono font-semibold tracking-wider">
                  ID: {meetingId}
                </span>
              )}
            </div>
            {clientConnected ? (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/40 text-xs font-semibold px-3 py-1 gap-1.5">
                <Circle className="w-2 h-2 fill-green-400 text-green-400" />
                {clientCount === 1 ? "Client Connected" : `${clientCount} Clients Connected`}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-white/40 border-white/20 text-xs px-3 py-1 gap-1.5">
                <Circle className="w-2 h-2 fill-white/30 text-white/30" />
                Waiting for client
              </Badge>
            )}
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-3">
            {onTogglePauseShare && (
              <Button
                size="sm"
                className={screenSharePaused
                  ? "bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/40 h-8 px-3 text-xs"
                  : "bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 border border-yellow-500/40 h-8 px-3 text-xs"
                }
                onClick={(e) => { e.stopPropagation(); onTogglePauseShare(); }}
              >
                {screenSharePaused ? <Play className="w-3.5 h-3.5 mr-1" /> : <Pause className="w-3.5 h-3.5 mr-1" />}
                {screenSharePaused ? "Resume Share" : "Pause Share"}
              </Button>
            )}
            <span className="text-white/50 text-xs font-mono">
              {current + 1} / {TOTAL_SLIDES}
            </span>
            <Button
              size="icon"
              variant="ghost"
              className="text-white/70 hover:text-white hover:bg-white/10 h-8 w-8"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </Button>
            {!isFullscreen && (
              <Button
                size="icon"
                variant="ghost"
                className="text-white/70 hover:text-white hover:bg-white/10 h-8 w-8"
                onClick={onClose}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Slide area — fixed 16:9 stage with scaled React slide */}
      <div
        className={`relative flex-1 flex items-center justify-center cursor-pointer select-none bg-black ${isFullscreen ? "w-full h-full" : "min-h-[300px] aspect-video"}`}
        onClick={handleClick}
      >
        {SLIDE_SRCS.map((src, i) => (
          <img
            key={src}
            src={src}
            alt={`Slide ${i + 1}`}
            draggable={false}
            loading="eager"
            decoding="async"
            className="absolute inset-0 w-full h-full object-contain"
            style={{
              opacity: i === current ? 1 : 0,
              visibility: i === current ? "visible" : "hidden",
            }}
          />
        ))}
        {/* Left arrow */}
        {current > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); prev(); }}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Right arrow */}
        {(current < TOTAL_SLIDES - 1 || onFinish) && (
          <button
            onClick={(e) => { e.stopPropagation(); next(); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}

        {/* Invisible clickable overlay on slide 6 (index 5) over the existing Share Report image button */}
        {onShareReport && current === 5 && (
          <button
            onClick={handleShareReport}
            className="absolute bottom-4 right-4 w-48 h-14 z-20 cursor-pointer bg-transparent border-none outline-none"
            aria-label="Share Report"
          />
        )}
      </div>
    </div>
  );
}
