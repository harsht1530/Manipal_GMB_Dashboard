import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/components/ui/use-toast";
import { useMongoData } from "@/hooks/useMongoData";
import { useAuth } from "@/contexts/AuthContext";
import confetti from "canvas-confetti";
import { Sparkles, Image as ImageIcon, Calendar as CalendarIcon, Clock, Eye, Ticket, ExternalLink, RefreshCw, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";

// TODO: Replace these securely provided URLs once you deploy the Apps Script Web Apps.
const OUT_OF_ORG_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbw8t4-Uuu8-l03YqagyWzGbXbykBqnEbT8IJJbEprgcoAeytUs4MheWLwLQFG6qWe7d/exec";
const OPTIMIZATION_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbzHwoe4dpmaCCLw0Ao4LD3HtC3lR6Rn0xnk8Yn78nn2FpBiZv_4bqFBxZoJSlVapV49-g/exec";
const GMB_PROFILE_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbyKt4EgL6aVxvu-ZJYYf8BBktwtWqhgTAth7CRqYdt4KLCdu1IrUOnnRv6nc7WN7RCx_g/exec";
const GMB_POSTINGS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbyoUw3d_K2XwB5VXz0ciOWeJYWdgPZXvct2GSGWzh37gi5BrZxON1_3CZ2QQURawH8t/exec";

const API_BASE_URL = `${import.meta.env.VITE_API_BASE_URL || "https://smldatamanagement.multiplierai.co"}/api`;

export default function RaisingCase() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { insights, loading: dataLoading } = useMongoData();

  const [activeTab, setActiveTab] = useState<'out-of-org' | 'optimization' | 'gmb-profile' | 'gmb-postings'>('out-of-org');
  const [loading, setLoading] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [tableData, setTableData] = useState<any[]>([]);
  
  // GMB Post Specific State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [aiPreview, setAiPreview] = useState<any | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>();
  const [scheduleTime, setScheduleTime] = useState("");
  const [drSearchOpen, setDrSearchOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    cluster: "",
    location: "",
    businessName: "",
    gmbLink: "",
    googleLink: "",
    dropDownOption: "",
    description: "",
    // New fields
    drName: "",
    speciality: "",
    address: "",
    phone: "",
    website: "",
    opdTimings: "",
    coverPhoto: "",
    typeOfPost: "",
    sourceLink: "",
    gmbProfileLink: "",
    images: "",
    whereToPost: "",
    status: "Pending",
    // Hidden fields for doctor account/email
    drAccount: "",
    drEmail: ""
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Derived Dropdown Data directly from the database context
  const clusters = Array.from(new Set((insights || []).map((i: any) => i.cluster))).filter(Boolean).sort() as string[];
  const availableLocations = Array.from(
    new Set(
      (insights || []).filter((i: any) => formData.cluster ? i.cluster === formData.cluster : true)
        .map((i: any) => i.branch)
    )
  ).filter(Boolean).sort() as string[];
  
  const { doctors } = useMongoData();
  const availableDoctors = (doctors || []).filter(d => 
    (formData.cluster ? d.cluster === formData.cluster : true) && 
    (formData.location ? d.branch === formData.location : true)
  );

  const handleDoctorSelect = (val: string) => {
    const doc = availableDoctors.find(d => d.name === val);
    if (doc) {
      setFormData(prev => ({ 
        ...prev, 
        drName: doc.name,
        drAccount: doc.account || "",
        drEmail: doc.mailId || ""
      }));
    } else {
      setFormData(prev => ({ ...prev, drName: val }));
    }
  };

  const handleGenerateAI = async () => {
    if (!formData.sourceLink) {
      toast({ title: "Source Link Required", description: "Please enter a source link first.", variant: "destructive" });
      return;
    }
    setAiLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/generate-gmb-post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_url: formData.sourceLink,
          business_name: formData.drName || "Manipal Hospitals"
        })
      });
      const data = await res.json();
      if (data.generated_post) {
        setAiPreview(data.generated_post);
        toast({ title: "Post Generated!", description: "AI has created a preview for your post." });
      } else {
        throw new Error("Invalid AI response");
      }
    } catch (e) {
      console.error(e);
      toast({ title: "Generation Failed", description: "Could not generate AI post content.", variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const loadSheetData = async () => {
    let url = "";
    if (activeTab === 'out-of-org') url = OUT_OF_ORG_WEBAPP_URL;
    else if (activeTab === 'optimization') url = OPTIMIZATION_WEBAPP_URL;
    else if (activeTab === 'gmb-profile') url = GMB_PROFILE_WEBAPP_URL;
    else if (activeTab === 'gmb-postings') url = GMB_POSTINGS_WEBAPP_URL;

    if (url.includes("YOUR_") && activeTab !== 'gmb-postings') {
      setTableData([]);
      return;
    }

    setTableLoading(true);
    setTableData([]); // Clear previous data
    try {
      if (activeTab === 'gmb-postings') {
        const res = await fetch(`${API_BASE_URL}/gmb-postings`);
        const data = await res.json();
        setTableData(data.data || []);
      } else {
        const res = await fetch(url);
        const data = await res.json();
        setTableData(data || []);
      }
    } catch (e) {
      console.error("Failed to load sheet data:", e);
    } finally {
      setTableLoading(false);
    }
  };

  useEffect(() => {
    loadSheetData();
  }, [activeTab]);

  const sendEmailNotification = (payload: any, formTypeName: string) => {
    if (!user) return;
    fetch(`${API_BASE_URL}/send-case-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        formType: formTypeName,
        formData: payload,
        user: { name: user.name, email: user.email }
      })
    }).catch(err => console.error("Failed to send email notification:", err));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let url = "";
    if (activeTab === 'out-of-org') url = OUT_OF_ORG_WEBAPP_URL;
    else if (activeTab === 'optimization') url = OPTIMIZATION_WEBAPP_URL;
    else if (activeTab === 'gmb-profile') url = GMB_PROFILE_WEBAPP_URL;
    else if (activeTab === 'gmb-postings') url = GMB_POSTINGS_WEBAPP_URL;

    if (url.includes("YOUR_") && activeTab !== 'gmb-postings') {
      toast({
        title: "Configuration Missing",
        description: "Please configure your Google Apps Script Web App URLs first!",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      if (activeTab === 'gmb-postings') {
        let imageUrl = formData.images;
        
        // 1. Upload image if selected
        if (selectedFile) {
          const fileData = new FormData();
          fileData.append('image', selectedFile);
          
          // Send directly to the live frontend server where it's hosted
          const uploadRes = await fetch("https://multiplierai.co/GMB/upload.php", {
            method: 'POST',
            body: fileData
          });
          const uploadJson = await uploadRes.json();
          if (uploadJson.success) {
            imageUrl = uploadJson.imageUrl; // This will now be the full public URL from the PHP script
          } else {
            console.error("Upload failed:", uploadJson.error);
          }
        }

        // 2. Prepare Payload
        const scheduledTime = (scheduleDate && scheduleTime) ? new Date(`${format(scheduleDate, 'yyyy-MM-dd')}T${scheduleTime}`) : null;
        
        const postingPayload = {
          cluster: formData.cluster,
          location: formData.location,
          doctorName: formData.drName,
          account: formData.drAccount,
          email: formData.drEmail,
          sourceLink: formData.sourceLink,
          imageUrl: imageUrl,
          postsText: aiPreview ? `${aiPreview.headline}\n\n${aiPreview.main_post}\n\n${aiPreview.hashtags.map((h: string) => `#${h}`).join(' ')}` : formData.description,
          status: scheduledTime ? "Pending" : formData.status,
          scheduledTime: scheduledTime,
          aiResponse: aiPreview
        };

        // 3. Save to MongoDB
        const res = await fetch(`${API_BASE_URL}/gmb-postings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(postingPayload)
        });

        const resJson = await res.json();
        if (resJson.success) {
          sendEmailNotification(postingPayload, "GMB Postings");
          triggerSuccessUI();
        } else {
          throw new Error(resJson.error || "Failed to save posting");
        }
      } else {
        // Handle Apps Script submissions
        let payload: any = {};
        if (activeTab === 'out-of-org') {
          payload = {
            "Cluster": formData.cluster,
            "Location": formData.location,
            "Business name": formData.businessName,
            "GMB Link": formData.gmbLink,
            "Description": formData.description,
            "Status": formData.status
          };
        } else if (activeTab === 'optimization') {
          payload = {
            "Cluster": formData.cluster,
            "Location": formData.location,
            "Business Name": formData.businessName,
            "Google Link": formData.googleLink,
            "Drop Down": formData.dropDownOption,
            "Description": formData.description,
            "Status": formData.status
          };
        } else if (activeTab === 'gmb-profile') {
          payload = {
            "Cluster": formData.cluster,
            "Location": formData.location,
            "Doctor Name": formData.drName,
            "Speciality": formData.speciality,
            "Address": formData.address,
            "Phone Number": formData.phone,
            "Website Link": formData.website,
            "OPD Timings": formData.opdTimings,
            "Cover Photo": formData.coverPhoto,
            "Status": formData.status
          };
        }

        await fetch(url, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify(payload)
        });

        const formTypeName = activeTab === 'out-of-org' ? 'Out of Organization Request' 
                           : activeTab === 'optimization' ? 'Optimization Cards' 
                           : 'GMB Profile Creation';
        sendEmailNotification(payload, formTypeName);
        triggerSuccessUI();
      }
    } catch (error: any) {
      console.error("Submission error:", error);
      toast({
        title: "Submission Failed",
        description: error.message || "Please try again later. Check your connection or Apps Script setup.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const triggerSuccessUI = () => {
    // Trigger Joyful Animation
    setIsAnimating(true);

    // Fire confetti sequence
    setTimeout(() => {
      const duration = 1500;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 99999 };
      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;
      const interval: any = setInterval(function () {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) return clearInterval(interval);
        const particleCount = 50 * (timeLeft / duration);
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
      }, 250);
      confetti({
        particleCount: 150,
        spread: 120,
        origin: { y: 0.5, x: 0.5 },
        colors: ['#217a74', '#ffffff', '#ffb020', '#10b981'],
        zIndex: 99999
      });
    }, 1500);

    setTimeout(() => {
      setIsAnimating(false);
      toast({
        title: "Request Submitted!",
        description: "Your request has been successfully recorded!",
      });
      // Clear form
      setFormData({
        cluster: "", location: "", businessName: "", gmbLink: "", googleLink: "", dropDownOption: "", description: "",
        drName: "", speciality: "", address: "", phone: "", website: "", opdTimings: "", coverPhoto: "",
        typeOfPost: "", sourceLink: "", gmbProfileLink: "", images: "", whereToPost: "", status: "Pending",
        drAccount: "", drEmail: ""
      });
      setSelectedFile(null);
      setAiPreview(null);
      setScheduleDate(undefined);
      setScheduleTime("");
      loadSheetData();
    }, 3200);
  };

  return (
    <DashboardLayout
      title="Raising Case IDs"
      subtitle="Submit tickets to sheets and track resolution status"
    >
      {isAnimating && (
        <>
          <style>{`
            @keyframes flyTicket {
              0% { transform: translate(-50vw, 50vh) rotate(-45deg) scale(0.3); opacity: 0; }
              15% { opacity: 1; transform: translate(-30vw, -20vh) rotate(15deg) scale(0.8); }
              30% { transform: translate(10vw, -30vh) rotate(-10deg) scale(0.5); }
              50% { transform: translate(40vw, 10vh) rotate(25deg) scale(0.9); }
              80% { transform: translate(0, 0) rotate(0deg) scale(1.1); opacity: 1; }
              100% { transform: translate(0, 0) rotate(0deg) scale(0); opacity: 0; }
            }
            .ticket-fly-overlay {
              position: fixed;
              top: 0; left: 0; right: 0; bottom: 0;
              background: rgba(255, 255, 255, 0.4);
              backdrop-filter: blur(2px);
              z-index: 9998;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .animate-ticket-fly {
              animation: flyTicket 3s cubic-bezier(0.25, 0.1, 0.25, 1) forwards;
            }
          `}</style>
          <div className="ticket-fly-overlay">
            <div className="animate-ticket-fly drop-shadow-xl">
              <div className="bg-[#217a74] text-white p-4 rounded-xl shadow-xl flex items-center justify-center border-4 border-white transform rotate-3">
                <Ticket className="w-12 h-12 opacity-90 stroke-[2]" />
                <div className="ml-3 font-bold text-lg tracking-wider uppercase">Ticket<br />Submitted!</div>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="space-y-8 animate-fade-in max-w-7xl mx-auto">

        {/* Toggle Controls */}
        <div className="flex bg-white p-1 rounded-xl shadow-sm border w-fit overflow-x-auto">
          <button
            onClick={() => setActiveTab('out-of-org')}
            className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${activeTab === 'out-of-org'
              ? 'bg-[#217a74] text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-50'
              }`}
          >
            Out of Organization Request
          </button>
          <button
            onClick={() => setActiveTab('optimization')}
            className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${activeTab === 'optimization'
              ? 'bg-[#217a74] text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-50'
              }`}
          >
            Optimization Cards
          </button>
          <button
            onClick={() => setActiveTab('gmb-profile')}
            className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${activeTab === 'gmb-profile'
              ? 'bg-[#217a74] text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-50'
              }`}
          >
            GMB Profile Creation
          </button>
          <button
            onClick={() => setActiveTab('gmb-postings')}
            className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${activeTab === 'gmb-postings'
              ? 'bg-[#217a74] text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-50'
              }`}
          >
            GMB Postings
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Form Column */}
          <Card className="lg:col-span-1 h-fit shadow-sm">
            <CardHeader className="bg-slate-50/50 border-b">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Ticket className="h-5 w-5 text-indigo-500" />
                {activeTab === 'out-of-org' && "Out of Org Request"}
                {activeTab === 'optimization' && "Optimization Request"}
                {activeTab === 'gmb-profile' && "GMB Profile Creation"}
                {activeTab === 'gmb-postings' && "GMB Postings"}
              </CardTitle>
              <CardDescription>
                Fill out the fields to submit directly to Google Sheets.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-4">

                <div className="space-y-2">
                  <Label>Cluster</Label>
                  <Select
                    required
                    value={formData.cluster}
                    onValueChange={(val) => setFormData(prev => ({ ...prev, cluster: val, location: "" }))}
                    disabled={dataLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={dataLoading ? "Loading..." : clusters.length === 0 ? "No clusters found" : "Select Cluster"} />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      {clusters.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Location</Label>
                  <Select
                    required
                    value={formData.location}
                    onValueChange={(val) => handleSelectChange('location', val)}
                    disabled={dataLoading || !formData.cluster}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={dataLoading ? "Loading..." : !formData.cluster ? "Select Cluster first" : "Select Location"} />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      {availableLocations.map((l) => (
                        <SelectItem key={l} value={l}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {(activeTab === 'out-of-org' || activeTab === 'optimization') && (
                  <>
                    <div className="space-y-2">
                      <Label>{activeTab === 'out-of-org' ? 'Business name' : 'Business Name'}</Label>
                      <Input required name="businessName" value={formData.businessName} onChange={handleInputChange} placeholder="Name of Business" />
                    </div>

                    {activeTab === 'out-of-org' ? (
                      <div className="space-y-2">
                        <Label>GMB Link</Label>
                        <Input required type="url" name="gmbLink" value={formData.gmbLink} onChange={handleInputChange} placeholder="https://..." />
                      </div>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <Label>Google Link</Label>
                          <Input required type="url" name="googleLink" value={formData.googleLink} onChange={handleInputChange} placeholder="https://..." />
                        </div>
                        <div className="space-y-2">
                          <Label>Issue Category</Label>
                          <Select required value={formData.dropDownOption} onValueChange={(val) => handleSelectChange('dropDownOption', val)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select Issue Category" />
                            </SelectTrigger>
                            <SelectContent className="bg-white">
                              <SelectItem value="Keyword in Business Name">Keyword in Business Name</SelectItem>
                              <SelectItem value="Website Link">Website Link</SelectItem>
                              <SelectItem value="Timings">Timings</SelectItem>
                              <SelectItem value="Phone Number">Phone Number</SelectItem>
                              <SelectItem value="Address">Address</SelectItem>
                              <SelectItem value="Keywords">Keywords</SelectItem>
                              <SelectItem value="Cover Photo">Cover Photo</SelectItem>
                              <SelectItem value="Logo">Logo</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}

                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea required name="description" value={formData.description} onChange={handleInputChange} placeholder="Describe the issue..." rows={4} />
                    </div>
                  </>
                )}

                {activeTab === 'gmb-profile' && (
                  <>
                    <div className="space-y-2">
                      <Label>Doctor Name</Label>
                      <Input required name="drName" value={formData.drName} onChange={handleInputChange} placeholder="Dr. Name" />
                    </div>
                    <div className="space-y-2">
                      <Label>Speciality</Label>
                      <Input required name="speciality" value={formData.speciality} onChange={handleInputChange} placeholder="Speciality" />
                    </div>
                    <div className="space-y-2">
                      <Label>Address</Label>
                      <Input required name="address" value={formData.address} onChange={handleInputChange} placeholder="Address" />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone Number</Label>
                      <Input required name="phone" value={formData.phone} onChange={handleInputChange} placeholder="Phone Number" />
                    </div>
                    <div className="space-y-2">
                      <Label>Website Link</Label>
                      <Input required type="url" name="website" value={formData.website} onChange={handleInputChange} placeholder="https://..." />
                    </div>
                    <div className="space-y-2">
                      <Label>OPD Timings (Mon - Sun)</Label>
                      <Input required name="opdTimings" value={formData.opdTimings} onChange={handleInputChange} placeholder="9 AM - 5 PM" />
                    </div>
                    <div className="space-y-2">
                      <Label>Cover Photo Link</Label>
                      <Input required type="url" name="coverPhoto" value={formData.coverPhoto} onChange={handleInputChange} placeholder="Image URL" />
                    </div>
                  </>
                )}

                 {activeTab === 'gmb-postings' && (
                  <>
                    <div className="space-y-2">
                      <Label>Doctor Name</Label>
                      <Popover open={drSearchOpen} onOpenChange={setDrSearchOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={drSearchOpen}
                            disabled={dataLoading}
                            className="w-full justify-between font-normal bg-white"
                          >
                            {formData.drName
                              ? formData.drName
                              : dataLoading ? "Loading..." : "Search and select doctor..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-white" align="start">
                          <Command>
                            <CommandInput placeholder="Search doctor name..." />
                            <CommandList>
                              <CommandEmpty>No doctor found.</CommandEmpty>
                              <CommandGroup>
                                {availableDoctors.map((d) => (
                                  <CommandItem
                                    key={d.id}
                                    value={d.name}
                                    onSelect={(currentValue) => {
                                      handleDoctorSelect(currentValue);
                                      setDrSearchOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        formData.drName === d.name ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {d.name}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-2">
                      <Label>Source Link (PR, Blog, Video, etc.)</Label>
                      <div className="flex gap-2">
                        <Input 
                          type="url" 
                          name="sourceLink" 
                          value={formData.sourceLink} 
                          onChange={handleInputChange} 
                          placeholder="https://..." 
                          className="flex-1"
                        />
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="icon" 
                          onClick={handleGenerateAI}
                          disabled={aiLoading}
                          className="shrink-0 bg-indigo-50 border-indigo-200 hover:bg-indigo-100 text-indigo-600"
                        >
                          <Sparkles className={`h-4 w-4 ${aiLoading ? 'animate-pulse' : ''}`} />
                        </Button>
                      </div>
                    </div>

                    {aiPreview && (
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2 animate-in fade-in slide-in-from-top-1">
                        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> Preview</span>
                          <Button variant="ghost" size="sm" className="h-5 px-1 text-[9px]" onClick={() => setAiPreview(null)}>Clear</Button>
                        </div>
                        <h4 className="font-bold text-sm text-slate-900 leading-tight">{aiPreview.headline}</h4>
                        <p className="text-xs text-slate-700 whitespace-pre-wrap">{aiPreview.main_post}</p>
                        <div className="flex flex-wrap gap-1">
                          {aiPreview.hashtags.slice(0, 4).map((h: string) => (
                            <span key={h} className="text-[10px] text-indigo-600 font-medium">#{h}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Post Image</Label>
                      <div className="flex items-center gap-2">
                        <Input 
                          type="file" 
                          accept="image/*" 
                          onChange={handleFileChange} 
                          className="text-xs file:bg-indigo-50 file:text-indigo-700 file:border-0 file:rounded-md file:px-2 file:py-1 file:mr-2 hover:file:bg-indigo-100 cursor-pointer"
                        />
                        {selectedFile && <ImageIcon className="h-4 w-4 text-emerald-500" />}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="flex items-center gap-1"><CalendarIcon className="h-3 w-3" /> Schedule Date</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal bg-white text-xs h-9",
                                !scheduleDate && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-3 w-3" />
                              {scheduleDate ? format(scheduleDate, "PPP") : <span>Pick a date</span>}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={scheduleDate}
                              onSelect={setScheduleDate}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-1"><Clock className="h-3 w-3" /> Time</Label>
                        <Input 
                          type="time" 
                          value={scheduleTime} 
                          onChange={(e) => setScheduleTime(e.target.value)} 
                          className="text-xs h-9"
                        />
                      </div>
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select required value={formData.status} onValueChange={(val) => handleSelectChange('status', val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Status" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="Pending">Pending</SelectItem>
                      {(activeTab !== 'gmb-postings' || (!scheduleDate && !scheduleTime)) && (
                        <SelectItem value="Approved">Approve</SelectItem>
                      )}
                      {activeTab !== 'gmb-postings' && <SelectItem value="Done">Done</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>

                <Button type="submit" disabled={loading} className="w-full bg-[#217a74] hover:bg-[#1a625d] text-white">
                  {loading ? "Submitting..." : "Submit Ticket"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Table Column */}
          <Card className="lg:col-span-2 shadow-sm flex flex-col">
            <CardHeader className="bg-slate-50/50 border-b flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle className="text-lg">Live Sheet Tracker</CardTitle>
                <CardDescription>
                  {activeTab === 'gmb-postings' 
                    ? "Tracking GMB Postings and their live statuses."
                    : `Showing records synced from ${activeTab === 'out-of-org' ? 'Out of Organization' : 'Optimization Cards'} sheet.`
                  }
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={loadSheetData} disabled={tableLoading} className="flex gap-2 bg-white">
                <RefreshCw className={`h-4 w-4 ${tableLoading ? 'animate-spin text-slate-400' : 'text-slate-600'}`} />
                Sync
              </Button>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-auto max-h-[800px]">
              {tableData.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 mb-4">
                    <ExternalLink className="h-6 w-6 text-slate-400" />
                  </div>
                  <p className="font-medium text-slate-700">No Data Found</p>
                  <p className="text-sm mt-1">Configure your Web App URLs in the code to sync this table with Google Sheets.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-slate-50 sticky top-0 z-10">
                    <TableRow>
                      <TableHead>Cluster</TableHead>
                      <TableHead>Location</TableHead>
                      {activeTab === 'out-of-org' && <TableHead>Business Name</TableHead>}
                      {activeTab === 'optimization' && <TableHead>Business Name</TableHead>}
                      {activeTab === 'gmb-profile' && <TableHead>Doctor Name</TableHead>}
                      {activeTab === 'gmb-postings' && <TableHead>Doctor Name</TableHead>}

                      {activeTab === 'out-of-org' && <TableHead>GMB Link</TableHead>}
                      {activeTab === 'optimization' && (
                        <>
                          <TableHead>Google Link</TableHead>
                          <TableHead>Category</TableHead>
                        </>
                      )}
                      {activeTab === 'gmb-profile' && (
                        <>
                          <TableHead>Speciality</TableHead>
                          <TableHead>Details</TableHead>
                        </>
                      )}
                      {activeTab === 'gmb-postings' && (
                        <>
                          <TableHead>AI Post</TableHead>
                          <TableHead>Scheduled</TableHead>
                        </>
                      )}
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tableData.map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{row.Cluster || row.cluster || '-'}</TableCell>
                        <TableCell>{row.Location || row.location || '-'}</TableCell>

                        {(activeTab === 'out-of-org' || activeTab === 'optimization') && (
                          <TableCell>{row["Business name"] || row["Business Name"] || '-'}</TableCell>
                        )}
                        {(activeTab === 'gmb-profile' || activeTab === 'gmb-postings') && (
                          <TableCell>{row["Doctor Name"] || row.doctorName || '-'}</TableCell>
                        )}

                        {activeTab === 'out-of-org' && (
                          <TableCell>
                            {row["GMB Link"] ? <a href={row["GMB Link"]} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">Link</a> : '-'}
                          </TableCell>
                        )}

                        {activeTab === 'optimization' && (
                          <>
                            <TableCell>
                              {row["Google Link"] ? <a href={row["Google Link"]} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">Link</a> : '-'}
                            </TableCell>
                            <TableCell>
                              <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded-md font-medium border">
                                {row["Drop Down"] || '-'}
                              </span>
                            </TableCell>
                          </>
                        )}

                        {activeTab === 'gmb-profile' && (
                          <>
                            <TableCell>{row["Speciality"] || '-'}</TableCell>
                            <TableCell>
                              <div className="text-xs text-slate-500 max-w-[200px] truncate">
                                {row["Address"] || row["Phone Number"]}
                              </div>
                            </TableCell>
                          </>
                        )}

                        {activeTab === 'gmb-postings' && (
                          <>
                            <TableCell>
                              <div className="max-w-[150px] truncate text-xs text-slate-500" title={row.postsText}>
                                {row.postsText || '-'}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-[10px] text-slate-500">
                                {row.scheduledTime ? new Date(row.scheduledTime).toLocaleString() : 'Immediate'}
                              </div>
                            </TableCell>
                          </>
                        )}

                        <TableCell>
                          <span className={`px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider rounded-full border ${(() => {
                            const s = (row.Status || row.status || '').toLowerCase();
                            if (s === 'resolved' || s === 'completed' || s === 'done' || s === 'posted') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
                            if (s === 'processing' || s === 'in process' || s === 'in progress') return 'bg-amber-50 text-amber-700 border-amber-200';
                            if (s === 'pending' || s === 'new') return 'bg-blue-50 text-blue-700 border-blue-200';
                            if (s === 'cancelled' || s === 'rejected' || s === 'failed') return 'bg-red-50 text-red-700 border-red-200';
                            return 'bg-slate-50 text-slate-700 border-slate-200';
                          })()}`}>
                            {row.Status || row.status || 'Pending'}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </DashboardLayout>
  );
}
