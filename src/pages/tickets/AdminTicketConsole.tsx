import { useState, useMemo, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useTickets, Ticket } from "@/contexts/TicketContext";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { 
  Search,
  Filter,
  Download, 
  MessageSquare, 
  Paperclip, 
  Lock,
  Bell,
  Clock,
  CheckCircle,
  HelpCircle,
  AlertCircle,
  Activity,
  FileSpreadsheet,
  Calendar as CalendarIcon,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export default function AdminTicketConsole() {
  const { tickets, loading, addTicketLog, refreshTickets } = useTickets();
  const { user } = useAuth();
  const { toast } = useToast();
  const isClusterUser = user?.role === "Cluster";

  useEffect(() => {
    refreshTickets();
  }, [refreshTickets]);
  
  // Search & Filter state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [clusterFilter, setClusterFilter] = useState("ALL");
  const [assignedDateRange, setAssignedDateRange] = useState<DateRange | undefined>(undefined);
  
  // Selected ticket for modal
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  
  // Comment console state
  const [comment, setComment] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [sendEmail, setSendEmail] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [statusTransition, setStatusTransition] = useState<string>("");

  const canAdminChangeStatus = useMemo(() => {
    if (!user || !selectedTicket) return false;
    const emailLower = user.email.toLowerCase();
    const isAssignee = emailLower === selectedTicket.assignedTo.email.toLowerCase();
    const isAssignor = emailLower === selectedTicket.raisedBy.email.toLowerCase();
    const isAdmin = user.role === "Admin";
    const isCluster = user.role === "Cluster" && selectedTicket.cluster && user.cluster && selectedTicket.cluster.toLowerCase() === user.cluster.toLowerCase();
    
    return isAssignee || isAssignor || isAdmin || isCluster;
  }, [user, selectedTicket]);

  // Extract unique clusters for filter dropdown
  const clusters = useMemo(() => {
    const list = tickets.map(t => t.cluster).filter(Boolean);
    return Array.from(new Set(list));
  }, [tickets]);

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    const filtered = tickets.filter(ticket => {
      const matchSearch = 
        ticket.ticketId.toLowerCase().includes(search.toLowerCase()) ||
        (ticket.ticketType || ticket.requestType || "").toLowerCase().includes(search.toLowerCase()) ||
        ticket.description.toLowerCase().includes(search.toLowerCase()) ||
        ticket.raisedBy.name.toLowerCase().includes(search.toLowerCase()) ||
        ticket.assignedTo.name.toLowerCase().includes(search.toLowerCase()) ||
        ticket.branch.toLowerCase().includes(search.toLowerCase());
      
      const matchStatus = statusFilter === "ALL" || ticket.status === statusFilter;
      const matchPriority = priorityFilter === "ALL" || ticket.priority === priorityFilter;
      const matchCluster = isClusterUser || clusterFilter === "ALL" || ticket.cluster === clusterFilter;

      // 5. Assigned Date Range Filter
      let matchesAssignDate = true;
      if (assignedDateRange?.from) {
        const rawDate = ticket.createdAt;
        if (!rawDate) {
          matchesAssignDate = false;
        } else {
          const assignDate = new Date(rawDate);
          if (isNaN(assignDate.getTime())) {
            matchesAssignDate = false;
          } else {
            const fromDate = new Date(assignedDateRange.from);
            fromDate.setHours(0, 0, 0, 0);

            if (assignDate < fromDate) {
              matchesAssignDate = false;
            }

            if (assignedDateRange.to) {
              const toDate = new Date(assignedDateRange.to);
              toDate.setHours(23, 59, 59, 999);
              if (assignDate > toDate) {
                matchesAssignDate = false;
              }
            }
          }
        }
      }

      return matchSearch && matchStatus && matchPriority && matchCluster && matchesAssignDate;
    });

    // Priority rank mapping (P1 highest, P5 lowest)
    const priorityRank = (p: string) => {
      switch (p) {
        case "P1": return 1;
        case "P2": return 2;
        case "P3": return 3;
        case "P4": return 4;
        case "P5": return 5;
        default: return 99;
      }
    };

    // Sort: Highest priority first (P1 -> P5), then FIFO (First In, First Out: oldest createdAt first)
    return filtered.sort((a, b) => {
      const pA = priorityRank(a.priority);
      const pB = priorityRank(b.priority);
      if (pA !== pB) {
        return pA - pB;
      }
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return timeA - timeB;
    });
  }, [tickets, search, statusFilter, priorityFilter, clusterFilter, assignedDateRange]);

  // Metrics calculation
  const metrics = useMemo(() => {
    return {
      total: tickets.length,
      open: tickets.filter(t => t.status === "Open").length,
      progress: tickets.filter(t => t.status === "In Progress" || t.status.startsWith("Waiting")).length,
      escalated: tickets.filter(t => t.status === "Escalated").length,
      completed: tickets.filter(t => t.status === "Completed" || t.status === "Closed").length
    };
  }, [tickets]);

  // Select ticket to open in modal
  const handleOpenTicket = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setStatusTransition(ticket.status);
    setComment("");
    setIsInternal(false);
    setSendEmail(true);
    setSelectedFiles(null);
  };

  // Submit comment / status change
  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;
    if (!comment.trim() && statusTransition === selectedTicket.status) {
      toast({
        title: "No updates",
        description: "Please write a comment or select a new status.",
        variant: "destructive"
      });
      return;
    }

    setSubmittingComment(true);
    try {
      const formData = new FormData();
      formData.append("user", user?.name || "System Admin");
      formData.append("email", user?.email || "admin@manipal.com");
      formData.append("remarks", comment.trim());
      formData.append("isInternal", String(isInternal));
      formData.append("sendEmailNotify", String(sendEmail));

      const statusChanged = canAdminChangeStatus && statusTransition !== selectedTicket.status;
      if (statusChanged) {
        formData.append("action", "Status Changes");
        formData.append("prevValue", selectedTicket.status);
        formData.append("newValue", statusTransition);
      } else {
        formData.append("action", "Comments");
      }

      if (selectedFiles) {
        for (let i = 0; i < selectedFiles.length; i++) {
          formData.append("attachments", selectedFiles[i]);
        }
      }

      const updated = await addTicketLog(selectedTicket.ticketId, formData);
      if (updated) {
        toast({
          title: "Update Saved",
          description: `Successfully added update on ticket ${selectedTicket.ticketId}.`
        });
        setSelectedTicket(updated);
        setComment("");
        setSelectedFiles(null);
        refreshTickets();
      }
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Failed to update ticket",
        description: err.message || "An error occurred.",
        variant: "destructive"
      });
    } finally {
      setSubmittingComment(false);
    }
  };

  // Status helper color styling
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Open":
        return <Badge className="bg-sky-500/10 text-sky-500 border-sky-500/20 hover:bg-sky-500/15">Open</Badge>;
      case "In Progress":
        return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/15">In Progress</Badge>;
      case "Waiting for Client":
        return <Badge className="bg-purple-500/10 text-purple-500 border-purple-500/20 hover:bg-purple-500/15">Waiting for Client</Badge>;
      case "Waiting for Google":
        return <Badge className="bg-indigo-500/10 text-indigo-500 border-indigo-500/20 hover:bg-indigo-500/15">Waiting for Google</Badge>;
      case "Completed":
        return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/15">Completed</Badge>;
      case "Closed":
        return <Badge className="bg-slate-500/10 text-slate-500 border-slate-500/20 hover:bg-slate-500/15">Closed</Badge>;
      case "Escalated":
        return <Badge className="bg-rose-500/10 text-rose-500 border-rose-500/20 animate-pulse hover:bg-rose-500/15">Escalated</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Priority badge helper
  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "P1": return <Badge className="bg-red-500 text-white hover:bg-red-600 font-bold">P1</Badge>;
      case "P2": return <Badge className="bg-orange-500 text-white hover:bg-orange-600 font-bold">P2</Badge>;
      case "P3": return <Badge className="bg-yellow-500 text-black hover:bg-yellow-600 font-bold">P3</Badge>;
      case "P4": return <Badge className="bg-blue-500 text-white hover:bg-blue-600 font-bold">P4</Badge>;
      case "P5": return <Badge className="bg-slate-500 text-white hover:bg-slate-600 font-bold">P5</Badge>;
      default: return <Badge variant="outline">{priority}</Badge>;
    }
  };

  const title = isClusterUser ? "Cluster Control Console" : "Admin Control Console";
  const subtitle = isClusterUser
    ? `Supervise GMB requests for cluster: ${user?.cluster || ""}`
    : "Supervise all system GMB requests, audit timelines, and issue commands";

  return (
    <DashboardLayout title={title} subtitle={subtitle}>
      <div className="space-y-6">
        
        {/* KPI Cards Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card className="bg-gradient-to-br from-primary/5 via-transparent to-transparent border-primary/10 shadow-sm">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Requests</p>
                <h3 className="text-3xl font-bold text-foreground mt-1">{metrics.total}</h3>
              </div>
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Activity className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-sky-500/5 via-transparent to-transparent border-sky-500/10 shadow-sm">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Open (Unresolved)</p>
                <h3 className="text-3xl font-bold text-sky-500 mt-1">{metrics.open}</h3>
              </div>
              <div className="h-10 w-10 rounded-full bg-sky-500/10 flex items-center justify-center text-sky-500">
                <Clock className="h-5 w-5 animate-spin-slow" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500/5 via-transparent to-transparent border-amber-500/10 shadow-sm">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">In Progress/Waiting</p>
                <h3 className="text-3xl font-bold text-amber-500 mt-1">{metrics.progress}</h3>
              </div>
              <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                <HelpCircle className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-rose-500/5 via-transparent to-transparent border-rose-500/10 shadow-sm">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">SLA Escalations</p>
                <h3 className="text-3xl font-bold text-rose-500 mt-1">{metrics.escalated}</h3>
              </div>
              <div className="h-10 w-10 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 animate-pulse">
                <AlertCircle className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent border-emerald-500/10 shadow-sm">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Completed / Closed</p>
                <h3 className="text-3xl font-bold text-emerald-500 mt-1">{metrics.completed}</h3>
              </div>
              <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                <CheckCircle className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Controls Panel */}
        <Card className="border-primary/10 shadow-sm bg-background/50 backdrop-blur supports-[backdrop-filter]:bg-background/20">
          <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by ID, Category, Owner, Branch..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9 w-full bg-muted/20 border-primary/5 focus-visible:ring-primary/20"
              />
            </div>
            
            <div className="flex flex-wrap gap-3 w-full md:w-auto items-center">
              <div className="flex items-center gap-1.5 shrink-0 text-xs text-muted-foreground font-semibold">
                <Filter className="h-3.5 w-3.5" />
                Filters:
              </div>
              
              {/* Cluster Dropdown */}
              {!isClusterUser && (
                <Select value={clusterFilter} onValueChange={setClusterFilter}>
                  <SelectTrigger className="h-9 w-[130px] bg-muted/20 border-primary/5 text-xs font-medium">
                    <SelectValue placeholder="Cluster" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Clusters</SelectItem>
                    {clusters.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Status Dropdown */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-[130px] bg-muted/20 border-primary/5 text-xs font-medium">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="Open">Open</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Waiting for Client">Waiting for Client</SelectItem>
                  <SelectItem value="Waiting for Google">Waiting for Google</SelectItem>
                  <SelectItem value="Escalated">Escalated</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Closed">Closed</SelectItem>
                </SelectContent>
              </Select>

              {/* Priority Dropdown */}
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="h-9 w-[100px] bg-muted/20 border-primary/5 text-xs font-medium">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Priorities</SelectItem>
                  <SelectItem value="P1">P1 (Critical)</SelectItem>
                  <SelectItem value="P2">P2 (High)</SelectItem>
                  <SelectItem value="P3">P3 (Medium)</SelectItem>
                  <SelectItem value="P4">P4 (Low)</SelectItem>
                  <SelectItem value="P5">P5 (Lowest)</SelectItem>
                </SelectContent>
              </Select>

              {/* Assigned Date Range Filter */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="admin-assigned-date"
                    variant="outline"
                    size="sm"
                    className={cn(
                      "h-9 justify-start text-left font-normal bg-muted/20 border-primary/5 text-xs relative pr-7 w-auto min-w-[130px] max-w-[190px] shrink-0",
                      !assignedDateRange?.from && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate text-xs font-medium">
                      {assignedDateRange?.from ? (
                        assignedDateRange.to ? (
                          <>
                            {format(assignedDateRange.from, "dd MMM")} -{" "}
                            {format(assignedDateRange.to, "dd MMM")}
                          </>
                        ) : (
                          format(assignedDateRange.from, "dd MMM")
                        )
                      ) : (
                        <span>Assigned Date</span>
                      )}
                    </span>
                    {assignedDateRange?.from && (
                      <div
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 h-4 w-4 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAssignedDateRange(undefined);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </div>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 shadow-lg border-border" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={assignedDateRange?.from}
                    selected={assignedDateRange}
                    onSelect={setAssignedDateRange}
                    numberOfMonths={1}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </CardContent>
        </Card>

        {/* Requests Listing Table */}
        <Card className="border-primary/10 shadow-sm overflow-hidden bg-background">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="font-bold w-[120px]">Request ID</TableHead>
                  <TableHead className="font-bold">Branch (Cluster)</TableHead>
                  <TableHead className="font-bold">Category & Type</TableHead>
                  <TableHead className="font-bold">Raised By</TableHead>
                  <TableHead className="font-bold">Assigned To</TableHead>
                  <TableHead className="font-bold">Status</TableHead>
                  <TableHead className="font-bold w-[70px]">Priority</TableHead>
                  <TableHead className="font-bold">Assign Date</TableHead>
                  <TableHead className="font-bold">Due Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center text-sm text-muted-foreground font-medium">
                      Loading requests and audit logs...
                    </TableCell>
                  </TableRow>
                ) : filteredTickets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center text-sm text-muted-foreground font-medium">
                      No requests found matching the filter criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTickets.map(ticket => {
                    const reqId = ticket.requestId || ticket.ticketId;
                    const reqType = ticket.requestType || ticket.ticketType;
                    return (
                      <TableRow 
                        key={ticket._id} 
                        className="cursor-pointer hover:bg-muted/10 transition-colors"
                        onClick={() => handleOpenTicket(ticket)}
                      >
                        <TableCell className="font-bold text-primary">{reqId}</TableCell>
                        <TableCell className="text-xs">
                          <span className="font-semibold block">{ticket.branch}</span>
                          <span className="text-[10px] text-muted-foreground">{ticket.cluster}</span>
                        </TableCell>
                        <TableCell className="text-xs">
                          <span className="font-medium block">{ticket.category}</span>
                          <span className="text-[10px] text-muted-foreground">{reqType}</span>
                        </TableCell>
                        <TableCell className="text-xs">
                          <span className="font-medium block">{ticket.raisedBy.name}</span>
                          <span className="text-[10px] text-muted-foreground">{ticket.raisedBy.email}</span>
                        </TableCell>
                        <TableCell className="text-xs">
                          <span className="font-semibold text-teal-600 block">{ticket.assignedTo.name}</span>
                          <span className="text-[10px] text-muted-foreground">{ticket.assignedTo.email}</span>
                        </TableCell>
                        <TableCell>{getStatusBadge(ticket.status)}</TableCell>
                        <TableCell>{getPriorityBadge(ticket.priority)}</TableCell>
                        <TableCell className="text-xs font-semibold text-muted-foreground">
                          {format(new Date(ticket.createdAt), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell className="text-xs font-semibold text-muted-foreground">
                          {format(new Date(ticket.dueDate), 'MMM d, yyyy')}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* Dynamic Request Inspection & Comments Dialog */}
        {selectedTicket && (
          <Dialog open={!!selectedTicket} onOpenChange={(open) => !open && setSelectedTicket(null)}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto border-primary/10 shadow-2xl p-6 custom-scrollbar bg-background">
              <DialogHeader className="border-b pb-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <DialogTitle className="text-xl font-bold flex items-center gap-2 text-primary">
                      {selectedTicket.requestId || selectedTicket.ticketId}
                      {getStatusBadge(selectedTicket.status)}
                      {getPriorityBadge(selectedTicket.priority)}
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                      Raised for <strong>{selectedTicket.branch} ({selectedTicket.cluster})</strong> on {format(new Date(selectedTicket.createdAt), 'MMM d, yyyy h:mm a')}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
                {/* Details Section */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Metadata and Description */}
                  <Card className="border-primary/5 bg-muted/5 shadow-sm">
                    <CardHeader className="py-3 px-4 border-b">
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4 text-primary" />
                        Request Meta Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="text-muted-foreground block font-medium">Category:</span>
                          <span className="font-semibold">{selectedTicket.category}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block font-medium">Request Type:</span>
                          <span className="font-semibold">{selectedTicket.requestType || selectedTicket.ticketType}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block font-medium">Raised By:</span>
                          <span className="font-semibold">{selectedTicket.raisedBy.name} ({selectedTicket.raisedBy.email})</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block font-medium">Assigned Owner:</span>
                          <span className="font-semibold text-teal-600">{selectedTicket.assignedTo.name} ({selectedTicket.assignedTo.email})</span>
                        </div>
                      </div>
                      
                      <div className="border-t pt-3 w-full max-w-full overflow-hidden">
                        <span className="text-muted-foreground block text-xs font-medium">Description:</span>
                        <p className="text-xs text-foreground mt-1 whitespace-pre-line break-words [word-break:break-word] bg-muted/20 p-2.5 rounded border border-primary/5 leading-relaxed font-medium w-full max-w-full overflow-y-auto max-h-[300px]">
                          {selectedTicket.description}
                        </p>
                      </div>

                      {/* Attachments & Templates */}
                      {(selectedTicket.excelTemplate || (selectedTicket.attachments && selectedTicket.attachments.length > 0)) && (
                        <div className="border-t pt-3 space-y-2">
                          <span className="text-muted-foreground block text-xs font-medium">Uploaded Files:</span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            {selectedTicket.excelTemplate && (
                              <a
                                href={`${API_BASE_URL}${selectedTicket.excelTemplate.path}`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-2 p-2 rounded bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/10 text-emerald-600 transition-colors font-bold"
                              >
                                <FileSpreadsheet className="h-4 w-4" />
                                <span className="truncate">{selectedTicket.excelTemplate.filename}</span>
                                <Download className="h-3 w-3 ml-auto shrink-0" />
                              </a>
                            )}
                            {selectedTicket.attachments.map((file, idx) => (
                              <a
                                key={idx}
                                href={`${API_BASE_URL}${file.path}`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-2 p-2 rounded bg-sky-500/5 hover:bg-sky-500/10 border border-sky-500/10 text-sky-600 transition-colors font-bold"
                              >
                                <Paperclip className="h-4 w-4" />
                                <span className="truncate">{file.filename}</span>
                                <Download className="h-3 w-3 ml-auto shrink-0" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Comment & Status Console */}
                  <Card className="border-primary/10 shadow-md">
                    <CardHeader className="py-3 px-4 border-b bg-primary/5">
                      <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
                        <MessageSquare className="h-4 w-4" />
                        Admin Commands & Comments
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                      <form onSubmit={handleSubmitComment} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {canAdminChangeStatus ? (
                            <div className="space-y-1.5">
                              <Label htmlFor="status" className="text-xs font-semibold">Transition Status</Label>
                              <Select value={statusTransition} onValueChange={setStatusTransition}>
                                <SelectTrigger id="status" className="h-9 text-xs">
                                  <SelectValue placeholder="Select Status" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Open">Open</SelectItem>
                                  <SelectItem value="In Progress">In Progress</SelectItem>
                                  <SelectItem value="Waiting for Client">Waiting for Client</SelectItem>
                                  <SelectItem value="Waiting for Google">Waiting for Google</SelectItem>
                                  <SelectItem value="Completed">Completed</SelectItem>
                                  <SelectItem value="Closed">Closed</SelectItem>
                                  <SelectItem value="Escalated">Escalated</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          ) : (
                            <div className="space-y-1.5 p-3 rounded bg-muted/20 border border-primary/5 text-xs text-left">
                              <span className="text-muted-foreground font-semibold block text-[10px]">Transition Status (Read-Only)</span>
                              <span className="font-bold flex items-center gap-1.5 mt-1 text-primary">
                                {selectedTicket.status}
                              </span>
                            </div>
                          )}
                          
                          <div className="flex flex-col justify-end gap-2 pb-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="flex items-center gap-1.5 text-amber-600 font-bold">
                                <Lock className="h-3.5 w-3.5" />
                                Internal Note Only
                              </span>
                              <Switch
                                checked={isInternal}
                                onCheckedChange={setIsInternal}
                              />
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="flex items-center gap-1.5 text-sky-600 font-bold">
                                <Bell className="h-3.5 w-3.5" />
                                Send Email Alert
                              </span>
                              <Switch
                                checked={sendEmail}
                                onCheckedChange={setSendEmail}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="comment" className="text-xs font-semibold">Add Comment / Remarks</Label>
                          <Textarea
                            id="comment"
                            placeholder="Write admin remarks, internal log notes, or feedback here..."
                            rows={3}
                            value={comment}
                            onChange={e => setComment(e.target.value)}
                            className="text-xs focus-visible:ring-primary/20 bg-muted/5 border-primary/5"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="files" className="text-xs font-semibold">Upload Supporting Files (Optional)</Label>
                          <Input
                            id="files"
                            type="file"
                            multiple
                            onChange={e => setSelectedFiles(e.target.files)}
                            className="text-xs h-9 cursor-pointer"
                          />
                        </div>

                        <Button 
                          type="submit" 
                          disabled={submittingComment} 
                          className="w-full text-xs font-bold gap-2"
                        >
                          {submittingComment ? "Applying Commands..." : "Apply Status & Comment"}
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                </div>

                {/* Audit Timeline / Activity Feed */}
                <div className="space-y-4">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Audit Log Timeline</span>
                  <div className="border-l border-primary/10 pl-4 space-y-4 max-h-[500px] overflow-y-auto overflow-x-hidden w-full max-w-full custom-scrollbar py-2">
                    {selectedTicket.activityLogs.map((log, index) => (
                      <div key={log._id || index} className="relative space-y-1 text-left overflow-hidden w-full max-w-full">
                        {/* Dot Indicator */}
                        <div className={cn(
                          "absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border bg-background",
                          log.isInternal ? "border-amber-500 bg-amber-50" : "border-primary bg-primary-foreground"
                        )} />
                        
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground font-semibold max-w-full">
                          <span className="text-foreground font-bold">{log.user}</span>
                          <span className="truncate max-w-[100px] text-muted-foreground/80" title={log.email}>({log.email})</span>
                          <span>•</span>
                          <span>{format(new Date(log.timestamp), 'MMM d, h:mm a')}</span>
                          {log.isInternal && (
                            <Badge variant="outline" className="text-[8px] px-1 h-3.5 border-amber-500/20 bg-amber-500/5 text-amber-600 font-bold uppercase shrink-0">Internal</Badge>
                          )}
                        </div>

                        <div className="text-xs font-bold text-foreground break-all max-w-full">
                          {log.action}
                          {log.newValue && (
                            <span className="text-[10px] text-muted-foreground font-medium ml-1 break-all">
                              ({log.prevValue || "none"} → <span className="font-bold text-primary">{log.newValue}</span>)
                            </span>
                          )}
                        </div>
                        {log.remarks && (
                          <p className="text-[11px] text-muted-foreground font-medium leading-relaxed italic break-words max-w-full">
                            "{log.remarks}"
                          </p>
                        )}
                        {log.attachments && log.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {log.attachments.map((file, fIdx) => (
                              <a
                                key={fIdx}
                                href={`${API_BASE_URL}${file.path}`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-[9px] text-muted-foreground hover:text-primary transition-colors border font-bold"
                              >
                                <Paperclip className="h-2.5 w-2.5 shrink-0" />
                                <span className="truncate max-w-[80px]">{file.filename}</span>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
        
      </div>
    </DashboardLayout>
  );
}
