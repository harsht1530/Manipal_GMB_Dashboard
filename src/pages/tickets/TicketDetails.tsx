import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useTickets, Ticket, ActivityLog, TeamMember } from "@/contexts/TicketContext";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { 
  ArrowLeft, 
  Download, 
  UserCheck, 
  MessageSquare, 
  FileSpreadsheet, 
  Paperclip, 
  Calendar,
  Lock,
  Globe,
  Bell,
  Clock,
  CheckCircle,
  HelpCircle,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export default function TicketDetails() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const { tickets, team, isMultiplier, addTicketLog, transferTicket, refreshTickets } = useTickets();

  useEffect(() => {
    refreshTickets();
  }, [refreshTickets]);

  // Find active ticket
  const ticket = useMemo(() => {
    return tickets.find(t => t.ticketId === ticketId || t.requestId === ticketId) || null;
  }, [tickets, ticketId]);

  const canChangeStatus = useMemo(() => {
    if (!user || !ticket) return false;
    return user.email.toLowerCase() === ticket.assignedTo.email.toLowerCase();
  }, [user, ticket]);

  // UI state
  const [commentText, setCommentText] = useState("");
  const [statusVal, setStatusVal] = useState<string>("");
  const [isInternal, setIsInternal] = useState(false);
  const [sendEmail, setSendEmail] = useState(true);
  const [logAttachments, setLogAttachments] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  // Reassignment dialog
  const [transferOpen, setTransferOpen] = useState(false);
  const [newAssigneeEmail, setNewAssigneeEmail] = useState("");
  const [transferRemarks, setTransferRemarks] = useState("");
  const [transferLoading, setTransferLoading] = useState(false);

  // Sync state when ticket changes
  useEffect(() => {
    if (ticket) {
      setStatusVal(ticket.status);
    }
  }, [ticket]);

  if (!ticket) {
    return (
      <DashboardLayout title="Request Details" subtitle="Loading GMB request details...">
        <div className="max-w-4xl mx-auto py-12 text-center text-muted-foreground">
          <AlertCircle className="h-10 w-10 mx-auto text-muted-foreground/60 mb-2 animate-bounce" />
          <p className="font-semibold text-lg">Request Not Found</p>
          <p className="text-sm mt-1">Please check the ID or return to the dashboard.</p>
          <Link to="/requests/dashboard" className="mt-4 inline-block">
            <Button variant="outline">Back to Dashboard</Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const reqId = ticket.requestId || ticket.ticketId;
  const reqType = ticket.requestType || ticket.ticketType;

  // Calculate SLA Remaining time
  const slaRemaining = () => {
    if (ticket.status === "Completed" || ticket.status === "Closed") return "Resolved";
    const due = new Date(ticket.dueDate).getTime();
    const now = new Date().getTime();
    const diff = due - now;

    if (ticket.status === "Waiting for Google" && diff < 0) {
      return "Exceeded (Google Delay)";
    }

    if (diff < 0) return "SLA Breached";

    const hours = Math.ceil(diff / (1000 * 60 * 60));
    if (hours < 24) return `${hours}h remaining`;
    const days = Math.ceil(hours / 24);
    return `${days} days remaining`;
  };

  // Reassign / Transfer Handler
  const handleTransfer = async () => {
    if (!newAssigneeEmail) {
      toast({
        title: "Validation Error",
        description: "Please select a team member to assign.",
        variant: "destructive"
      });
      return;
    }
    setTransferLoading(true);
    const updated = await transferTicket(reqId, newAssigneeEmail, transferRemarks);
    setTransferLoading(false);
    if (updated) {
      setTransferOpen(false);
      setTransferRemarks("");
      setNewAssigneeEmail("");
    }
  };

  // Log attachments helper
  const handleAttachmentsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setLogAttachments(Array.from(e.target.files));
    }
  };

  // Submit new Activity Log / Status Change / Comment
  const handleSaveLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() && statusVal === ticket.status && logAttachments.length === 0) {
      toast({
        title: "Input Required",
        description: "Please enter a comment, change status, or upload files.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    const formData = new FormData();
    formData.append("user", user?.name || "User");
    formData.append("email", user?.email || "spoc@manipal.com");
    
    // Determine action type
    let action = "Comment Added";
    if (statusVal !== ticket.status) {
      action = "Status Change";
      formData.append("prevValue", ticket.status);
      formData.append("newValue", statusVal);
    } else if (logAttachments.length > 0) {
      action = "Attachments Uploaded";
    }

    formData.append("action", action);
    formData.append("remarks", commentText);
    formData.append("isInternal", String(isInternal));
    formData.append("sendEmailNotify", String(sendEmail));

    logAttachments.forEach(file => {
      formData.append("attachments", file);
    });

    const result = await addTicketLog(reqId, formData);
    setLoading(false);

    if (result) {
      setCommentText("");
      setLogAttachments([]);
      const fileInput = document.getElementById("log-files") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
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

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "Open": return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "In Progress": return "bg-blue-50 text-blue-700 border-blue-200";
      case "Waiting for Client": return "bg-amber-50 text-amber-700 border-amber-200";
      case "Waiting for Google": return "bg-indigo-50 text-indigo-700 border-indigo-200";
      case "Completed": return "bg-green-50 text-green-700 border-green-200";
      case "Closed": return "bg-slate-100 text-slate-600 border-slate-200";
      case "Escalated": return "bg-rose-50 text-rose-700 border-rose-200";
      default: return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <DashboardLayout title={`Request: ${reqId}`} subtitle="Deep dive tracking, log details, and updates.">
      <div className="space-y-6 max-w-6xl mx-auto">
        
        {/* Navigation & Toolbar Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
          <Link to="/requests/dashboard">
            <Button variant="ghost" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Back to Dashboard
            </Button>
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            {/* SLA countdown badge */}
            <Badge variant="outline" className={cn(
              "text-xs font-bold border px-3 py-1 shadow-sm",
              ticket.status === "Completed" || ticket.status === "Closed" ? "bg-green-50 text-green-700 border-green-200" : (
                slaRemaining().includes("Exceeded") ? "bg-amber-50 text-amber-700 border-amber-200" : (
                  slaRemaining().startsWith("SLA") ? "bg-red-50 text-red-700 border-red-200" : "bg-sky-50 text-sky-700 border-sky-200"
                )
              )
            )}>
              <Clock className="h-3.5 w-3.5 mr-1" />
              SLA: {slaRemaining()}
            </Badge>

            {/* SLA progress pipeline quick link */}
            <Link to={`/requests/sla-progress?ticketId=${reqId}`}>
              <Button variant="outline" size="sm" className="h-9">
                SLA Pipeline
              </Button>
            </Link>

            {/* Assign/Transfer button (visible only to admins and multiplier team) */}
            {(user?.role === "Admin" || isMultiplier) && (
              <Button size="sm" variant="outline" className="flex items-center gap-1.5 h-9" onClick={() => setTransferOpen(true)}>
                <UserCheck className="h-4 w-4" /> Assign / Transfer
              </Button>
            )}

            {/* Excel file template download */}
            {ticket.excelTemplate && (
              <a href={`${API_BASE_URL}${ticket.excelTemplate.path}`} download target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="secondary" className="flex items-center gap-1.5 h-9 bg-primary/10 text-primary hover:bg-primary/20">
                  <FileSpreadsheet className="h-4 w-4" /> Template Sheet
                </Button>
              </a>
            )}
          </div>
        </div>

        {/* 2-Column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left 2 cols: Request info, Attachments, Activity log */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Request Information */}
            <Card>
              <CardHeader className="bg-muted/15 border-b pb-3">
                <CardTitle className="text-base font-semibold">Request Information</CardTitle>
              </CardHeader>
              <CardContent className="p-5 text-left">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
                  <div>
                    <span className="text-xs text-muted-foreground block font-medium">Category:</span>
                    <span className="font-semibold text-foreground">{ticket.category}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block font-medium">Request Type:</span>
                    <span className="font-semibold text-foreground">{reqType}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block font-medium">Raised By:</span>
                    <span className="font-semibold text-foreground">{ticket.raisedBy.name}</span>
                    <span className="text-[11px] text-muted-foreground block">{ticket.raisedBy.email}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block font-medium">Assigned To:</span>
                    <span className="font-semibold text-foreground">{ticket.assignedTo.name}</span>
                    <span className="text-[11px] text-muted-foreground block">{ticket.assignedTo.email}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block font-medium">Hospital Unit / Branch:</span>
                    <span className="font-semibold text-foreground">{ticket.branch} ({ticket.cluster})</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block font-medium">Due Date (SLA):</span>
                    <span className="font-semibold text-foreground flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      {new Date(ticket.dueDate).toDateString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block font-medium">Priority Bracket:</span>
                    <Badge variant="outline" className={cn("text-[10px] font-bold border mt-0.5", getPriorityBadgeColor(ticket.priority))}>
                      {ticket.priority}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block font-medium">Current Status:</span>
                    <Badge variant="outline" className={cn("text-[10px] font-bold border mt-0.5", getStatusBadgeColor(ticket.status))}>
                      {ticket.status}
                    </Badge>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <span className="text-xs text-muted-foreground block font-medium mb-1">Description:</span>
                  <p className="text-foreground leading-relaxed text-sm bg-muted/20 p-3 rounded border whitespace-pre-wrap">
                    {ticket.description}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Attachments Section */}
            <Card>
              <CardHeader className="bg-muted/15 border-b pb-3">
                <CardTitle className="text-base font-semibold">Attachments & Files</CardTitle>
                <CardDescription className="text-xs">Spreadsheets and reference images uploaded</CardDescription>
              </CardHeader>
              <CardContent className="p-4 text-left">
                {ticket.excelTemplate || ticket.attachments.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Excel Template */}
                    {ticket.excelTemplate && (
                      <div className="flex items-center gap-3 border p-3 rounded-lg bg-emerald-50/10 border-emerald-100 hover:bg-emerald-50/20 transition-all">
                        <FileSpreadsheet className="h-9 w-9 text-emerald-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-semibold block text-emerald-800 truncate">{ticket.excelTemplate.filename}</span>
                          <span className="text-[10px] text-muted-foreground font-medium uppercase">Excel Sheet</span>
                        </div>
                        <a href={`${API_BASE_URL}${ticket.excelTemplate.path}`} download target="_blank" rel="noopener noreferrer">
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-100/50">
                            <Download className="h-4 w-4" />
                          </Button>
                        </a>
                      </div>
                    )}
                    
                    {/* Normal Attachments */}
                    {ticket.attachments.map((file, idx) => (
                      <div key={idx} className="flex items-center gap-3 border p-3 rounded-lg bg-muted/20 border-border/70 hover:bg-muted/40 transition-all">
                        <Paperclip className="h-9 w-9 text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-semibold block text-foreground truncate">{file.filename}</span>
                          <span className="text-[10px] text-muted-foreground font-medium uppercase">
                            {file.filename.split('.').pop() || "File"}
                          </span>
                        </div>
                        <a href={`${API_BASE_URL}${file.path}`} download target="_blank" rel="noopener noreferrer">
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-primary hover:bg-primary/10">
                            <Download className="h-4 w-4" />
                          </Button>
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-4">No attachments uploaded for this request.</p>
                )}
              </CardContent>
            </Card>

            {/* Activity Log / Timeline */}
            <Card className="overflow-hidden w-full max-w-full">
              <CardHeader className="bg-muted/15 border-b pb-3">
                <CardTitle className="text-base font-semibold">Activity Feed & Timeline</CardTitle>
                <CardDescription className="text-xs">Historical log of comments, status shifts, and notifications.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 overflow-hidden w-full max-w-full">
                <div className="relative border-l border-border pl-6 space-y-6 text-left ml-2 overflow-hidden w-full max-w-full">
                  {ticket.activityLogs
                    .filter(log => {
                      // Filter out internal notes if current user is not Multiplier/Admin
                      if (log.isInternal && !(user?.role === "Admin" || isMultiplier)) {
                        return false;
                      }
                      return true;
                    })
                    .map((log, idx) => {
                      const isLogInternal = log.isInternal;
                      return (
                        <div key={idx} className="relative overflow-hidden w-full max-w-full">
                          {/* Timeline dot */}
                          <span className={cn(
                            "absolute -left-[31px] top-1 flex h-5 w-5 items-center justify-center rounded-full bg-background border shadow-sm",
                            isLogInternal ? "border-amber-500 text-amber-600 bg-amber-50" : "border-primary text-primary"
                          )}>
                            {isLogInternal ? <Lock className="h-2.5 w-2.5" /> : <Globe className="h-2.5 w-2.5" />}
                          </span>

                          <div className="flex flex-col">
                            <div className="flex flex-wrap items-center gap-1.5 max-w-full">
                              <span className="text-xs font-bold text-foreground">{log.user}</span>
                              <span className="text-[10px] text-muted-foreground font-medium truncate max-w-[150px]" title={log.email}>({log.email})</span>
                              
                              <Badge className="text-[9px] px-1.5 py-0 shrink-0">
                                {log.action}
                              </Badge>

                              {isLogInternal && (
                                <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-amber-300 text-amber-700 bg-amber-50/50 shrink-0">
                                  Internal Note
                                </Badge>
                              )}
                            </div>
                            
                            <span className="text-[10px] text-muted-foreground font-medium mt-0.5">
                              {new Date(log.timestamp).toLocaleString()}
                            </span>

                            {log.remarks && (
                              <p className="text-sm text-foreground/80 mt-2 bg-muted/20 border-l-2 p-2 rounded-r max-w-full break-words">
                                {log.remarks}
                              </p>
                            )}

                            {/* Attachments inside logs */}
                            {log.attachments && log.attachments.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {log.attachments.map((f, i) => (
                                  <a key={i} href={`${API_BASE_URL}${f.path}`} download target="_blank" rel="noopener noreferrer" 
                                     className="flex items-center gap-1 text-[10px] font-semibold border px-2 py-1 rounded bg-muted hover:bg-muted/60 text-primary">
                                    <Paperclip className="h-3 w-3" />
                                    {f.filename}
                                  </a>
                                ))}
                              </div>
                            )}

                            {/* Status or Reassignment delta indicators */}
                            {(log.prevValue || log.newValue) && (
                              <div className="text-[11px] text-muted-foreground mt-1 font-medium bg-slate-50 border p-1 rounded-sm flex flex-wrap items-center gap-1.5 max-w-full break-all">
                                <span>From:</span>
                                <span className="font-semibold text-foreground line-through">{log.prevValue || "None"}</span>
                                <span>→</span>
                                <span>To:</span>
                                <span className="font-bold text-primary">{log.newValue}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>

          </div>

          {/* Right Column: Console / Action Log creation panel */}
          <div className="space-y-6">
            
            {/* Status & Update Console */}
            <Card>
              <CardHeader className="bg-muted/15 border-b pb-3">
                <CardTitle className="text-base font-semibold">Update Console</CardTitle>
                <CardDescription className="text-xs">Submit comments, change status, or upload logs</CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                <form onSubmit={handleSaveLog} className="space-y-4 text-left">
                  {/* Status update combobox (visible only to assignee or Admin) */}
                  {canChangeStatus ? (
                    <div className="space-y-1.5">
                      <Label htmlFor="status" className="font-semibold text-xs">Set Status</Label>
                      <Select value={statusVal} onValueChange={setStatusVal}>
                        <SelectTrigger className="w-full h-9">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Open">Open</SelectItem>
                          <SelectItem value="In Progress">In Progress</SelectItem>
                          <SelectItem value="Waiting for Client">Waiting Client</SelectItem>
                          <SelectItem value="Waiting for Google">Waiting Google</SelectItem>
                          <SelectItem value="Completed">Completed</SelectItem>
                          <SelectItem value="Closed">Closed</SelectItem>
                          {user?.role === "Admin" && (
                            <SelectItem value="Escalated">Escalated</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="space-y-1.5 p-3 rounded bg-muted/20 border border-primary/5 text-xs text-left">
                      <span className="text-muted-foreground font-semibold block">Request Status (Read-Only)</span>
                      <span className="font-bold flex items-center gap-1.5 mt-1 text-primary">
                        {ticket.status}
                      </span>
                    </div>
                  )}

                  {/* Comment Area */}
                  <div className="space-y-1.5">
                    <Label htmlFor="remarks" className="font-semibold text-xs">Write Comment / Update Remarks <span className="text-destructive">*</span></Label>
                    <Textarea 
                      id="remarks"
                      placeholder="Type details of changes or progress..." 
                      className="min-h-[120px]"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                    />
                  </div>

                  {/* Attach files to log */}
                  <div className="space-y-1.5">
                    <Label htmlFor="log-files" className="font-semibold text-xs">Add File Attachments</Label>
                    <Input 
                      id="log-files" 
                      type="file" 
                      multiple 
                      onChange={handleAttachmentsChange}
                      className="cursor-pointer h-9 text-xs"
                    />
                  </div>

                  {/* Config options */}
                  <div className="space-y-3 border-t pt-3">
                    
                    {/* Internal toggle (Admins and Multiplier only) */}
                    {(user?.role === "Admin" || isMultiplier) && (
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col text-left">
                          <Label htmlFor="isInternal" className="text-xs font-semibold flex items-center gap-1.5">
                            <Lock className="h-3.5 w-3.5 text-amber-500" /> Internal Note
                          </Label>
                          <span className="text-[10px] text-muted-foreground">Visible only to Multiplier Team</span>
                        </div>
                        <Switch id="isInternal" checked={isInternal} onCheckedChange={setIsInternal} />
                      </div>
                    )}

                    {/* Email toggle */}
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col text-left">
                        <Label htmlFor="sendEmail" className="text-xs font-semibold flex items-center gap-1.5">
                          <Bell className="h-3.5 w-3.5 text-sky-500" /> Email Notification
                        </Label>
                        <span className="text-[10px] text-muted-foreground">Send email update to counterpart</span>
                      </div>
                      <Switch id="sendEmail" checked={sendEmail} onCheckedChange={setSendEmail} />
                    </div>

                  </div>

                  <Button type="submit" className="w-full bg-primary hover:bg-primary/95 text-sm h-10 font-semibold flex items-center justify-center gap-1.5" disabled={loading}>
                    <MessageSquare className="h-4 w-4" /> {loading ? "Saving Console..." : "Submit Update"}
                  </Button>

                </form>
              </CardContent>
            </Card>

          </div>

        </div>

      </div>

      {/* 3. Reassignment Dialog */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="sm:max-w-[425px] text-left">
          <DialogHeader>
            <DialogTitle>Transfer GMB Request</DialogTitle>
            <DialogDescription>
              Assign this GMB request to another Multiplier Team member. Notification emails will be triggered.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            
            {/* New Assignee selection */}
            <div className="space-y-1.5">
              <Label htmlFor="assignee" className="font-semibold text-sm">Select New Assignee</Label>
              <Select value={newAssigneeEmail} onValueChange={setNewAssigneeEmail}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose Team Member" />
                </SelectTrigger>
                <SelectContent>
                  {team.map((member: TeamMember) => (
                    <SelectItem key={member._id} value={member.email}>
                      {member.name} ({member.cluster} Owner)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Transfer remarks */}
            <div className="space-y-1.5">
              <Label htmlFor="transferRemarks" className="font-semibold text-sm">Reason / Remarks for Transfer</Label>
              <Textarea 
                id="transferRemarks" 
                placeholder="Why is this request being transferred?"
                className="min-h-[100px]"
                value={transferRemarks}
                onChange={(e) => setTransferRemarks(e.target.value)}
              />
            </div>

          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setTransferOpen(false)}>Cancel</Button>
            <Button onClick={handleTransfer} disabled={transferLoading} className="bg-primary hover:bg-primary/95">
              {transferLoading ? "Transferring..." : "Confirm Transfer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </DashboardLayout>
  );
}
