import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Building2,
  Phone,
  Target,
  Search,
  Menu,
  GitCompare,
  FileText,
  Ticket,
  AlertTriangle,
  ClipboardList,
  PlusCircle,
  ShieldAlert,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarFilters } from "@/components/dashboard/SidebarFilters";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: GitCompare, label: "Comparison", path: "/comparison" },
  { icon: Users, label: "Profiles", path: "/doctors" },
  { icon: Building2, label: "Units", path: "/branches" },
  { icon: Phone, label: "Phone", path: "/phone" },
  { icon: Target, label: "Keywords", path: "/keywords" },
  { icon: Search, label: "Search Perf.", path: "/search-performance" },
  { icon: Target, label: "Monthly Optimisation", path: "/optimizations" },
  { icon: FileText, label: "GBP Postings", path: "/postings" },
  { icon: Ticket, label: "Case Management", path: "/raising-case" },
  {
    label: "Request Management",
    icon: ClipboardList,
    path: "/requests",
    isParent: true,
    children: [
      { icon: LayoutDashboard, label: "Request Dashboard", path: "/requests/dashboard" },
      { icon: PlusCircle, label: "Raise Request", path: "/requests/raise" },
      { icon: ShieldAlert, label: "SLA Alerts", path: "/requests/escalations" },
      { icon: Clock, label: "SLA Pipeline", path: "/requests/sla-progress" },
    ]
  },
  { icon: AlertTriangle, label: "Critical Issues", path: "/critical-issues" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  selectedDepartments: string[];
  onDepartmentsChange: (departments: string[]) => void;
  selectedRatings: number[];
  onRatingsChange: (ratings: number[]) => void;
}

