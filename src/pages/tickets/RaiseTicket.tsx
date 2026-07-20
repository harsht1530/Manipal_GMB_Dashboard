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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/components/ui/use-toast";
import { 
  Download, 
  Upload, 
  ArrowLeft, 
  Sparkles, 
  UserCheck, 
  FileSpreadsheet, 
  CheckCircle,
  Paperclip,
  Info,
  PlayCircle
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

const TICKET_TYPE_DESCRIPTIONS: Record<string, string> = {
  // Profile Creation
  "Create new Google Business Profile": "Submit details to set up a brand-new official GMB listing for a doctor, department, or unit.",
  
  // Profile Verification
  "Through Phone Number or Email": "Verification request via official phone call, SMS OTP, or domain email authorization.",
  "Verify GBP through Video & Phone number": "Video verification or direct call support for GBP authorization.",
  
  // Ownership & Access
  "Add/Remove Manager": "Add or remove manager/owner roles for authorized staff on existing GMB profiles.",
  "Request ownership for existing profiles": "Request ownership transfer for profiles currently claimed by external users.",
  
  // Profile Updates
  "Update business name": "Submit official name corrections or rebranding details for accurate Google Search display.",
  "Update address": "Request pin relocation, building/floor changes, or official address line updates.",
  "Update phone number": "Update primary or secondary contact helpline numbers for direct patient calls.",
  "Update website": "Update primary landing page, department URL, or online appointment booking link.",
  "Update Business Hours": "Update regular operating hours or holiday/special schedule listings.",
  "Update Business Description": "Modify the 750-character business overview and services description.",
  "Add/Update departments": "Associate child department or hospital wing listings with the main hospital profile.",
  "Doctor Transfer": "Transfer doctor profile alignment or location settings between hospital branches.",
  "Map Pin Correction": "Calibrate map pin geo-coordinates to direct patients to the exact OPD entrance.",
  "Keyword Optimization": "Add target medical specialities, procedure terms, and search keywords.",
  
  // Profile Removal
  "Remove doctor profile": "Request removal or unlinking of doctor profiles no longer practicing at the branch.",
  
  // Content
  "Update Products & Services": "Update medical service menus, OPD consultation packages, and procedures list.",
  "Upload photos / Videos": "Upload high-res hospital infrastructure, facility, or doctor portrait media.",
  "Publish posts (Events / Offers/ Related to speciality)": "Schedule promotional, health awareness, or event posts on the GMB feed.",
  "Update Cover & Logo": "Upload high-resolution official brand logo and cover banner imagery.",
  "Irrelevant Content & Photos": "Flag and request removal of inappropriate or user-uploaded spam photos.",
  
  // Reviews
  "Missing reviews": "Investigate and restore patient reviews that were posted but not visible publicly.",
  "Rating Drop Investigation": "Audit and analyze sudden drops in branch overall star ratings.",
  "Fake Review Escalation": "Flag and escalate spam, offensive, or policy-violating review comments to Google.",
  
  // Suspensions
  "Suspended profile to be Reinstatement": "Prepare supporting business documents to appeal and restore suspended listings.",
  "Ask supporting documents to verify the profiles": "Request utility bills or signage photos to clear profile suspension.",
  
  // Duplicates
  "Remove duplicate profile": "Request removal of unauthorized or duplicate Google Business Profile listings.",
  
  // Merging
  "Merge duplicate listings": "Merge reviews, photos, and ratings of duplicate listings into the primary profile.",
  
  // Closure
  "Close/Mark permanently closed": "Mark inactive clinic or relocated branch profiles as permanently closed.",
  
  // Performance Reporting & Optimization
  "Competitor Analysis": "Request keyword rank comparisons and competitor GMB visibility analysis.",
  "Performance reports": "Generate weekly or monthly search, map view, call, and direction click performance reports.",
  "Weekly Optimization Report": "Generate optimization health check reports across cluster profiles."
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
  
  const [category, setCategory] = useState("");
  const [ticketType, setTicketType] = useState("");
  const [branch, setBranch] = useState(user?.role === "Branch" && user?.branch ? user.branch : "");
  const [description, setDescription] = useState("");
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);

  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [assignedUserEmail, setAssignedUserEmail] = useState("");
  const [assignedUserName, setAssignedUserName] = useState("");

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

  const clusterUsers = useMemo(() => {
    if (!currentMultiplierTeamMember) return [];
    const allowedClusters = currentMultiplierTeamMember.clusters || 
      (currentMultiplierTeamMember.cluster ? [currentMultiplierTeamMember.cluster] : []);
    if (allowedClusters.length === 0) return [];

    return allUsers.filter(u => {
      return u.Cluster && allowedClusters.some(ac => ac && ac.toLowerCase() === u.Cluster.toLowerCase());
    });
  }, [allUsers, currentMultiplierTeamMember]);

  useEffect(() => {
    if (isMultiplier && assignedUserEmail) {
      const selectedUserObj = clusterUsers.find(u => (u.orgEmail || u.mail) === assignedUserEmail);
      if (selectedUserObj) {
        setBranch(selectedUserObj.Branch || selectedUserObj.Cluster || "All");
      }
    }
  }, [assignedUserEmail, clusterUsers, isMultiplier]);

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

  useEffect(() => {
    setTicketType("");
  }, [category]);

  const { branches, clustersMap } = useMemo(() => {
    const map: Record<string, string> = {};
    const set = new Set<string>();

    branchesMeta.forEach(item => {
      if (item.branch) {
        set.add(item.branch);
        if (item.cluster) {
          map[item.branch] = item.cluster;
        }
      }
    });

    let activeBranches = Array.from(set).sort();

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

  const derivedCluster = useMemo(() => {
    if (!branch) return "";
    let cl = clustersMap[branch] || "";
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
    
    const matches = team.filter(m => m && m.cluster && m.cluster.toLowerCase() === derivedCluster.toLowerCase());
    if (matches.length > 0) {
      return {
        name: matches.map(m => m.name).join(" / "),
        email: matches[0].email
      };
    }
    return { name: "Harsh (Default Owner)", email: "harsh@multipliersolutions.com" };
  }, [derivedCluster, team]);

  const handleDownloadTemplate = () => {
    if (!category || !ticketType) {
      toast({
        title: "Download Rejected",
        description: "Please select a Category and Request Type first.",
        variant: "destructive"
      });
      return;
    }

    const columns = getTemplateColumns(category, ticketType, isMultiplier);

    const worksheet = XLSX.utils.json_to_sheet([], { header: columns });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
    
    const safeFilename = `${category.replace(/\s+/g, "_")}_Template.xlsx`;
    XLSX.writeFile(workbook, safeFilename);
    toast({
      title: "Template Downloaded",
      description: `Excel template "${safeFilename}" saved to your downloads.`,
    });
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setExcelFile(e.target.files[0]);
    }
  };

  const handleAttachmentsUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments(Array.from(e.target.files));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!category) {
      toast({ title: "Validation Error", description: "Please select a Category.", variant: "destructive" });
      return;
    }
    if (!ticketType) {
      toast({ title: "Validation Error", description: "Please select/enter a Request Type.", variant: "destructive" });
      return;
    }
    if (!branch) {
      toast({ title: "Validation Error", description: "Please select a Branch / Unit.", variant: "destructive" });
      return;
    }
    if (!description.trim()) {
      toast({ title: "Validation Error", description: "Please provide a Description for the request.", variant: "destructive" });
      return;
    }

    if (category !== "Others" && !excelFile) {
      toast({
        title: "Excel File Required",
        description: `Please upload the filled Excel template for category "${category}".`,
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
    
    if (excelFile) {
      formData.append("excelTemplate", excelFile);
    }
    
    attachments.forEach(file => {
      formData.append("attachments", file);
    });

    const result = await createTicket(formData);
    setLoading(false);
    
    if (result) {
      navigate("/requests/dashboard");
    }
  };

  return (
    <DashboardLayout title="Raise Request" subtitle="Create a GMB operational request and assign to the Multiplier team.">
      <div className="max-w-4xl mx-auto space-y-6">
        
        <div className="flex items-center justify-between">
          <Link to="/requests/dashboard">
            <Button variant="ghost" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Back to Dashboard
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 shadow-sm border border-border">
            <CardHeader className="border-b bg-muted/10">
              <CardTitle className="text-lg">Raise GMB Operational Request</CardTitle>
              <CardDescription>Fill out the request parameters below. Every request initiates an 8-day SLA cycle.</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-5 text-left">
                
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

                {/* 2. Request Type */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor="ticketType" className="font-semibold text-sm">Request Type <span className="text-destructive">*</span></Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button type="button" variant="ghost" size="icon" className="h-5 w-5 rounded-full text-sky-600 bg-sky-50 hover:bg-sky-100 dark:bg-sky-950 dark:hover:bg-sky-900 border border-sky-200 shadow-xs">
                          <Info className="h-3 w-3" />
                          <span className="sr-only">Request Type Description</span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent side="top" className="w-80 p-3 text-xs bg-background border border-border shadow-xl space-y-1.5">
                        <div className="font-bold text-sky-600 flex items-center gap-1">
                          <Info className="h-3.5 w-3.5" />
                          {ticketType ? ticketType : "Request Type Information"}
                        </div>
                        <p className="text-muted-foreground leading-normal">
                          {ticketType && TICKET_TYPE_DESCRIPTIONS[ticketType]
                            ? TICKET_TYPE_DESCRIPTIONS[ticketType]
                            : category
                            ? "Select a Request Type from the dropdown to see its specific guidelines."
                            : "Select a Category and Request Type to view its short description."}
                        </p>
                      </PopoverContent>
                    </Popover>
                  </div>
                  {category === "Others" ? (
                    <Input
                      id="ticketType"
                      value={ticketType}
                      onChange={(e) => setTicketType(e.target.value)}
                      placeholder="Enter Request Type"
                      className="w-full"
                    />
                  ) : (
                    <Select value={ticketType} onValueChange={setTicketType} disabled={!category}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={category ? "Select Request Type" : "Please select Category first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {category && categoryMap[category] && categoryMap[category].map(type => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {ticketType && TICKET_TYPE_DESCRIPTIONS[ticketType] && (
                    <p className="text-[11px] text-sky-700 bg-sky-50 dark:bg-sky-950/50 dark:text-sky-300 p-2 rounded-md border border-sky-200/60 font-medium flex items-center gap-1.5 mt-1 animate-in fade-in-50 duration-200">
                      <Info className="h-3.5 w-3.5 shrink-0 text-sky-600" />
                      <span>{TICKET_TYPE_DESCRIPTIONS[ticketType]}</span>
                    </p>
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
                  <Link to="/requests/dashboard">
                    <Button type="button" variant="ghost">Cancel</Button>
                  </Link>
                  <Button type="submit" className="bg-primary hover:bg-primary/95" disabled={loading}>
                    {loading ? "Submitting Request..." : "Submit Request"}
                  </Button>
                </div>

              </form>
            </CardContent>
          </Card>

          {/* Right Info Column */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="bg-muted/15 border-b pb-3">
                <CardTitle className="text-sm font-semibold">Request Routing</CardTitle>
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

            {/* Tutorial Video Card */}
            <Card className="overflow-hidden border border-primary/20 shadow-sm">
              <CardHeader className="bg-primary/5 border-b pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-primary">
                  <PlayCircle className="h-4 w-4 text-primary" />
                  How to Raise a Request (Tutorial)
                </CardTitle>
                <CardDescription className="text-xs">
                  Watch this step-by-step video guide to learn how to submit requests correctly.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3">
                <div className="relative rounded-lg overflow-hidden bg-black/90 aspect-video flex items-center justify-center border border-border shadow-inner">
                  <video 
                    autoPlay
                    muted
                    loop
                    playsInline
                    controls
                    preload="auto"
                    className="w-full h-full object-contain"
                    poster="/placeholder.svg"
                  >
                    <source src="/GMB/videos/raise_request_tutorial.mp4" type="video/mp4" />
                    <source src="/videos/raise_request_tutorial.mp4" type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                </div>
                {/* <p className="text-[10px] text-muted-foreground mt-2 text-center font-medium">
                  📹 Tutorial File: <code className="bg-muted px-1 py-0.5 rounded text-[10px]">public/videos/raise_request_tutorial.mp4</code>
                </p> */}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="bg-muted/15 border-b pb-3">
                <CardTitle className="text-sm font-semibold">GMB SLA Policies</CardTitle>
              </CardHeader>
              <CardContent className="p-4 text-left text-xs text-muted-foreground space-y-3">
                <div className="flex gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <p>All requests are generated with a strict <strong>7-Day Resolution SLA</strong> timer.</p>
                </div>
                <div className="flex gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <p>Priority increases automatically based on request age (Day 3: P4, Day 4: P3, Day 5-6: P2, Day 7: P1).</p>
                </div>
                <div className="flex gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <p>Automatic alerts and reminder emails are fired on Days 5, 6, and 7 directly to the assignee.</p>
                </div>
                <div className="flex gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <p>Requests breaching SLA (Day 8+) are automatically escalated to <strong>Manipal Corporate Team</strong>.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
