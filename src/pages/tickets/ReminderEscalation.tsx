import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useTickets, Ticket } from "@/contexts/TicketContext";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { 
  BellRing, 
  AlertTriangle, 
  ShieldAlert, 
  Send,
  ArrowUpRight,
  TrendingUp
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function ReminderEscalation() {
  const { tickets, addTicketLog, loading } = useTickets();
  const { user } = useAuth();
  const { toast } = useToast();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Group tickets by SLA stages
  const slaGroups = useMemo(() => {
    const now = new Date().getTime();
    
    const day5Tickets: Ticket[] = [];
    const day6Tickets: Ticket[] = [];
    const day7Tickets: Ticket[] = [];
    const escalatedTickets: Ticket[] = [];

    tickets.forEach(t => {
      if (t.status === "Completed" || t.status === "Closed") return;

      const created = new Date(t.createdAt).getTime();
      const diffTime = Math.abs(now - created);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (t.status === "Escalated" || diffDays >= 8) {
        escalatedTickets.push(t);
      } else if (diffDays === 7) {
        day7Tickets.push(t);
      } else if (diffDays === 6) {
        day6Tickets.push(t);
      } else if (diffDays === 5) {
        day5Tickets.push(t);
      }
    });

    return { day5: day5Tickets, day6: day6Tickets, day7: day7Tickets, escalated: escalatedTickets };
  }, [tickets]);

  // Selected filter list
  const [selectedGroup, setSelectedGroup] = useState<"day5" | "day6" | "day7" | "escalated">("escalated");

  const currentGroupTickets = useMemo(() => {
    return slaGroups[selectedGroup];
  }, [slaGroups, selectedGroup]);

  // Trigger Manual SLA Reminder Email
  const handleSendReminder = async (ticket: Ticket) => {
    if (!user) return;
    setActionLoading(`${ticket.ticketId}-reminder`);
    try {
      const formData = new FormData();
      formData.append("user", user.name);
      formData.append("email", user.email);
      formData.append("action", "Reminder Emails");
      formData.append("remarks", `Manual SLA Reminder triggered by dashboard operator (${user.name}).`);
      formData.append("sendEmailNotify", "true"); // trigger SMTP email
      formData.append("isInternal", "false");

      await addTicketLog(ticket.ticketId, formData);
      toast({
        title: "Reminder Sent",
        description: `Email reminder triggered successfully to ${ticket.assignedTo.name}.`,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  };

  // Trigger Manual Ticket Escalation
  const handleEscalate = async (ticket: Ticket) => {
    if (!user) return;
    setActionLoading(`${ticket.ticketId}-escalate`);
    try {
      const formData = new FormData();
      formData.append("user", user.name);
      formData.append("email", user.email);
      formData.append("action", "Escalations");
      formData.append("newValue", "Escalated");
      formData.append("remarks", `Ticket manually escalated to Regional Marketing Head by ${user.name}. Priority set to P1 (Highest).`);
      formData.append("sendEmailNotify", "true");
      formData.append("isInternal", "false");

      // Also updates local state status to 'Escalated' in context
      await addTicketLog(ticket.ticketId, formData);
      
      // Update status directly through server logs endpoint
      toast({
        title: "Ticket Escalated",
        description: `Ticket ${ticket.ticketId} is now escalated to the Regional Marketing Head.`,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  };

  const getPriorityBadgeColor = (prio: string) => {
    switch (prio) {
      case "P1": return "bg-red-100 text-red-800 border-red-200";
      case "P2": return "bg-orange-100 text-orange-800 border-orange-200";
      case "P3": return "bg-amber-100 text-amber-800 border-amber-200";
      default: return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  return (
    <DashboardLayout title="Reminder & Escalation" subtitle="Identify and action tickets approaching or breaching SLA limits.">
      
      {/* SLA Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        
        {/* Day 5 Card */}
        <div 
          onClick={() => setSelectedGroup("day5")}
          className={cn(
            "cursor-pointer rounded-xl border p-5 transition-all duration-200 flex items-center justify-between shadow-sm hover:shadow-md",
            selectedGroup === "day5" ? "border-primary bg-primary/5 ring-1 ring-primary" : "bg-card border-border"
          )}
        >
          <div className="space-y-1 text-left">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reaching Day 5</span>
            <h3 className="text-3xl font-bold tracking-tight">{slaGroups.day5.length}</h3>
            <span className="text-[10px] text-muted-foreground block font-medium">Requires Reminder 1</span>
          </div>
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <BellRing className="h-5 w-5" />
          </div>
        </div>

        {/* Day 6 Card */}
        <div 
          onClick={() => setSelectedGroup("day6")}
          className={cn(
            "cursor-pointer rounded-xl border p-5 transition-all duration-200 flex items-center justify-between shadow-sm hover:shadow-md",
            selectedGroup === "day6" ? "border-orange-500 bg-orange-500/5 ring-1 ring-orange-500" : "bg-card border-border"
          )}
        >
          <div className="space-y-1 text-left">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reaching Day 6</span>
            <h3 className="text-3xl font-bold tracking-tight text-orange-600">{slaGroups.day6.length}</h3>
            <span className="text-[10px] text-muted-foreground block font-medium">Requires Reminder 2</span>
          </div>
          <div className="h-10 w-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center">
            <BellRing className="h-5 w-5 animate-pulse" />
          </div>
        </div>

        {/* Day 7 Card */}
        <div 
          onClick={() => setSelectedGroup("day7")}
          className={cn(
            "cursor-pointer rounded-xl border p-5 transition-all duration-200 flex items-center justify-between shadow-sm hover:shadow-md",
            selectedGroup === "day7" ? "border-amber-500 bg-amber-50/20 ring-1 ring-amber-500" : "bg-card border-border"
          )}
        >
          <div className="space-y-1 text-left">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reaching Day 7</span>
            <h3 className="text-3xl font-bold tracking-tight text-amber-600">{slaGroups.day7.length}</h3>
            <span className="text-[10px] text-muted-foreground block font-medium">Requires Reminder 3</span>
          </div>
          <div className="h-10 w-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>

        {/* Escalated Card */}
        <div 
          onClick={() => setSelectedGroup("escalated")}
          className={cn(
            "cursor-pointer rounded-xl border p-5 transition-all duration-200 flex items-center justify-between shadow-sm hover:shadow-md",
            selectedGroup === "escalated" ? "border-red-500 bg-red-50/25 ring-1 ring-red-500" : "bg-card border-border"
          )}
        >
          <div className="space-y-1 text-left">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Escalated Tickets</span>
            <h3 className="text-3xl font-bold tracking-tight text-red-600">{slaGroups.escalated.length}</h3>
            <span className="text-[10px] text-muted-foreground block font-medium">Escalated to RMH</span>
          </div>
          <div className="h-10 w-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
            <ShieldAlert className="h-5 w-5" />
          </div>
        </div>

      </div>

      {/* Group Detail Table */}
      <Card>
        <CardHeader className="bg-muted/15 border-b pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TrendingUp className="h-4.5 w-4.5 text-primary" />
            Tickets Requiring Attention: 
            <span className="text-primary font-bold">
              {selectedGroup === "day5" && "Day 5 (Reminder 1)"}
              {selectedGroup === "day6" && "Day 6 (Reminder 2)"}
              {selectedGroup === "day7" && "Day 7 (Reminder 3)"}
              {selectedGroup === "escalated" && "Escalated"}
            </span>
          </CardTitle>
          <CardDescription>Actions can be triggered manually by administrators or team leads.</CardDescription>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-[120px]">Ticket ID</TableHead>
                <TableHead>Category / Type</TableHead>
                <TableHead>Branch / Unit</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Raised By</TableHead>
                <TableHead>Created Date</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">SLA Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentGroupTickets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-28 text-center text-muted-foreground font-medium">
                    No GMB tickets currently in this SLA bracket.
                  </TableCell>
                </TableRow>
              ) : (
                currentGroupTickets.map(ticket => (
                  <TableRow key={ticket._id} className="hover:bg-muted/20 transition-colors">
                    <TableCell className="font-semibold text-primary">
                      <Link to={`/tickets/details/${ticket.ticketId}`} className="hover:underline flex items-center gap-1">
                        {ticket.ticketId}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex flex-col text-left">
                        <span className="text-xs text-muted-foreground">{ticket.category}</span>
                        <span className="text-sm font-semibold truncate max-w-[180px]">{ticket.ticketType}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-semibold text-foreground">{ticket.branch}</TableCell>
                    <TableCell className="text-xs">{ticket.assignedTo.name}</TableCell>
                    <TableCell className="text-xs">{ticket.raisedBy.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(ticket.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-[10px] font-semibold border px-2 py-0.5", getPriorityBadgeColor(ticket.priority))}>
                        {ticket.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-[10px] font-semibold border px-2 py-0.5", 
                        ticket.status === "Escalated" ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-amber-50 text-amber-700 border-amber-200"
                      )}>
                        {ticket.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Link to={`/tickets/details/${ticket.ticketId}`}>
                        <Button size="sm" variant="outline" className="h-8 text-xs font-medium">
                          Open <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                        </Button>
                      </Link>
                      
                      {selectedGroup !== "escalated" && (
                        <Button 
                          size="sm" 
                          variant="secondary"
                          className="h-8 text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20"
                          onClick={() => handleSendReminder(ticket)}
                          disabled={actionLoading === `${ticket.ticketId}-reminder`}
                        >
                          <Send className="mr-1 h-3.5 w-3.5" />
                          {actionLoading === `${ticket.ticketId}-reminder` ? "Sending..." : "Send Reminder"}
                        </Button>
                      )}

                      {ticket.status !== "Escalated" && (
                        <Button 
                          size="sm" 
                          variant="destructive"
                          className="h-8 text-xs font-medium border border-rose-200 text-rose-600 bg-rose-50 hover:bg-rose-100"
                          onClick={() => handleEscalate(ticket)}
                          disabled={actionLoading === `${ticket.ticketId}-escalate`}
                        >
                          <AlertTriangle className="mr-1 h-3.5 w-3.5" />
                          {actionLoading === `${ticket.ticketId}-escalate` ? "Escalating..." : "Escalate Now"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

    </DashboardLayout>
  );
}