export const Sidebar = ({
  collapsed,
  setCollapsed,
  selectedDepartments,
  onDepartmentsChange,
  selectedRatings,
  onRatingsChange,
}: SidebarProps) => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [ticketsExpanded, setTicketsExpanded] = useState(true);
  const [isMultiplierUser, setIsMultiplierUser] = useState(false);

  useEffect(() => {
    if (!user?.email) return;
    fetch(`${import.meta.env.VITE_API_BASE_URL || "http://localhost:5000"}/api/multiplier-team`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          const match = data.data.find((m: any) => m && m.email && m.email.toLowerCase() === user.email.toLowerCase());
          setIsMultiplierUser(!!match);
        }
      })
      .catch(err => console.error("Error in Sidebar matching multiplier team:", err));
  }, [user]);

  const isAdmin = user?.role === "Admin";

  // Build Request Management children dynamically based on access
  const ticketingChildren = [
    { icon: LayoutDashboard, label: "Request Dashboard", path: "/requests/dashboard" },
  ];

  if (isAdmin) {
    ticketingChildren.push({ icon: ClipboardList, label: "Admin Console", path: "/requests/admin-console" });
  }

  // Everyone can raise a request
  ticketingChildren.push({ icon: PlusCircle, label: "Raise Request", path: "/requests/raise" });

  if (isAdmin || user?.role === "Cluster") {
    ticketingChildren.push({ icon: ShieldAlert, label: "SLA Alerts", path: "/requests/escalations" });
  }

  ticketingChildren.push({ icon: Clock, label: "SLA Pipeline", path: "/requests/sla-progress" });

  const filteredNavItems = navItems.map(item => {
    if (item.label === "Request Management" || item.label === "GMB Ticketing") {
      return { ...item, children: ticketingChildren };
    }
    return item;
  }).filter(item => {
    if (item.label === "Settings" && !["Admin", "Cluster", "Branch"].includes(user?.role || "")) {
      return false;
    }
    return true;
  });

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-sidebar transition-all duration-300 flex flex-col border-r border-sidebar-border",
        collapsed ? "w-20" : "w-64"
      )}
    >
      {/* Sidebar Header - Logo & Toggle */}
      <div className="flex h-20 items-center px-4 border-b border-sidebar-border relative">
        {!collapsed ? (
          <>
            <div className="flex items-center justify-center w-full">
              <img
                src="https://multipliersolutions.in/manipalhospitals/manipallogo2.png"
                alt="Logo"
                className="h-16 w-auto object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).onerror = null;
                  (e.currentTarget as HTMLImageElement).src = "/placeholder.svg";
                }}
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(true)}
              className="absolute right-2 h-8 w-8 text-sidebar-foreground/60 hover:text-sidebar-primary hover:bg-sidebar-primary/10"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </>
        ) : (
          <>
            <div className="flex items-center justify-center w-full">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sidebar-primary/10 p-1.5">
                <span className="text-xl font-bold text-sidebar-primary">M</span>
              </div>
            </div>
            <div className="absolute top-4 right-[-12px] z-50">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCollapsed(false)}
                className="h-6 w-6 rounded-full bg-background border-border shadow-sm hover:bg-accent"
              >
                <Menu className="h-3 w-3" />
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Navigation */}
      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-4 scrollbar-hide">
        <nav className="space-y-1 px-3">
          {filteredNavItems.map((item) => {
            if (item.isParent) {
              const hasActiveChild = item.children?.some(child => location.pathname === child.path);

              if (collapsed) {
                return (
                  <NavLink
                    key={item.path}
                    to={item.children?.[0].path || item.path}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 group relative justify-center px-0 h-10 w-10 mx-auto",
                      hasActiveChild
                        ? "bg-sidebar-primary/10 text-sidebar-primary shadow-sm"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <item.icon className={cn("h-5 w-5 shrink-0 transition-transform group-hover:scale-110", hasActiveChild && "text-sidebar-primary")} />
                    <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 border whitespace-nowrap shadow-lg">
                      {item.label}
                    </div>
                  </NavLink>
                );
              }

              return (
                <div key={item.label} className="space-y-1 text-left">
                  <button
                    type="button"
                    onClick={() => setTicketsExpanded(!ticketsExpanded)}
                    className={cn(
                      "w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 group relative text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="h-5 w-5 shrink-0 transition-transform group-hover:scale-110" />
                      <span>{item.label}</span>
                    </div>
                    {ticketsExpanded ? (
                      <ChevronDown className="h-4 w-4 text-sidebar-foreground/50" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-sidebar-foreground/50" />
                    )}
                  </button>
                  {ticketsExpanded && (
                    <div className="ml-4 border-l border-sidebar-border pl-3 space-y-1">
                      {item.children?.map((child) => {
                        const isChildActive = location.pathname === child.path;
                        return (
                          <NavLink
                            key={child.path}
                            to={child.path}
                            className={cn(
                              "flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200 group relative",
                              isChildActive
                                ? "bg-sidebar-primary/10 text-sidebar-primary shadow-sm"
                                : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                            )}
                          >
                            <child.icon className={cn("h-4 w-4 shrink-0 transition-transform group-hover:scale-110", isChildActive && "text-sidebar-primary")} />
                            <span>{child.label}</span>
                          </NavLink>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 group relative",
                  isActive
                    ? "bg-sidebar-primary/10 text-sidebar-primary shadow-sm"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  collapsed && "justify-center px-0 h-10 w-10 mx-auto"
                )}
              >
                <item.icon className={cn("h-5 w-5 shrink-0 transition-transform group-hover:scale-110", isActive && "text-sidebar-primary")} />
                {!collapsed && <span>{item.label}</span>}
                {collapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 border whitespace-nowrap shadow-lg">
                    {item.label}
                  </div>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Filters Section */}
      {!collapsed && !location.pathname.startsWith("/tickets") && (
        <div className="mt-6 px-3">
          <Separator className="bg-sidebar-border" />
          <div className="pt-4">
            <SidebarFilters
              collapsed={collapsed}
              selectedDepartments={selectedDepartments}
              onDepartmentsChange={onDepartmentsChange}
              selectedRatings={selectedRatings}
              onRatingsChange={onRatingsChange}
            />
          </div>
        </div>
      )}

      {/* Logout */}
      <div className="p-4 border-t border-sidebar-border bg-sidebar/50">
        <button
          onClick={logout}
          className={cn(
            "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 hover:bg-destructive/10 hover:text-destructive transition-all duration-200 group",
            collapsed && "justify-center px-0 h-10 w-10 mx-auto"
          )}
        >
          <LogOut className="h-5 w-5 shrink-0 transition-transform group-hover:-translate-x-1" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
};
