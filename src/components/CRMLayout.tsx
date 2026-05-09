import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MeetingHostDock } from "@/components/MeetingHostDock";
import { Menu } from "lucide-react";

export function CRMLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between gap-2 border-b border-border/60 bg-background/80 dark:bg-background/60 backdrop-blur-xl px-4 shrink-0 sticky top-0 z-30">
            <SidebarTrigger className="text-foreground/70 hover:text-foreground transition-colors">
              <Menu className="w-5 h-5" />
            </SidebarTrigger>
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
