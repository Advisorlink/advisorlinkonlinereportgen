import { useEffect, useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MeetingHostDock } from "@/components/MeetingHostDock";
import { Menu, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CRMLayout({ children }: { children: React.ReactNode }) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch { /* noop */ }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between gap-2 border-b border-border/60 bg-background/80 dark:bg-background/60 backdrop-blur-xl px-4 shrink-0 sticky top-0 z-30">
            <SidebarTrigger className="text-foreground/70 hover:text-foreground transition-colors">
              <Menu className="w-5 h-5" />
            </SidebarTrigger>
            <Button
              size="icon"
              variant="ghost"
              onClick={toggleFullscreen}
              className="h-8 w-8 text-foreground/70 hover:text-foreground"
              title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
          </header>
          <MeetingHostDock />
          <main className="flex-1 overflow-auto bg-background page-enter">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
