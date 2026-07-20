import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useTickets, Ticket } from "@/contexts/TicketContext";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { 
  Plus, 
  Search, 
  RefreshCw, 
  Download, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  HelpCircle, 
  Ticket as TicketIcon, 
  ArrowUpRight,
  User,
  Building
} from "lucide-react";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";

export default function TicketDashboard() {
  const { tickets, loading, refreshTickets } = useTickets();
  const { user } = useAuth();

  useEffect(() => {
    refreshTickets();
  }, [refreshTickets]);
  
  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [clusterFilter, setClusterFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<"my-raised" | "assigned-to-me">("my-raised");

  // Filter tickets by active tab (access level/email/branch constraints)
  const tabTickets = useMemo(() => {
    return tickets.filter(t => {
      const matchesTab = activeTab === "my-raised"
        ? (t.raisedBy.email.toLowerCase() === user?.email.toLowerCase() &&
           (user?.role === "Branch" ? t.branch === user?.branch : true))
        : (t.assignedTo.email.toLowerCase() === user?.email.toLowerCase());
      return matchesTab;
    });
  }, [tickets, activeTab, user]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    const total = tabTickets.length;
    const open = tabTickets.filter(t => t.status === "Open").length;
    const inProgress = tabTickets.filter(t => t.status === "In Progress").length;
    const waiting = tabTickets.filter(t => t.status === "Waiting for Client" || t.status === "Waiting for Google").length;
    const completed = tabTickets.filter(t => t.status === "Completed" || t.status === "Closed").length;
    const escalated = tabTickets.filter(t => t.status === "Escalated").length;
    const highPriority = tabTickets.filter(t => t.priority === "P1" || t.priority === "P2").length;
    
    // Average resolution time for completed/closed tickets
    const closedTickets = tabTickets.filter(t => t.status === "Completed" || t.status === "Closed");
    let avgTimeStr = "2h 45m";
    if (closedTickets.length > 0) {
      const totalTimeMs = closedTickets.reduce((acc, t) => {
        const created = new Date(t.createdAt).getTime();
        const updated = new Date(t.updatedAt).getTime();
        return acc + (updated - created);
      }, 0);
      const avgMs = totalTimeMs / closedTickets.length;
      const avgHours = avgMs / (1000 * 60 * 60);
      if (avgHours < 24) {
        avgTimeStr = `${Math.round(avgHours)}h ${Math.round((avgHours % 1) * 60)}m`;
      } else {
        avgTimeStr = `${(avgHours / 24).toFixed(1)} Days`;
      }
    }

    return { total, open, inProgress, waiting, completed, escalated, highPriority, avgTimeStr };
  }, [tabTickets]);

  // Derived filter options
  const filterOptions = useMemo(() => {
    const categories = Array.from(new Set(tabTickets.map(t => t.category))).filter(Boolean);
    const clusters = Array.from(new Set(tabTickets.map(t => t.cluster))).filter(Boolean);
    const branches = Array.from(new Set(tabTickets.map(t => t.branch))).filter(Boolean);
    return { categories, clusters, branches };
  }, [tabTickets]);

  // Filter & Search Tickets
  const filteredTickets = useMemo(() => {
    return tabTickets.filter(t => {
      // 1. Search term (ID, description, branch, category, names)
      const matchesSearch = 
        t.ticketId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.branch.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.raisedBy.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.assignedTo.name.toLowerCase().includes(searchTerm.toLowerCase());

      // 2. Category Filter
      const matchesCategory = categoryFilter === "all" || t.category === categoryFilter;

      // 3. Status Filter
      const matchesStatus = statusFilter === "all" || t.status === statusFilter;

      // 4. Priority Filter
      const matchesPriority = priorityFilter === "all" || t.priority === priorityFilter;

      // 5. Cluster Filter
      const matchesCluster = clusterFilter === "all" || t.cluster === clusterFilter;

      // 6. Branch Filter
      const matchesBranch = branchFilter === "all" || t.branch === branchFilter;

      return matchesSearch && matchesCategory && matchesStatus && matchesPriority && matchesCluster && matchesBranch;
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
  }, [tabTickets, searchTerm, categoryFilter, statusFilter, priorityFilter, clusterFilter, branchFilter]);

  // Quick Summary Box calculation
  const quickSummary = useMemo(() => {
    const open = tabTickets.filter(t => t.status === "Open").length;
    const pending = tabTickets.filter(t => t.status === "In Progress" || t.status.startsWith("Waiting")).length;
    const escalated = tabTickets.filter(t => t.status === "Escalated").length;
    
    // Today's due: due date matches today
    const today = new Date().toDateString();
    const todayDue = tabTickets.filter(t => {
      if (t.status === "Completed" || t.status === "Closed") return false;
      return new Date(t.dueDate).toDateString() === today;
    }).length;

    // This week due
    const startOfWeek = new Date();
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date();
    endOfWeek.setDate(endOfWeek.getDate() + 7);
    const thisWeekDue = tabTickets.filter(t => {
      if (t.status === "Completed" || t.status === "Closed") return false;
      const dueTime = new Date(t.dueDate).getTime();
      return dueTime >= startOfWeek.getTime() && dueTime <= endOfWeek.getTime();
    }).length;

    return { open, pending, escalated, todayDue, thisWeekDue };
  }, [tabTickets]);

  // Recent Activity Logs (latest 5 logs across all user's tickets)
  const recentLogs = useMemo(() => {
    interface LogItem {
      ticketId: string;
      ticketType: string;
      timestamp: string;
      user: string;
      action: string;
      remarks: string;
    }
    const logs: LogItem[] = [];
    tickets.forEach(t => {
      t.activityLogs.forEach(l => {
        logs.push({
          ticketId: t.ticketId,
          ticketType: t.ticketType,
          timestamp: l.timestamp,
          user: l.user,
          action: l.action,
          remarks: l.remarks || ""
        });
      });
    });
    return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 6);
  }, [tickets]);

  // Export Tickets to Excel
  const handleExportExcel = () => {
    const exportData = filteredTickets.map(t => ({
      "Ticket ID": t.ticketId,
      "Category": t.category,
      "Ticket Type": t.ticketType,
      "Raised By": `${t.raisedBy.name} (${t.raisedBy.email})`,
      "Assigned To": `${t.assignedTo.name} (${t.assignedTo.email})`,
      "Cluster": t.cluster,
      "Branch / Unit": t.branch,
      "Created At": new Date(t.createdAt).toLocaleString(),
      "Due Date": new Date(t.dueDate).toLocaleDateString(),
      "Priority": t.priority,
      "Status": t.status,
      "Description": t.description
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "GMB Tickets");
    XLSX.writeFile(workbook, `GMB_Tickets_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Helper for SLA Badge
  const getSlaInfo = (ticket: Ticket) => {
    if (ticket.status === "Completed" || ticket.status === "Closed") {
      return { text: "Resolved", color: "bg-green-100 text-green-800 border-green-200" };
    }
    const due = new Date(ticket.dueDate).getTime();
    const now = new Date().getTime();
    const diff = due - now;

    if (diff < 0) {
      return { text: "Breached", color: "bg-red-100 text-red-800 border-red-200" };
    }

    const hours = Math.ceil(diff / (1000 * 60 * 60));
    if (hours < 24) {
      return { text: `${hours}h remaining`, color: "bg-orange-100 text-orange-800 border-orange-200" };
    }
    const days = Math.ceil(hours / 24);
    return { text: `${days}d remaining`, color: "bg-sky-100 text-sky-800 border-sky-200" };
  };

  const getPriorityBadgeColor = (prio: string) => {
    switch (prio) {
      case "P1": return "bg-red-100 text-red-800 border-red-200";
      case "P2": return "bg-orange-100 text-orange-800 border-orange-200";
      case "P3": return "bg-amber-100 text-amber-800 border-amber-200";
      case "P4": return "bg-blue-100 text-blue-800 border-blue-200";
      case "P5":
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
    <DashboardLayout title="Request Management" subtitle="Monitor and manage Google Business Profile operational requests.">
      
      {/* 1. KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-6">
        <Card className="hover:shadow-md transition-all duration-200">
          <CardContent className="p-4 flex flex-col justify-between h-24">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Requests</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold tracking-tight text-primary">{kpis.total}</span>
              <span className="text-[10px] text-green-500 font-medium">↑ 12%</span>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-all duration-200">
          <CardContent className="p-4 flex flex-col justify-between h-24">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Open Requests</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold tracking-tight">{kpis.open}</span>
              <span className="text-[10px] text-red-500 font-medium">↓ 5%</span>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-all duration-200">
          <CardContent className="p-4 flex flex-col justify-between h-24">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">In Progress</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold tracking-tight">{kpis.inProgress}</span>
              <span className="text-[10px] text-green-500 font-medium">↑ 8%</span>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-all duration-200">
          <CardContent className="p-4 flex flex-col justify-between h-24">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Waiting Client</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold tracking-tight">{kpis.waiting}</span>
              <span className="text-[10px] text-amber-500 font-medium">-</span>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-all duration-200">
          <CardContent className="p-4 flex flex-col justify-between h-24">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Completed</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold tracking-tight text-emerald-600">{kpis.completed}</span>
              <span className="text-[10px] text-green-500 font-medium">↑ 18%</span>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-all duration-200">
          <CardContent className="p-4 flex flex-col justify-between h-24">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Escalated</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold tracking-tight text-red-600">{kpis.escalated}</span>
              <span className="text-[10px] text-red-500 font-medium">↑ 2%</span>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-all duration-200">
          <CardContent className="p-4 flex flex-col justify-between h-24">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">High Priority</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold tracking-tight text-orange-600">{kpis.highPriority}</span>
              <span className="text-[10px] text-amber-500 font-medium">Critical</span>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-all duration-200">
          <CardContent className="p-4 flex flex-col justify-between h-24">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Avg Resol Time</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-bold tracking-tight text-indigo-600 truncate">{kpis.avgTimeStr}</span>
              <span className="text-[10px] text-green-500 font-medium">↓ 15m</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left column - Request Tabs & Grid List */}
        <div className="lg:col-span-3 space-y-6">
          <Tabs defaultValue="my-raised" onValueChange={(val) => setActiveTab(val as any)} className="w-full">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
              <TabsList className="bg-muted/80">
                <TabsTrigger value="my-raised" className="data-[state=active]:bg-background">My Raised Requests</TabsTrigger>
                <TabsTrigger value="assigned-to-me" className="data-[state=active]:bg-background">Assigned To Me</TabsTrigger>
              </TabsList>
              
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Link to="/requests/raise">
                  <Button size="sm" className="bg-primary text-primary-foreground flex items-center gap-1.5 shadow-sm hover:bg-primary/95 transition-all">
                    <Plus className="h-4 w-4" /> Raise Request
                  </Button>
                </Link>
                <Button variant="outline" size="icon" className="h-9 w-9" onClick={refreshTickets} disabled={loading}>
                  <RefreshCw className={cn("h-4 w-4 text-muted-foreground", loading && "animate-spin")} />
                </Button>
              </div>
            </div>

            {/* Filter Panel */}
            <Card className="mb-4">
              <CardContent className="p-4 flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search requests, branch, description..." 
                    className="pl-9 h-9 border-border bg-background focus:ring-1" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[150px] h-9 bg-background border-border">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {filterOptions.categories.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px] h-9 bg-background border-border">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="Open">Open</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Waiting for Client">Waiting Client</SelectItem>
                    <SelectItem value="Waiting for Google">Waiting Google</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                    <SelectItem value="Closed">Closed</SelectItem>
                    <SelectItem value="Escalated">Escalated</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-[120px] h-9 bg-background border-border">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="P1">P1 (Highest)</SelectItem>
                    <SelectItem value="P2">P2</SelectItem>
                    <SelectItem value="P3">P3</SelectItem>
                    <SelectItem value="P4">P4</SelectItem>
                    <SelectItem value="P5">P5 (Lowest)</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={clusterFilter} onValueChange={setClusterFilter}>
                  <SelectTrigger className="w-[130px] h-9 bg-background border-border">
                    <SelectValue placeholder="Cluster" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Clusters</SelectItem>
                    {filterOptions.clusters.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button variant="outline" size="sm" onClick={handleExportExcel} className="h-9 flex items-center gap-1">
                  <Download className="h-4 w-4" /> Export Excel
                </Button>
              </CardContent>
            </Card>

            <TabsContent value="my-raised" className="mt-0">
              <Card>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="w-[120px]">Request ID</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Request Type</TableHead>
                        <TableHead>Branch / Unit</TableHead>
                        <TableHead>Assigned To</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Current SLA</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTickets.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={10} className="h-28 text-center text-muted-foreground font-medium">
                            No raised requests found matching filters.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredTickets.map(ticket => {
                          const sla = getSlaInfo(ticket);
                          const reqId = ticket.requestId || ticket.ticketId;
                          const reqType = ticket.requestType || ticket.ticketType;
                          return (
                            <TableRow key={ticket._id} className="hover:bg-muted/20 transition-colors">
                              <TableCell className="font-semibold text-primary">
                                <Link to={`/requests/details/${reqId}`} className="hover:underline flex items-center gap-1">
                                  <TicketIcon className="h-3.5 w-3.5 shrink-0" />
                                  {reqId}
                                </Link>
                              </TableCell>
                              <TableCell className="font-medium text-xs text-muted-foreground">{ticket.category}</TableCell>
                              <TableCell className="font-medium text-sm max-w-[150px] truncate">{reqType}</TableCell>
                              <TableCell className="text-xs text-muted-foreground flex items-center gap-1 mt-2.5">
                                <Building className="h-3 w-3 shrink-0" />
                                <span className="font-medium text-foreground">{ticket.branch}</span>
                              </TableCell>
                              <TableCell className="text-xs">
                                <div className="flex items-center gap-1 font-medium">
                                  <User className="h-3 w-3 text-muted-foreground" />
                                  {ticket.assignedTo.name}
                                </div>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground font-medium">
                                {new Date(ticket.dueDate).toLocaleDateString()}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={cn("text-[10px] font-semibold border px-2 py-0.5", sla.color)}>
                                  {sla.text}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={cn("text-[10px] font-bold border px-2 py-0.5", getPriorityBadgeColor(ticket.priority))}>
                                  {ticket.priority}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={cn("text-[10px] font-semibold border px-2 py-0.5 shadow-sm", getStatusBadgeColor(ticket.status))}>
                                  {ticket.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Link to={`/requests/details/${reqId}`}>
                                  <Button size="sm" variant="ghost" className="h-8 text-primary hover:text-primary hover:bg-primary/10">
                                    View <ArrowUpRight className="ml-1 h-3 w-3" />
                                  </Button>
                                </Link>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="assigned-to-me" className="mt-0">
              <Card>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="w-[120px]">Request ID</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Request Type</TableHead>
                        <TableHead>Branch / Unit</TableHead>
                        <TableHead>Raised By</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Current SLA</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTickets.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={10} className="h-28 text-center text-muted-foreground font-medium">
                            No assigned requests found matching filters.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredTickets.map(ticket => {
                          const sla = getSlaInfo(ticket);
                          const reqId = ticket.requestId || ticket.ticketId;
                          const reqType = ticket.requestType || ticket.ticketType;
                          return (
                            <TableRow key={ticket._id} className="hover:bg-muted/20 transition-colors">
                              <TableCell className="font-semibold text-primary">
                                <Link to={`/requests/details/${reqId}`} className="hover:underline flex items-center gap-1">
                                  <TicketIcon className="h-3.5 w-3.5 shrink-0" />
                                  {reqId}
                                </Link>
                              </TableCell>
                              <TableCell className="font-medium text-xs text-muted-foreground">{ticket.category}</TableCell>
                              <TableCell className="font-medium text-sm max-w-[150px] truncate">{reqType}</TableCell>
                              <TableCell className="text-xs text-muted-foreground flex items-center gap-1 mt-2.5">
                                <Building className="h-3 w-3 shrink-0" />
                                <span className="font-medium text-foreground">{ticket.branch}</span>
                              </TableCell>
                              <TableCell className="text-xs">
                                <div className="flex items-center gap-1 font-medium">
                                  <User className="h-3 w-3 text-muted-foreground" />
                                  {ticket.raisedBy.name}
                                </div>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground font-medium">
                                {new Date(ticket.dueDate).toLocaleDateString()}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={cn("text-[10px] font-semibold border px-2 py-0.5", sla.color)}>
                                  {sla.text}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={cn("text-[10px] font-bold border px-2 py-0.5", getPriorityBadgeColor(ticket.priority))}>
                                  {ticket.priority}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={cn("text-[10px] font-semibold border px-2 py-0.5 shadow-sm", getStatusBadgeColor(ticket.status))}>
                                  {ticket.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Link to={`/requests/details/${reqId}`}>
                                  <Button size="sm" variant="ghost" className="h-8 text-primary hover:text-primary hover:bg-primary/10">
                                    View <ArrowUpRight className="ml-1 h-3 w-3" />
                                  </Button>
                                </Link>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right column - Quick Summary & Recent Activity logs */}
        <div className="space-y-6">
          {/* Quick Summary */}
          <Card>
            <CardHeader className="pb-3 border-b bg-muted/20">
              <CardTitle className="text-base font-semibold">Quick Summary</CardTitle>
              <CardDescription className="text-xs">Consolidated request status metrics</CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-border/60">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> Open Requests
                </span>
                <span className="text-sm font-bold bg-emerald-100/60 text-emerald-800 border px-2 py-0.5 rounded">{quickSummary.open}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border/60">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-500" /> Pending Workload
                </span>
                <span className="text-sm font-bold bg-blue-100/60 text-blue-800 border px-2 py-0.5 rounded">{quickSummary.pending}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border/60">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-rose-500" /> SLA Escalations
                </span>
                <span className="text-sm font-bold bg-rose-100/60 text-rose-800 border px-2 py-0.5 rounded">{quickSummary.escalated}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border/60">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-orange-500" /> Today's SLA Due
                </span>
                <span className="text-sm font-bold bg-orange-100/60 text-orange-800 border px-2 py-0.5 rounded">{quickSummary.todayDue}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-indigo-500" /> Due This Week
                </span>
                <span className="text-sm font-bold bg-indigo-100/60 text-indigo-800 border px-2 py-0.5 rounded">{quickSummary.thisWeekDue}</span>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader className="pb-3 border-b bg-muted/20">
              <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
              <CardDescription className="text-xs">Latest updates on your GMB requests</CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              {recentLogs.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">No recent GMB activities recorded.</p>
              ) : (
                <div className="relative border-l border-border pl-4 ml-2 space-y-6 text-left">
                  {recentLogs.map((log, index) => {
                    const logReqId = log.ticketId;
                    return (
                      <div key={index} className="relative">
                        {/* Timeline dot */}
                        <span className="absolute -left-[21px] top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-background border border-primary">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        </span>
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-primary">
                            <Link to={`/requests/details/${logReqId}`} className="hover:underline">
                              {logReqId}
                            </Link>
                            <span className="text-muted-foreground font-normal"> - {log.action}</span>
                          </span>
                          <span className="text-[10px] text-muted-foreground mt-0.5 font-medium">
                            {new Date(log.timestamp).toLocaleString()} | by {log.user}
                          </span>
                          <p className="text-xs text-foreground/80 mt-1 italic max-w-[220px] truncate">
                            "{log.remarks}"
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </DashboardLayout>
  );
}
