import { BarChart3, FileText, Gift, Monitor, Settings, LogOut, FileSignature, PhoneCall } from "lucide-react";
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
import logoSvg from "@/assets/logo.svg";

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: BarChart3 },
  { title: "Presentations", url: "/presentations", icon: Monitor },
  { title: "Report Generator", url: "/", icon: FileText },
  { title: "E-Sign Docs", url: "/esign", icon: FileSignature },
  { title: "Dialer", url: "/ai-caller", icon: PhoneCall },
  { title: "Referrals", url: "/referrals", icon: Gift, badge: "12 new" },
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
            <div className="flex items-center justify-center py-1">
              <img
                src={logoSvg}
                alt="Advisor Link Online"
                className="h-10 w-auto"
              />
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
                      {!collapsed && (
                        <span className="text-sm font-medium flex-1">{item.title}</span>
                      )}
                      {!collapsed && item.badge && (
                        <span className="ml-auto px-1.5 py-0.5 rounded-full bg-cyan text-[10px] font-bold text-white leading-none">
                          {item.badge}
                        </span>
                      )}
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
