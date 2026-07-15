import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useTickets } from "@/contexts/TicketContext";
import { useAuth } from "@/contexts/AuthContext";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { 
  Download, 
  Upload, 
  ArrowLeft, 
  Sparkles, 
  UserCheck, 
  FileSpreadsheet, 
  CheckCircle,
  Paperclip
} from "lucide-react";
import * as XLSX from "xlsx";

const CLIENT_CATEGORY_MAP: Record<string, string[]> = {
  "Profile Creation": [
    "Create new Google Business Profile"
  ],
  "Profile Verification": [
    "Through Phone Number or Email"
  ],
  "Ownership & Access": [
    "Add/Remove Manager"
  ],
  "Profile Updates": [
    "Update business name",
    "Update address",
    "Update phone number",
    "Update website",
    "Update Business Hours",
    "Update Business Description",
    "Add/Update departments",
    "Doctor Transfer",
    "Map Pin Correction",
    "Keyword Optimization"
  ],
  "Profile Removal": [
    "Remove doctor profile"
  ],
  "Content": [
    "Update Products & Services",
    "Upload photos / Videos",
    "Publish posts (Events / Offers/ Related to speciality)",
    "Update Cover & Logo",
    "Irrelevant Content & Photos"
  ],
  "Reviews": [
    "Missing reviews",
    "Rating Drop Investigation",
    "Fake Review Escalation"
  ],
  "Suspensions": [
    "Suspended profile to be Reinstatement"
  ],
  "Duplicates": [
    "Remove duplicate profile"
  ],
  "Merging": [
    "Merge duplicate listings"
  ],
  "Closure": [
    "Close/Mark permanently closed"
  ],
  "Performance Reporting & Optimization": [
    "Competitor Analysis",
    "Performance reports",
    "Weekly Optimization Report"
  ],
  "Others": []
};

const MULTIPLIER_CATEGORY_MAP: Record<string, string[]> = {
  "Profile Verification": [
    "Verify GBP through Video & Phone number"
  ],
  "Ownership & Access": [
    "Request ownership for existing profiles"
  ],
  "Suspensions": [
    "Ask supporting documents to verify the profiles"
  ],
  "Others": []
};

