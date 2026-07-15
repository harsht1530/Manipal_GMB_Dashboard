import { useState, useMemo, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useTickets, Ticket } from "@/contexts/TicketContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  HelpCircle, 
  ArrowLeft,
  Mail,
  User,
  ExternalLink,
  Bell,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";

interface StageInfo {
  day: number;
  priority: string;
  label: string;
  progress: number;
  emailStatus: string;
  dateStr: string;
  owner: string;
  countdown: string;
  status: "completed" | "active" | "pending";
}

export default function SlaProgress() {
  const { tickets, refreshTickets } = useTickets();
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    refreshTickets();
  }, [refreshTickets]);
  const [searchParams] = useSearchParams();
  const [selectedTicketId, setSelectedTicketId] = useState<string>("");
  const [sendingReminder, setSendingReminder] = useState<number | null>(null);

  // Filter tickets: only see if raised by, assigned to, or if admin
  const visibleTickets = useMemo(() => {
    if (!user) return [];
    const isAdmin = user.role === "Admin";
    return tickets.filter(t => {
      if (isAdmin) return true;
      const isRaisedByUser = t.raisedBy.email.toLowerCase() === user.email.toLowerCase() &&
        (user.role === "Branch" ? t.branch === user.branch : true);
      const isAssignedToUser = t.assignedTo.email.toLowerCase() === user.email.toLowerCase();
      return isRaisedByUser || isAssignedToUser;
    });
  }, [tickets, user]);

  // Auto-select ticket from query parameters if present
  useEffect(() => {
    const paramId = searchParams.get("ticketId");
    if (paramId) {
      setSelectedTicketId(paramId);
    } else if (visibleTickets.length > 0 && !selectedTicketId) {
      setSelectedTicketId(visibleTickets[0].ticketId);
    }
  }, [searchParams, visibleTickets, selectedTicketId]);

  const selectedTicket = useMemo(() => {
    return visibleTickets.find(t => t.ticketId === selectedTicketId) || null;
  }, [visibleTickets, selectedTicketId]);

  const handleSendReminder = async (day: number) => {
    if (!selectedTicket) return;
    
    const confirmSend = window.confirm(`Are you sure you want to send an SLA reminder notification for Day ${day}? This will send an email and dashboard alert to ${selectedTicket.assignedTo.name}.`);
    if (!confirmSend) return;

    setSendingReminder(day);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || "http://localhost:5000"}/api/tickets/${selectedTicket.ticketId}/remind`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderName: user?.name || "System SPOC" })
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: "SLA Reminder Sent",
          description: `SLA Reminder triggered successfully. ${selectedTicket.assignedTo.name} has been notified via email & dashboard alert.`,
        });
        refreshTickets();
      } else {
        throw new Error(data.error || "Failed to send reminder");
      }
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Action Failed",
        description: err.message || "Failed to trigger reminder.",
        variant: "destructive"
      });
    } finally {
      setSendingReminder(null);
    }
  };

  // Generate SLA progression stages
  const stages = useMemo((): StageInfo[] => {
    if (!selectedTicket) return [];

    const createdTime = new Date(selectedTicket.createdAt).getTime();
    const now = new Date().getTime();
    const ageMs = now - createdTime;
    const ageDays = Math.ceil(ageMs / (1000 * 60 * 60 * 24));
    
    const baseStages = [
      { day: 1, priority: "P5", label: "Ticket Created", progress: 12 },
      { day: 2, priority: "P5", label: "No Escalation", progress: 25 },
      { day: 3, priority: "P4", label: "Priority Increased", progress: 37 },
      { day: 4, priority: "P3", label: "Priority Increased", progress: 50 },
      { day: 5, priority: "P2", label: "Reminder 1 Sent", progress: 62 },
      { day: 6, priority: "P2", label: "Reminder 2 Sent", progress: 75 },
      { day: 7, priority: "P1", label: "Reminder 3 Sent", progress: 87 },
      { day: 8, priority: "Escalated", label: "Regional Marketing Escalation", progress: 100 },
    ];

    return baseStages.map((stage): StageInfo => {
      // Calculate date of the stage
      const stageDate = new Date(createdTime);
      stageDate.setDate(stageDate.getDate() + (stage.day - 1));
      
      let status: "completed" | "active" | "pending" = "pending";
      
      const isResolved = selectedTicket.status === "Completed" || selectedTicket.status === "Closed";
      if (isResolved) {
        status = "completed";
      } else {
        if (ageDays > stage.day) {
          status = "completed";
        } else if (ageDays === stage.day) {
          status = "active";
        } else {
          status = "pending";
        }
      }

      // Owner at stage
      let owner = selectedTicket.assignedTo.name;
      if (stage.day === 8 && (selectedTicket.status === "Escalated" || (!isResolved && ageDays >= 8))) {
        owner = "Regional Marketing Head";
      }

      // Email notification log check
      let emailStatus = "Not Sent";
      if (stage.day === 1) {
        emailStatus = "Sent";
      } else if (selectedTicket.activityLogs.some(l => l.remarks?.includes(`SLA Reminder triggered`) || l.remarks?.includes(`Day ${stage.day}`))) {
        emailStatus = "Sent";
      }

      // Countdown to this stage
      let countdown = "-";
      if (status === "active") {
        const nextStageTime = createdTime + (stage.day) * 24 * 60 * 60 * 1000;
        const diffMs = nextStageTime - now;
        if (diffMs > 0) {
          const hours = Math.floor(diffMs / (1000 * 60 * 60));
          const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
          countdown = `${hours}h ${mins}m`;
        } else {
          countdown = "Breached";
        }
      } else if (status === "completed") {
        countdown = "Completed";
      } else {
        countdown = `${stage.day - ageDays} Days`;
      }

      return {
        ...stage,
        status,
        emailStatus,
        dateStr: stageDate.toLocaleDateString(),
        owner,
        countdown
      };
    });
  }, [selectedTicket]);

  return (
    <DashboardLayout title="SLA Progress" subtitle="View and track the 8-day GMB Operations SLA pipeline.">
      <div className="space-y-6">
        
        {/* Ticket Selector Card */}
        <Card>
          <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto text-left">
              <span className="font-semibold text-sm shrink-0">Select Ticket:</span>
              <Select value={selectedTicketId} onValueChange={setSelectedTicketId}>
                <SelectTrigger className="w-full sm:w-[280px]">
                  <SelectTrigger>
                    <SelectValue placeholder="Select GMB Ticket" />
                  </SelectTrigger>
                </SelectTrigger>
                <SelectContent>
                  {visibleTickets.map(t => (
                    <SelectItem key={t.ticketId} value={t.ticketId}>
                      {t.ticketId} - {t.branch} ({t.ticketType})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedTicket && (
              <div className="flex items-center gap-3">
                <Link to={`/tickets/details/${selectedTicket.ticketId}`}>
                  <Button size="sm" variant="outline" className="flex items-center gap-1">
                    Ticket Details <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {selectedTicket ? (
          <>
            {/* Visual Step Timeline */}
            <Card className="p-6 overflow-x-auto text-left">
              <h3 className="text-base font-bold text-foreground mb-6">SLA Lifecycle: {selectedTicket.ticketId}</h3>
              
              <div className="relative flex items-center justify-between min-w-[700px] px-8 py-4">
                {/* Connecting Line */}
                <div className="absolute top-1/2 left-0 right-0 h-1 bg-border -translate-y-1/2 z-0" />
                
                {stages.map((stage) => {
                  const isCompleted = stage.status === "completed";
                  const isActive = stage.status === "active";

                  return (
                    <div key={stage.day} className="relative z-10 flex flex-col items-center group">
                      {/* Step Circle */}
                      <div 
                        className={cn(
                          "h-12 w-12 rounded-full border-2 flex items-center justify-center font-bold text-sm shadow-md transition-all duration-300",
                          isCompleted && "bg-emerald-500 border-emerald-600 text-white",
                          isActive && "bg-primary border-primary-foreground text-primary-foreground scale-110 ring-4 ring-primary/20",
                          stage.status === "pending" && "bg-card border-muted text-muted-foreground"
                        )}
                      >
                        {isCompleted ? <CheckCircle2 className="h-6 w-6" /> : stage.day}
                      </div>

                      {/* Tooltip Labels */}
                      <div className="mt-3 flex flex-col items-center">
                        <span className="text-xs font-bold text-foreground">{`Day ${stage.day}`}</span>
                        <Badge variant="outline" className="text-[9px] mt-1 font-bold">
                          {stage.priority}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Stages Detail Table */}
            <Card>
              <CardHeader className="bg-muted/15 border-b pb-3">
                <CardTitle className="text-base font-semibold">SLA Progression Audit</CardTitle>
                <CardDescription>Track dates, notifications, and ownership updates across all lifecycle stages.</CardDescription>
              </CardHeader>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="w-[80px]">Stage</TableHead>
                      <TableHead>Expected Date</TableHead>
                      <TableHead>Current Owner</TableHead>
                      <TableHead>Countdown / Status</TableHead>
                      <TableHead>Completion %</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead className="text-right pr-6">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stages.map((stage) => (
                      <TableRow 
                        key={stage.day} 
                        className={cn(
                          "hover:bg-muted/10 transition-colors",
                          stage.status === "active" && "bg-primary/5 hover:bg-primary/10"
                        )}
                      >
                        <TableCell className="font-bold text-left">{`Day ${stage.day}`}</TableCell>
                        <TableCell className="text-xs font-semibold text-muted-foreground">{stage.dateStr}</TableCell>
                        <TableCell className="text-xs font-medium text-left">
                          <span className="flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            {stage.owner}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs font-bold text-left">
                          {stage.status === "completed" && <span className="text-emerald-600 font-medium">Completed</span>}
                          {stage.status === "active" && <span className="text-rose-600 animate-pulse font-bold">{stage.countdown}</span>}
                          {stage.status === "pending" && <span className="text-muted-foreground font-normal">{stage.countdown}</span>}
                        </TableCell>
                        <TableCell className="font-bold text-xs text-muted-foreground">{`${stage.progress}%`}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(
                            "text-[10px] font-bold border",
                            stage.priority === "Escalated" ? "bg-rose-100 text-rose-800 border-rose-200" : (
                              stage.priority === "P1" ? "bg-red-100 text-red-800 border-red-200" : "bg-slate-100 text-slate-800"
                            )
                          )}>
                            {stage.priority}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-right pr-6">
                          {stage.status === "completed" ? (
                            <span className="text-emerald-600 font-semibold flex items-center gap-1.5 justify-end">
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                              Passed
                            </span>
                          ) : (
                            user?.email.toLowerCase() !== selectedTicket.assignedTo.email.toLowerCase() ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[10px] font-bold text-sky-600 border-sky-600/20 hover:bg-sky-500/10 gap-1 ml-auto"
                                disabled={sendingReminder === stage.day}
                                onClick={() => handleSendReminder(stage.day)}
                              >
                                {sendingReminder === stage.day ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Bell className="h-3 w-3 animate-pulse" />
                                )}
                                Send Reminder
                              </Button>
                            ) : (
                              <span className="text-muted-foreground text-[10px] font-medium block text-right">Pending</span>
                            )
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </>
        ) : (
          <Card className="p-8 text-center text-muted-foreground font-medium">
            No GMB tickets available to display SLA Progress. Raise a ticket first.
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
