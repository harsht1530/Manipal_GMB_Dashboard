import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  ChevronLeft,
  Building2,
  Phone,
  Target,
  Search,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarFilters } from "@/components/dashboard/SidebarFilters";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Users, label: "Profiles", path: "/doctors" },
  { icon: Building2, label: "Branches", path: "/branches" },
  { icon: Phone, label: "Phone", path: "/phone" },
  { icon: Target, label: "Keywords", path: "/keywords" },
  { icon: Search, label: "Search Perf.", path: "/search-performance" },
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

  const filteredNavItems = navItems.filter(item => {
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
      <div className="flex-1 overflow-y-auto py-4 scrollbar-hide">
        <nav className="space-y-1 px-3">
          {filteredNavItems.map((item) => {
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

        {/* Filters Section */}
        {!collapsed && (
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
      </div>

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