const getTemplateColumns = (category: string, ticketType: string, isMultiplier: boolean): string[] => {
  if (isMultiplier) {
    if (category === "Profile Verification") {
      if (ticketType === "Verify GBP through Video & Phone number") {
        return ["Phone Number", "OTP", "Video Verification Support Details"];
      }
    }
    if (category === "Ownership & Access") {
      if (ticketType === "Request ownership for existing profiles") {
        return ["Profiles to Request Access (Links/Names)"];
      }
    }
    if (category === "Suspensions") {
      if (ticketType === "Ask supporting documents to verify the profiles") {
        return ["Profile Link", "Business License", "Doctor Registration Certificate", "Name Board Photo", "Storefront Photos", "Website", "Explanation"];
      }
    }
  } else {
    if (category === "Profile Creation") {
      if (ticketType === "Create new Google Business Profile") {
        return ["Doctor/Hospital Name", "Category", "Address", "Phone Number", "Website URL", "Business Hours", "Email ID", "Latitude & Longitude", "Appointment URL", "Description", "Photos", "Logo", "Cover Image"];
      }
    }
    if (category === "Profile Verification") {
      if (ticketType === "Through Phone Number or Email") {
        return ["Phone number"];
      }
    }
    if (category === "Ownership & Access") {
      if (ticketType === "Add/Remove Manager") {
        return ["Gmail ID to be added/removed", "Profile Link", "Approval from authorized SPOC"];
      }
    }
    if (category === "Profile Updates") {
      if (ticketType === "Update business name") {
        return ["Correct Business Name", "Supporting proof (Doctor License/Visiting Card/Name Board)"];
      }
      if (ticketType === "Update address") {
        return ["Complete New Address", "PIN Code", "Location Photos"];
      }
      if (ticketType === "Update phone number") {
        return ["Correct Phone Number"];
      }
      if (ticketType === "Update website") {
        return ["Correct Website URL"];
      }
      if (ticketType === "Update Business Hours") {
        return ["Updated Working Hours", "Weekly Off Details"];
      }
      if (ticketType === "Update Business Description") {
        return ["Approved Business Description or required keywords"];
      }
      if (ticketType === "Add/Update departments") {
        return ["Department Name", "Category", "Contact Number (if separate)", "Description"];
      }
      if (ticketType === "Doctor Transfer") {
        return ["Existing Profile Link", "New Hospital/Clinic Details", "Effective Date"];
      }
      if (ticketType === "Map Pin Correction") {
        return ["Correct Google Maps Location or Latitude & Longitude", "Front Entrance Photo"];
      }
      if (ticketType === "Keyword Optimization") {
        return ["Target Keywords", "Target Location", "Priority Services/Specialties"];
      }
    }
    if (category === "Profile Removal") {
      if (ticketType === "Remove doctor profile") {
        return ["Profile Link", "Reason for Removal"];
      }
    }
    if (category === "Content") {
      if (ticketType === "Update Products & Services") {
        return ["List of Services/Products", "Descriptions", "Pricing (if applicable)"];
      }
      if (ticketType === "Upload photos / Videos") {
        return ["High-quality Photos/Videos"];
      }
      if (ticketType === "Publish posts (Events / Offers/ Related to speciality)") {
        return ["Content", "Image", "CTA Link", "Offer/Event Details", "Publish Date"];
      }
      if (ticketType === "Update Cover & Logo") {
        return ["High-resolution Logo and Cover Image"];
      }
      if (ticketType === "Irrelevant Content & Photos") {
        return ["Business name", "Screenshot of irrelevant content or photo to be removed"];
      }
    }
    if (category === "Reviews") {
      if (ticketType === "Missing reviews") {
        return ["Profile Link", "Missing Review Screenshot", "Reviewer Name", "Approximate Review Date"];
      }
      if (ticketType === "Rating Drop Investigation") {
        return ["Profile Link", "Timeline when rating dropped", "Supporting Screenshots"];
      }
      if (ticketType === "Fake Review Escalation") {
        return ["Review Screenshot", "Review Link", "Reason for reporting", "Supporting Evidence"];
      }
    }
    if (category === "Suspensions") {
      if (ticketType === "Suspended profile to be Reinstatement") {
        return ["Profile Link", "Business License", "Doctor Registration Certificate", "Name Board Photo", "Storefront Photos", "Website", "Explanation"];
      }
    }
    if (category === "Duplicates") {
      if (ticketType === "Remove duplicate profile") {
        return ["Original Profile Link", "Duplicate Profile Link", "Confirmation of correct listing"];
      }
    }
    if (category === "Merging") {
      if (ticketType === "Merge duplicate listings") {
        return ["Both Profile Links", "Confirmation of primary profile", "Supporting details"];
      }
    }
    if (category === "Closure") {
      if (ticketType === "Close/Mark permanently closed") {
        return ["Profile Link", "Closure Confirmation", "Closure Date"];
      }
    }
    if (category === "Performance Reporting & Optimization") {
      if (ticketType === "Competitor Analysis") {
        return ["Competitor Profile Links or Names", "Target Keywords", "Target Location"];
      }
      if (ticketType === "Performance reports") {
        return ["Reporting Period (Weekly/Monthly)", "Specific KPIs"];
      }
      if (ticketType === "Weekly Optimization Report") {
        return ["Reporting Period", "Cluster/Unit Details"];
      }
    }
  }
  return ["GMB Listing Link", "Required Action Details", "Contact Person Name", "Contact Email / Phone", "Remarks"];
};

