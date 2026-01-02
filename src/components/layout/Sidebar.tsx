import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  TrendingUp,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Building2,
  Phone,
  Target,
  Search,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SidebarFilters } from "@/components/dashboard/SidebarFilters";
import { Separator } from "@/components/ui/separator";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Users, label: "Doctors", path: "/doctors" },
  { icon: Target, label: "Keywords", path: "/keywords" },
  { icon: Building2, label: "Branches", path: "/branches" },
  { icon: Phone, label: "Phone", path: "/phone" },
  { icon: Search, label: "Search Perf.", path: "/search-performance" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

interface SidebarProps {
  selectedDepartments: string[];
  onDepartmentsChange: (departments: string[]) => void;
  selectedRatings: number[];
  onRatingsChange: (ratings: number[]) => void;
}

export const Sidebar = ({
  selectedDepartments,
  onDepartmentsChange,
  selectedRatings,
  onRatingsChange,
}: SidebarProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-sidebar transition-all duration-300 flex flex-col",
        collapsed ? "w-20" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border">
        <div className={cn("flex items-center gap-3", collapsed && "justify-center w-full")}>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-primary">
            <span className="text-lg font-bold text-sidebar-primary-foreground">M</span>
          </div>
          {!collapsed && (
            <span className="text-lg font-semibold text-sidebar-foreground">
              Manipal Insights
            </span>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="space-y-1 p-3">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                collapsed && "justify-center px-2"
              )}
            >
              <item.icon className={cn("h-5 w-5 shrink-0", isActive && "text-sidebar-primary")} />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Filters Section */}
      {!collapsed && (
        <>
          <Separator className="mx-3 bg-sidebar-border" />
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            <SidebarFilters
              collapsed={collapsed}
              selectedDepartments={selectedDepartments}
              onDepartmentsChange={onDepartmentsChange}
              selectedRatings={selectedRatings}
              onRatingsChange={onRatingsChange}
            />
          </div>
        </>
      )}

      {/* Collapse Toggle */}
      <div className="p-3 border-t border-sidebar-border mt-auto">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "w-full text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            collapsed && "px-2"
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <>
              <ChevronLeft className="h-5 w-5" />
              <span>Collapse</span>
            </>
          )}
        </Button>
      </div>

      {/* Logout */}
      <div className="p-3 border-t border-sidebar-border">
        <NavLink
          to="/login"
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-200",
            collapsed && "justify-center px-2"
          )}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Logout</span>}
        </NavLink>
      </div>
    </aside>
  );
};
