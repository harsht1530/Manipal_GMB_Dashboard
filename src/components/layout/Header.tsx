import { Bell, Search, User, LogOut, Settings as SettingsIcon, Clock, MapPin as MapPinIcon, Shield, CheckCheck, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Command, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export const Header = ({ title, subtitle }: HeaderProps) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const isAdmin = user?.role === "Admin";

  const fetchAlerts = async () => {
    if (!isAdmin) return;
    try {
      const res = await fetch("http://localhost:5000/api/alerts");
      const data = await res.json();
      if (data.success) {
        setAlerts(data.data);
        setUnreadCount(data.data.filter((a: any) => !a.read).length);
      }
    } catch (err) {
      console.error("Failed to fetch alerts:", err);
    }
  };

  useEffect(() => {
    fetchAlerts();
    // Poll for new alerts every minute if admin
    let interval: NodeJS.Timeout;
    if (isAdmin) {
      interval = setInterval(fetchAlerts, 60000);
    }
    return () => clearInterval(interval);
  }, [isAdmin]);

  const markAsRead = async () => {
    if (unreadCount === 0) return;
    try {
      const res = await fetch("http://localhost:5000/api/alerts/read", {
        method: "PATCH"
      });
      const data = await res.json();
      if (data.success) {
        setUnreadCount(0);
        setAlerts(prev => prev.map(a => ({ ...a, read: true })));
      }
    } catch (err) {
      console.error("Failed to mark alerts as read:", err);
    }
  };

  const deleteAlert = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`http://localhost:5000/api/alerts/${id}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (data.success) {
        setAlerts(prev => prev.filter(a => a._id !== id));
        setUnreadCount(prev => alerts.find(a => a._id === id)?.read ? prev : Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error("Failed to delete alert:", err);
    }
  };

  const clearAllAlerts = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/alerts", {
        method: "DELETE"
      });
      const data = await res.json();
      if (data.success) {
        setAlerts([]);
        setUnreadCount(0);
      }
    } catch (err) {
      console.error("Failed to clear alerts:", err);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-4">
        {isAdmin && (
          <DropdownMenu onOpenChange={(open) => open && markAsRead()}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative hover:bg-primary/10 transition-colors">
                <Bell className="h-5 w-5 text-muted-foreground" />
                {unreadCount > 0 && (
                  <span className="absolute 1 top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground animate-in zoom-in font-bold border-2 border-background">
                    {unreadCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 mt-2 p-0 animate-in slide-in-from-top-2 duration-300 shadow-xl border-primary/10">
              <DropdownMenuLabel className="p-4 border-b bg-muted/30">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-base flex items-center gap-2">
                    <Bell className="h-4 w-4 text-primary" />
                    System Alerts
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] font-bold">
                      {alerts.length} Total
                    </Badge>
                    {alerts.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px] text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={clearAllAlerts}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                      </Button>
                    )}
                  </div>
                </div>
              </DropdownMenuLabel>
              <Command className="p-0">
                <CommandList className="max-h-[350px] overflow-y-auto custom-scrollbar">
                  {alerts.length === 0 ? (
                    <div className="p-8 text-center bg-muted/5">
                      <div className="bg-primary/10 w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3">
                        <CheckCheck className="h-5 w-5 text-primary" />
                      </div>
                      <p className="text-sm text-muted-foreground font-medium">All caught up!</p>
                      <p className="text-[10px] text-muted-foreground mt-1">No login alerts found.</p>
                    </div>
                  ) : (
                    alerts.map((alert, idx) => (
                      <div key={alert._id} className={cn(
                        "p-4 border-b last:border-0 hover:bg-muted/50 transition-colors relative",
                        !alert.read && "bg-primary/5"
                      )}>
                        {!alert.read && (
                          <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-full" />
                        )}
                        <div className="flex flex-col gap-1.5 ml-2 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-bold text-foreground line-clamp-1">{alert.user}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1 shrink-0 bg-muted px-1.5 py-0.5 rounded">
                                <Clock className="h-2.5 w-2.5" />
                                {format(new Date(alert.timestamp), 'MMM d, h:mm a')}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                onClick={(e) => deleteAlert(alert._id, e)}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline" className="text-[9px] px-1.5 h-4 border-primary/20 bg-primary/5 text-primary">
                              <Shield className="h-2.5 w-2.5 mr-1" />
                              {alert.role}
                            </Badge>
                            <Badge variant="outline" className="text-[9px] px-1.5 h-4 border-success/20 bg-success/5 text-success">
                              <MapPinIcon className="h-2.5 w-2.5 mr-1" />
                              {alert.location}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5 italic">
                            Logged in to the portal
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </CommandList>
              </Command>
              {alerts.length > 0 && (
                <div className="p-2 border-top bg-muted/20 text-center">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                    Last 50 Activity Alerts
                  </span>
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full overflow-hidden border border-primary/20 hover:border-primary/50 transition-colors">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                <User className="h-4 w-4" />
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 mt-2 animate-in fade-in-0 zoom-in-95">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user?.name}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user?.email}
                </p>
                <p className="text-[10px] font-bold text-primary uppercase tracking-wider pt-1">
                  {user?.role} Access
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/settings" className="cursor-pointer w-full flex items-center">
                <SettingsIcon className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive cursor-pointer"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