export default function RaiseTicket() {
  const { user } = useAuth();
  const { createTicket, team, isMultiplier, currentMultiplierTeamMember } = useTickets();
  const navigate = useNavigate();
  const { toast } = useToast();

  const categoryMap = useMemo(() => {
    return isMultiplier ? MULTIPLIER_CATEGORY_MAP : CLIENT_CATEGORY_MAP;
  }, [isMultiplier]);

  const [loading, setLoading] = useState(false);
  const [branchesMeta, setBranchesMeta] = useState<{ branch: string; cluster: string }[]>([]);

  // Fetch lightweight branches/clusters mapping
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_BASE_URL || "http://localhost:5000"}/api/branches-meta`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setBranchesMeta(data.data);
        }
      })
      .catch(err => console.error("Error fetching branches metadata:", err));
  }, []);
  
  // Form values
  const [category, setCategory] = useState("");
  const [ticketType, setTicketType] = useState("");
  const [branch, setBranch] = useState(user?.role === "Branch" && user?.branch ? user.branch : "");
  const [description, setDescription] = useState("");
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);

  // Multiplier specific state for target assignee
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [assignedUserEmail, setAssignedUserEmail] = useState("");
  const [assignedUserName, setAssignedUserName] = useState("");

  // Fetch users if multiplier
  useEffect(() => {
    if (isMultiplier) {
      fetch(`${import.meta.env.VITE_API_BASE_URL || "http://localhost:5000"}/api/users`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data) {
            setAllUsers(data.data);
          }
        })
        .catch(err => console.error("Error fetching users for branch mapping:", err));
    }
  }, [isMultiplier]);

  // Derive all users in the same cluster as the multiplier
  const clusterUsers = useMemo(() => {
    if (!currentMultiplierTeamMember) return [];
    const allowedClusters = currentMultiplierTeamMember.clusters || 
      (currentMultiplierTeamMember.cluster ? [currentMultiplierTeamMember.cluster] : []);
    if (allowedClusters.length === 0) return [];

    return allUsers.filter(u => {
      return u.Cluster && allowedClusters.some(ac => ac && ac.toLowerCase() === u.Cluster.toLowerCase());
    });
  }, [allUsers, currentMultiplierTeamMember]);

  // Synchronize branch with selected user's Branch/Cluster
  useEffect(() => {
    if (isMultiplier && assignedUserEmail) {
      const selectedUserObj = clusterUsers.find(u => (u.orgEmail || u.mail) === assignedUserEmail);
      if (selectedUserObj) {
        setBranch(selectedUserObj.Branch || selectedUserObj.Cluster || "All");
      }
    }
  }, [assignedUserEmail, clusterUsers, isMultiplier]);

  // Auto-select assignee if there is only 1 user for the cluster
  useEffect(() => {
    if (isMultiplier) {
      if (clusterUsers.length === 1) {
        const u = clusterUsers[0];
        setAssignedUserEmail(u.orgEmail || u.mail || "");
        setAssignedUserName(u.Name || u.user || "");
      } else if (clusterUsers.length === 0) {
        setAssignedUserEmail("");
        setAssignedUserName("");
      } else {
        const stillExists = clusterUsers.some(u => (u.orgEmail || u.mail) === assignedUserEmail);
        if (!stillExists) {
          setAssignedUserEmail("");
          setAssignedUserName("");
        }
      }
    }
  }, [clusterUsers, isMultiplier, assignedUserEmail]);

  // Reset ticket type on category change
  useEffect(() => {
    setTicketType("");
  }, [category]);

  // Derive clusters & branches from branchesMeta data
  const { branches, clustersMap } = useMemo(() => {
    const map: Record<string, string> = {};
    branchesMeta.forEach((b: any) => {
      if (b.branch && b.cluster) {
        map[b.branch] = b.cluster;
      }
    });

    let activeBranches = branchesMeta.map((b: any) => b.branch).filter(Boolean).sort();

    // Explicitly filter branches based on user role to guarantee correctness
    if (isMultiplier && currentMultiplierTeamMember) {
      const allowedClusters = currentMultiplierTeamMember.clusters || 
        (currentMultiplierTeamMember.cluster ? [currentMultiplierTeamMember.cluster] : []);
      activeBranches = activeBranches.filter(br => {
        const brCluster = map[br];
        return brCluster && allowedClusters.some(ac => ac && ac.toLowerCase() === brCluster.toLowerCase());
      });
    } else if (user) {
      if (user.role === "Branch" && user.branch) {
        activeBranches = activeBranches.filter(br => br.toLowerCase() === user.branch!.toLowerCase());
        if (activeBranches.length === 0) {
          activeBranches = [user.branch];
        }
      } else if (user.role === "Cluster" && user.cluster) {
        activeBranches = activeBranches.filter(br => {
          const brCluster = map[br];
          return brCluster && brCluster.toLowerCase() === user.cluster!.toLowerCase();
        });
      }
    }

    return { branches: activeBranches, clustersMap: map };
  }, [branchesMeta, user, isMultiplier, currentMultiplierTeamMember]);

  // Derive cluster & auto-assigned person for the selected branch
  const derivedCluster = useMemo(() => {
    if (!branch) return "";
    let cl = clustersMap[branch] || "";
    // If clustersMap has not loaded yet, fallback to user's cluster for branch users or currentMultiplierTeamMember's cluster for multipliers
    if (!cl) {
      if (isMultiplier && currentMultiplierTeamMember) {
        const allowedClusters = currentMultiplierTeamMember.clusters || 
          (currentMultiplierTeamMember.cluster ? [currentMultiplierTeamMember.cluster] : []);
        cl = allowedClusters[0] || "";
      } else if (user && user.role === "Branch" && branch.toLowerCase() === user.branch?.toLowerCase()) {
        cl = user.cluster || "";
      }
    }
    return cl;
  }, [branch, clustersMap, user, isMultiplier, currentMultiplierTeamMember]);

  const assignedPerson = useMemo(() => {
    if (!derivedCluster) return null;
    
    // Look up Multiplier Team list (safely checking properties)
    const matches = team.filter(m => m && m.cluster && m.cluster.toLowerCase() === derivedCluster.toLowerCase());
    if (matches.length > 0) {
      // Return first match or list them
      return {
        name: matches.map(m => m.name).join(" / "),
        email: matches[0].email
      };
    }
    return { name: "Harsh (Default Owner)", email: "harsh@multipliersolutions.com" };
  }, [derivedCluster, team]);

  // Generate Excel Template dynamically
  const handleDownloadTemplate = () => {
    if (!category || !ticketType) {
      toast({
        title: "Download Rejected",
        description: "Please select a Category and Ticket Type first.",
        variant: "destructive"
      });
      return;
    }

    const columns = getTemplateColumns(category, ticketType, isMultiplier);

    const worksheet = XLSX.utils.json_to_sheet([], { header: columns });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
    
    // Save file
    const safeFilename = `${category.replace(/\s+/g, "_")}_Template.xlsx`;
    XLSX.writeFile(workbook, safeFilename);
    toast({
      title: "Template Downloaded",
      description: `Excel template "${safeFilename}" saved to your downloads.`,
    });
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls") && !file.name.endsWith(".csv")) {
        toast({
          title: "Invalid File Type",
          description: "Please upload an Excel file (.xlsx, .xls, .csv).",
          variant: "destructive"
        });
        e.target.value = "";
        return;
      }
      setExcelFile(file);
    }
  };

  const handleAttachmentsUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setAttachments(Array.from(files));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !ticketType || !branch || !description) {
      toast({
        title: "Validation Error",
        description: "Please fill in all mandatory fields.",
        variant: "destructive"
      });
      return;
    }

    if (category !== "Others" && !excelFile) {
      toast({
        title: "Mandatory Template Required",
        description: "Please fill and upload the Excel template sheet.",
        variant: "destructive"
      });
      return;
    }

    if (isMultiplier && !assignedUserEmail) {
      toast({
        title: "Validation Error",
        description: "Please select an assignee from the branch.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    const formData = new FormData();
    formData.append("category", category);
    formData.append("ticketType", ticketType);
    formData.append("raisedByName", user?.name || "Client SPOC");
    formData.append("raisedByEmail", user?.email || "spoc@manipal.com");
    formData.append("raisedByRole", user?.role || "Branch");
    formData.append("cluster", derivedCluster);
    formData.append("branch", branch);
    formData.append("description", description);
    
    if (isMultiplier) {
      formData.append("assignedToName", assignedUserName);
      formData.append("assignedToEmail", assignedUserEmail);
    }
    
    // Attach files
    if (excelFile) {
      formData.append("excelTemplate", excelFile);
    }
    
    attachments.forEach(file => {
      formData.append("attachments", file);
    });

    const result = await createTicket(formData);
    setLoading(false);
    
    if (result) {
      navigate("/tickets/dashboard");
    }
  };

  return (
    <DashboardLayout title="Raise Ticket" subtitle="Create a GMB operational request and assign to the Multiplier team.">
      <div className="max-w-4xl mx-auto space-y-6">
        
        <div className="flex items-center justify-between">
          <Link to="/tickets/dashboard">
            <Button variant="ghost" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Back to Dashboard
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <Card className="lg:col-span-2 shadow-sm border border-border">
            <CardHeader className="border-b bg-muted/10">
              <CardTitle className="text-lg">Raise GMB Request Ticket</CardTitle>
              <CardDescription>Fill out the ticket parameters below. Every ticket initiates a 7-day SLA cycle.</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-5 text-left">
                
                {/* 1. Category */}
                <div className="space-y-1.5">
                  <Label htmlFor="category" className="font-semibold text-sm">Category <span className="text-destructive">*</span></Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(categoryMap).map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 2. Ticket Type */}
                <div className="space-y-1.5">
                  <Label htmlFor="ticketType" className="font-semibold text-sm">Ticket Type <span className="text-destructive">*</span></Label>
                  {category === "Others" ? (
                    <Input
                      id="ticketType"
                      value={ticketType}
                      onChange={(e) => setTicketType(e.target.value)}
                      placeholder="Enter Ticket Type"
                      className="w-full"
                    />
                  ) : (
                    <Select value={ticketType} onValueChange={setTicketType} disabled={!category}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={category ? "Select Ticket Type" : "Please select Category first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {category && categoryMap[category] && categoryMap[category].map(type => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* 3. Branch Selection */}
                {!isMultiplier && (
                  <div className="space-y-1.5">
                    <Label htmlFor="branch" className="font-semibold text-sm">Branch / Unit <span className="text-destructive">*</span></Label>
                    <Select value={branch} onValueChange={setBranch} disabled={user?.role === "Branch"}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select Branch" />
                      </SelectTrigger>
                      <SelectContent>
                        {branches.map(br => (
                          <SelectItem key={br} value={br}>{br}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* 3.1. Assignee Selection for Multipliers */}
                {isMultiplier && (
                  <div className="space-y-1.5 text-left">
                    <Label htmlFor="assignee" className="font-semibold text-sm">Assign to (User in Cluster) <span className="text-destructive">*</span></Label>
                    <Select 
                      value={assignedUserEmail} 
                      onValueChange={(val) => {
                        const u = clusterUsers.find(user => (user.orgEmail || user.mail) === val);
                        setAssignedUserEmail(val);
                        setAssignedUserName(u ? (u.Name || u.user) : "");
                      }}
                      disabled={clusterUsers.length === 0}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={clusterUsers.length === 0 ? "No users in your cluster" : "Select User"} />
                      </SelectTrigger>
                      <SelectContent>
                        {clusterUsers.map(u => (
                          <SelectItem key={u.orgEmail || u.mail} value={u.orgEmail || u.mail}>
                            {u.Name || u.user} ({u.orgEmail || u.mail}) {u.Branch ? `- ${u.Branch}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* 4. Downloader Template */}
                {category && ticketType && category !== "Others" && (
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="h-8 w-8 text-primary shrink-0" />
                      <div>
                        <h4 className="text-sm font-semibold text-primary">Mandatory Excel Template</h4>
                        <p className="text-xs text-muted-foreground">Download, fill offline, and upload below.</p>
                      </div>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={handleDownloadTemplate} className="flex items-center gap-1">
                      <Download className="h-4 w-4" /> Download Template
                    </Button>
                  </div>
                )}

                {/* 5. Upload Excel */}
                <div className="space-y-1.5">
                  <Label htmlFor="excelFile" className="font-semibold text-sm">Upload Completed Excel Sheet {category !== "Others" && <span className="text-destructive">*</span>}</Label>
                  <div className="flex items-center gap-2">
                    <Input 
                      id="excelFile" 
                      type="file" 
                      accept=".xlsx, .xls, .csv" 
                      onChange={handleExcelUpload}
                      className="cursor-pointer"
                    />
                  </div>
                </div>

                {/* 6. Description */}
                <div className="space-y-1.5">
                  <Label htmlFor="description" className="font-semibold text-sm">Description <span className="text-destructive">*</span></Label>
                  <Textarea 
                    id="description"
                    placeholder="Provide details about this operational request..." 
                    className="min-h-[120px]"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                {/* 7. Optional Attachments */}
                <div className="space-y-1.5">
                  <Label htmlFor="attachments" className="font-semibold text-sm">Additional Attachments (Screenshots, PDFs)</Label>
                  <Input 
                    id="attachments" 
                    type="file" 
                    multiple
                    onChange={handleAttachmentsUpload}
                    className="cursor-pointer"
                  />
                </div>

                {/* Submit Buttons */}
                <div className="flex justify-end gap-2 pt-4">
                  <Link to="/tickets/dashboard">
                    <Button type="button" variant="ghost">Cancel</Button>
                  </Link>
                  <Button type="submit" className="bg-primary hover:bg-primary/95" disabled={loading}>
                    {loading ? "Submitting Request..." : "Submit Ticket"}
                  </Button>
                </div>

              </form>
            </CardContent>
          </Card>

          {/* Right Info Column */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="bg-muted/15 border-b pb-3">
                <CardTitle className="text-sm font-semibold">Ticket Routing</CardTitle>
                <CardDescription className="text-xs">Where will this request go?</CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-start gap-3">
                  <UserCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs text-muted-foreground font-medium block">Cluster assigned:</span>
                    <span className="text-sm font-bold text-foreground">{derivedCluster || "None Selected"}</span>
                  </div>
                </div>
                <div className="flex items-start gap-3 border-t pt-3">
                  <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs text-muted-foreground font-medium block">Assigned Owner:</span>
                    <span className="text-sm font-bold text-foreground">
                      {isMultiplier ? (assignedUserName || "None Selected") : (assignedPerson?.name || "None")}
                    </span>
                    {isMultiplier ? (
                      assignedUserEmail && <span className="text-[10px] text-muted-foreground block">{assignedUserEmail}</span>
                    ) : (
                      assignedPerson && <span className="text-[10px] text-muted-foreground block">{assignedPerson.email}</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="bg-muted/15 border-b pb-3">
                <CardTitle className="text-sm font-semibold">GMB SLA Policies</CardTitle>
              </CardHeader>
              <CardContent className="p-4 text-left text-xs text-muted-foreground space-y-3">
                <div className="flex gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <p>All tickets are generated with a strict <strong>7-Day Resolution SLA</strong> timer.</p>
                </div>
                <div className="flex gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <p>Priority increases automatically based on ticket age (Day 3: P4, Day 4: P3, Day 5-6: P2, Day 7: P1).</p>
                </div>
                <div className="flex gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <p>Automatic alerts and reminder emails are fired on Days 5, 6, and 7 directly to the assignee.</p>
                </div>
                <div className="flex gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <p>Tickets breaching SLA (Day 8+) are automatically escalated to <strong>Manipal Corporate Team</strong>.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
