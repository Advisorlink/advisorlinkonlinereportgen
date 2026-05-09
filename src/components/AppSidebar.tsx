import { BarChart3, FileText, Gift, Monitor, Settings, LogOut, FileSignature, PhoneCall, ClipboardList, MessageSquare, Send, Sparkles, Kanban, Sun, Moon, ShieldCheck } from "lucide-react";
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
import { useTheme } from "@/hooks/useTheme";
import logoSvg from "@/assets/logo.svg";

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: BarChart3 },
  { title: "Pipeline", url: "/pipeline", icon: Kanban, badge: "NEW", badgeColor: "gradient-accent" },
  { title: "Presentations", url: "/presentations", icon: Monitor },
  { title: "Messages", url: "/messages", icon: MessageSquare, badge: "NEW", badgeColor: "gradient-accent" },
  { title: "SMS Hub", url: "/sms-hub", icon: Send },
  { title: "Report Generator", url: "/", icon: FileText },
  { title: "Fact Find", url: "/fact-find", icon: ClipboardList },
  { title: "E-Sign Docs", url: "/esign", icon: FileSignature },
  { title: "Dialer", url: "/ai-caller", icon: PhoneCall, badge: "LEAP", badgeColor: "bg-emerald-500" },
  { title: "Referrals", url: "/referrals", icon: Gift, badge: "12 new" },
  { title: "Client Reports", url: "/admin", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const { signOut } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();

  const isActive = (path: string) => pathname === path;

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarContent className="bg-gradient-to-b from-[hsl(215,58%,11%)] to-[hsl(215,58%,8%)] text-white sidebar-scrollbar">
        {/* Logo */}
        <div className={`px-4 pt-6 pb-4 ${collapsed ? "px-2" : ""}`}>
          {collapsed ? (
            <div className="w-9 h-9 rounded-xl gradient-accent flex items-center justify-center mx-auto shadow-lg shadow-cyan/20">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
          ) : (
            <div className="flex items-center justify-center py-1">
              <img
                src={logoSvg}
                alt="Advisor Link Online"
                className="h-10 w-auto drop-shadow-lg"
              />
            </div>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="text-white/30 text-[10px] font-semibold tracking-[0.2em] uppercase px-4">
            {!collapsed && "Menu"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="px-2 space-y-0.5">
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    className={`
                      text-white/60 hover:text-white hover:bg-white/[0.08] rounded-lg transition-all duration-200
                      ${isActive(item.url) 
                        ? "!bg-white/[0.12] !text-white shadow-sm" 
                        : ""
                      }
                    `}
                  >
                    <NavLink to={item.url} className="flex items-center gap-3 py-2">
                      <item.icon className={`h-[18px] w-[18px] transition-colors ${isActive(item.url) ? "text-cyan" : ""}`} />
                      {!collapsed && (
                        <span className="text-[13px] font-medium flex-1">{item.title}</span>
                      )}
                      {!collapsed && item.badge && (
                        <span className={`ml-auto px-2 py-0.5 rounded-full text-[9px] font-bold text-white leading-none ${(item as any).badgeColor || "gradient-accent"}`}>
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

      <SidebarFooter className="bg-[hsl(215,58%,8%)] border-t border-white/[0.06] p-3 space-y-1">
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-white/60 hover:text-white hover:bg-white/[0.08] justify-start gap-2.5 rounded-lg transition-all"
          onClick={toggleTheme}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-cyan" />}
          {!collapsed && <span className="text-[13px]">{theme === "dark" ? "Light mode" : "Dark mode"}</span>}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-white/40 hover:text-white hover:bg-white/[0.08] justify-start gap-2.5 rounded-lg transition-all"
          onClick={signOut}
        >
          <LogOut className="w-4 h-4" />
          {!collapsed && <span className="text-[13px]">Sign Out</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
