import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MeetingHostDock } from "@/components/MeetingHostDock";

export function CRMLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center border-b border-border bg-white px-4 shrink-0">
            <SidebarTrigger className="text-navy" />
          </header>
          <MeetingHostDock />
          <main className="flex-1 overflow-auto bg-secondary/40">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
