import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/components/ui/use-toast";
import { useTickets } from "@/contexts/TicketContext";
import { 
  Upload, 
  ArrowLeft, 
  Sparkles, 
  UserCheck, 
  Paperclip,
  CheckCircle2,
  Info
} from "lucide-react";

interface TargetUser {
  _id: string;
  user: string;
  mail: string;
  orgEmail: string;
  Name: string;
  Branch: string;
  Cluster: string;
}

const MULTIPLIER_CATEGORIES: Record<string, string[]> = {
  "GMB Profile Optimization": [
    "Add Missing Services / Categories",
    "Update Business Description & Offerings",
    "Upload New Location Photos / Media"
  ],
  "GBP Review Response Instruction": [
    "Draft Reply to Negative Review",
    "Initiate Review Response Audit",
    "Draft Response to High-Priority Patient Feedback"
  ],
  "GMB Data Cleanse / Alignment": [
    "Verify Business Coordinates / Map Pin",
    "Update Primary Phone / Contact details",
    "Verify Special Working Hours alignment"
  ],
  "Unit Training & Guidelines": [
    "Schedule Review Gathering Training",
    "Upload Optimization Best Practices document"
  ]
};

const TICKET_TYPE_DESCRIPTIONS: Record<string, string> = {
  "Add Missing Services / Categories": "Add missing medical specialities, treatment categories, and service items.",
  "Update Business Description & Offerings": "Refine profile description, OPD timings, and key service offerings.",
  "Upload New Location Photos / Media": "Add fresh facility, equipment, and doctor portraits to improve visual rank.",
  "Draft Reply to Negative Review": "Provide professional response templates for critical or negative patient feedback.",
  "Initiate Review Response Audit": "Perform audit on review response rate and patient sentiment.",
  "Draft Response to High-Priority Patient Feedback": "Escalated review response drafts for senior management approval.",
  "Verify Business Coordinates / Map Pin": "Audit and calibrate geo-coordinates for precise direction routing.",
  "Update Primary Phone / Contact details": "Audit and align helpline numbers across directory listings.",
  "Verify Special Working Hours alignment": "Align holiday hours and emergency OPD schedules.",
  "Schedule Review Gathering Training": "Conduct training sessions for branch staff on gathering patient reviews.",
  "Upload Optimization Best Practices document": "Share GMB ranking best practices and guidelines with branch SPOCs."
};

