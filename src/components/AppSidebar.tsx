import { BarChart3, FileText, Gift, Monitor, Settings, LogOut, Users } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: BarChart3 },
  { title: "Presentations", url: "/presentations", icon: Monitor },
  { title: "Report Generator", url: "/", icon: FileText },
  { title: "Referrals", url: "/referrals", icon: Gift },
  { title: "Client Reports", url: "/admin", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const { signOut } = useAuth();

  const isActive = (path: string) => pathname === path;

  return (
    <Sidebar collapsible="icon" className="border-r border-border bg-navy">
      <SidebarContent className="bg-navy text-navy-foreground">
        <div className={`px-4 py-5 ${collapsed ? "px-2" : ""}`}>
          {collapsed ? (
            <div className="w-8 h-8 rounded-lg bg-cyan flex items-center justify-center mx-auto">
              <span className="text-xs font-black text-cyan-foreground">AL</span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-cyan flex items-center justify-center shrink-0">
                <span className="text-xs font-black text-cyan-foreground">AL</span>
              </div>
              <div>
                <p className="text-sm font-bold tracking-tight text-white">Advisor Link</p>
                <p className="text-[10px] text-white/50 font-medium">Online CRM</p>
              </div>
            </div>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="text-white/40 text-[10px] font-semibold tracking-widest uppercase">
            {!collapsed && "Menu"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    className={`
                      text-white/70 hover:text-white hover:bg-white/10
                      ${isActive(item.url) ? "!bg-cyan/20 !text-cyan" : ""}
                    `}
                  >
                    <NavLink to={item.url} className="flex items-center gap-2.5">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span className="text-sm font-medium">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="bg-navy border-t border-white/10 p-3">
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-white/50 hover:text-white hover:bg-white/10 justify-start gap-2"
          onClick={signOut}
        >
          <LogOut className="w-4 h-4" />
          {!collapsed && <span className="text-sm">Sign Out</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
