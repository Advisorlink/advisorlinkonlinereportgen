import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Maximize, Minimize, X, FileText } from "lucide-react";

const TOTAL_SLIDES = 15;
const SLIDE_URLS = Array.from({ length: TOTAL_SLIDES }, (_, i) => `/slides/slide-${String(i + 1).padStart(2, "0")}.jpg`);

interface Props {
  clientName: string;
  onClose: () => void;
  onShareReport?: (currentSlide: number) => void;
  initialSlide?: number;
}

export function PresentationSlideshow({ clientName, onClose, onShareReport, initialSlide = 0 }: Props) {
  const [current, setCurrent] = useState(initialSlide);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Preload all slide images immediately
  useEffect(() => {
    SLIDE_URLS.forEach((url) => {
      const img = new Image();
      img.src = url;
    });
  }, []);

  const prev = useCallback(() => setCurrent((c) => Math.max(0, c - 1)), []);
  const next = useCallback(() => setCurrent((c) => Math.min(TOTAL_SLIDES - 1, c + 1)), []);

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
        className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-2 bg-black/80 backdrop-blur z-10 transition-opacity duration-300 opacity-0 hover:opacity-100"
      >
        <div className="flex items-center gap-3">
          <span className="text-white/70 text-sm font-medium">
            Presenting to <span className="text-white font-bold">{clientName}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
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

      {/* Slide area */}
      <div
        className={`relative flex-1 flex items-center justify-center cursor-pointer select-none ${isFullscreen ? "w-full h-full" : "min-h-[300px]"}`}
        onClick={handleClick}
      >
        <img
          src={SLIDE_URLS[current]}
          alt={`Slide ${current + 1}`}
          className={isFullscreen ? "w-full h-full object-contain" : "max-w-full max-h-full object-contain"}
          draggable={false}
        />

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
        {current < TOTAL_SLIDES - 1 && (
          <button
            onClick={(e) => { e.stopPropagation(); next(); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}

        {/* Share Report button — only on slide 3 (index 2), bottom right */}
        {onShareReport && current === 2 && (
          <Button
            onClick={handleShareReport}
            className="absolute bottom-6 right-6 bg-white text-navy hover:bg-white/90 font-semibold shadow-lg px-6 py-2 h-auto text-base z-20"
          >
            <FileText className="w-5 h-5 mr-2" />
            Share Report
          </Button>
        )}
      </div>
    </div>
  );
}