export default function MultiplierRaiseRequest() {
  const { user } = useAuth();
  const { refreshTickets } = useTickets();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loadingUsers, setLoadingUsers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [users, setUsers] = useState<TargetUser[]>([]);

  // Form values
  const [targetUserEmail, setTargetUserEmail] = useState("");
  const [category, setCategory] = useState("");
  const [ticketType, setTicketType] = useState("");
  const [description, setDescription] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);

  const API_BASE_URL = `${import.meta.env.VITE_API_BASE_URL || "http://localhost:5000"}/api`;

  // Fetch users in the cluster managed by this Multiplier team member
  useEffect(() => {
    if (!user?.email) return;
    setLoadingUsers(true);
    fetch(`${API_BASE_URL}/multiplier/users?email=${user.email}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setUsers(data.data);
        } else {
          toast({
            title: "Fetch Error",
            description: data.error || "Failed to load cluster users.",
            variant: "destructive"
          });
        }
      })
      .catch(err => {
        console.error("Error fetching cluster users:", err);
        toast({
          title: "Network Error",
          description: "Could not fetch cluster users from the server.",
          variant: "destructive"
        });
      })
      .finally(() => {
        setLoadingUsers(false);
      });
  }, [user?.email, API_BASE_URL, toast]);

  // Reset ticket type on category change
  useEffect(() => {
    setTicketType("");
  }, [category]);

  // Selected target user details
  const selectedUser = useMemo(() => {
    return users.find(u => (u.orgEmail || u.mail) === targetUserEmail) || null;
  }, [targetUserEmail, users]);

  // Handle files
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments(Array.from(e.target.files));
    }
  };

  // Submit request
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!targetUserEmail || !category || !ticketType || !description.trim()) {
      toast({
        title: "Missing Fields",
        description: "Please fill out all required fields.",
        variant: "destructive"
      });
      return;
    }

    if (!selectedUser) {
      toast({
        title: "User Error",
        description: "Selected recipient user is invalid.",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("category", category);
      formData.append("ticketType", ticketType);
      formData.append("raisedByName", user?.name || "Multiplier Manager");
      formData.append("raisedByEmail", user?.email || "");
      formData.append("raisedByRole", "Multiplier");
      formData.append("assignedToName", selectedUser.Name || selectedUser.user || "Branch SPOC");
      formData.append("assignedToEmail", targetUserEmail);
      formData.append("cluster", selectedUser.Cluster || "");
      formData.append("branch", selectedUser.Branch || "");
      formData.append("description", description.trim());

      attachments.forEach((file) => {
        formData.append("attachments", file);
      });

      const res = await fetch(`${API_BASE_URL}/requests`, {
        method: "POST",
        body: formData
      });
      const data = await res.json();

      if (data.success) {
        toast({
          title: "Request Dispatched",
          description: "Your optimization request has been raised and assigned to the unit SPOC successfully.",
        });
        refreshTickets();
        navigate("/requests/dashboard");
      } else {
        throw new Error(data.error || "Failed to create request");
      }
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Submission Failed",
        description: err.message || "An error occurred during submission.",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout title="Request to Branch" subtitle="Dispatch operational or optimization instructions to a specific Branch SPOC in your cluster">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-2">
          <Link to="/requests/dashboard">
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Request Dashboard
            </Button>
          </Link>
        </div>

        <Card className="border-primary/15 shadow-lg relative overflow-hidden bg-background">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-teal-500/5 rounded-full blur-2xl pointer-events-none" />

          <CardHeader className="border-b pb-4 bg-muted/5">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary animate-pulse" />
              New Optimization Request
            </CardTitle>
            <CardDescription className="text-xs">
              Fill out the instructions below. The target user will receive an email and a dashboard notification.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Target Recipient User */}
              <div className="space-y-2 text-left">
                <Label htmlFor="recipient" className="text-xs font-bold flex items-center gap-1">
                  Target Recipient SPOC (Branch User) <span className="text-destructive">*</span>
                </Label>
                <Select value={targetUserEmail} onValueChange={setTargetUserEmail} disabled={loadingUsers}>
                  <SelectTrigger id="recipient" className="h-10 text-xs">
                    <SelectValue placeholder={loadingUsers ? "Loading cluster users..." : "Select Target SPOC"} />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => {
                      const emailVal = u.orgEmail || u.mail;
                      return (
                        <SelectItem key={u._id} value={emailVal}>
                          {`${u.Name || u.user} (${emailVal}) - Branch: ${u.Branch || "All"}`}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {selectedUser && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-teal-500/5 border border-teal-500/10 text-[11px] text-teal-700 font-semibold mt-1.5 animate-in slide-in-from-top-1 duration-200">
                    <UserCheck className="h-3.5 w-3.5" />
                    <span>Selected: {selectedUser.Name || selectedUser.user} | Branch: {selectedUser.Branch} (Cluster: {selectedUser.Cluster})</span>
                  </div>
                )}
              </div>

              {/* Category */}
              <div className="space-y-2 text-left">
                <Label htmlFor="category" className="text-xs font-bold">
                  Request Category <span className="text-destructive">*</span>
                </Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="category" className="h-10 text-xs">
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(MULTIPLIER_CATEGORIES).map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Ticket Type (Subcategory) */}
              <div className="space-y-2 text-left">
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="ticketType" className="text-xs font-bold">
                    Task Type <span className="text-destructive">*</span>
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="ghost" size="icon" className="h-4 w-4 rounded-full text-sky-600 bg-sky-50 hover:bg-sky-100 border border-sky-200 shadow-xs">
                        <Info className="h-3 w-3" />
                        <span className="sr-only">Task Type Description</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent side="top" className="w-72 p-3 text-xs bg-background border border-border shadow-xl space-y-1.5">
                      <div className="font-bold text-sky-600 flex items-center gap-1">
                        <Info className="h-3.5 w-3.5" />
                        {ticketType ? ticketType : "Task Type Information"}
                      </div>
                      <p className="text-muted-foreground leading-normal">
                        {ticketType && TICKET_TYPE_DESCRIPTIONS[ticketType]
                          ? TICKET_TYPE_DESCRIPTIONS[ticketType]
                          : category
                          ? "Select a Task Type from the dropdown to view its specific guidelines."
                          : "Select a Category and Task Type to view its short description."}
                      </p>
                    </PopoverContent>
                  </Popover>
                </div>
                <Select value={ticketType} onValueChange={setTicketType} disabled={!category}>
                  <SelectTrigger id="ticketType" className="h-10 text-xs">
                    <SelectValue placeholder={category ? "Select Task Type" : "Please select a category first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {category && MULTIPLIER_CATEGORIES[category].map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {ticketType && TICKET_TYPE_DESCRIPTIONS[ticketType] && (
                  <p className="text-[11px] text-sky-700 bg-sky-50 dark:bg-sky-950/50 dark:text-sky-300 p-2 rounded-md border border-sky-200/60 font-medium flex items-center gap-1.5 mt-1 animate-in fade-in-50 duration-200">
                    <Info className="h-3.5 w-3.5 shrink-0 text-sky-600" />
                    <span>{TICKET_TYPE_DESCRIPTIONS[ticketType]}</span>
                  </p>
                )}
              </div>

              {/* Instructions / Description */}
              <div className="space-y-2 text-left">
                <Label htmlFor="description" className="text-xs font-bold">
                  Actionable Instructions / Description <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="description"
                  placeholder="Detail the instructions or change request clearly so the branch SPOC can execute them..."
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="text-xs border-primary/5 focus-visible:ring-primary/20 leading-relaxed font-medium"
                />
              </div>

              {/* Attachments */}
              <div className="space-y-2 text-left">
                <Label htmlFor="attachments" className="text-xs font-bold flex items-center gap-1.5">
                  <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                  Supporting Files / Guidelines (Optional)
                </Label>
                <Input
                  id="attachments"
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  className="text-xs h-10 cursor-pointer"
                />
                {attachments.length > 0 && (
                  <div className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1 mt-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    Selected {attachments.length} files
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={submitting}
                className="w-full h-10 font-bold gap-2 text-xs"
              >
                {submitting ? (
                  "Submitting Request..."
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Submit Request to Branch SPOC
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
