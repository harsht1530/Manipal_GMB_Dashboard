import { useState, useEffect, useRef } from "react";
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
import {
  Sparkles,
  Image as ImageIcon,
  Calendar as CalendarIcon,
  Clock,
  Eye,
  FileText,
  ExternalLink,
  RefreshCw,
  Check,
  ChevronsUpDown,
  Send
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";

const API_BASE_URL = `${import.meta.env.VITE_API_BASE_URL || "https://smldatamanagement.multiplierai.co"}/api`;

export default function RaisingCase() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { insights, doctors, loading: dataLoading } = useMongoData();
  const timeInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [tableData, setTableData] = useState<any[]>([]);

  // GMB Post Specific State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>("");
  const [aiPreview, setAiPreview] = useState<any | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>();
  const [scheduleTime, setScheduleTime] = useState("");
  const [drSearchOpen, setDrSearchOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    cluster: "",
    location: "",
    drName: "",
    drAccount: "",
    drEmail: "",
    newReviewUri: "",
    sourceLink: "",
    description: "",
    images: "",
    status: "Pending"
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Derived Dropdown Data
  const clusters = Array.from(new Set((insights || []).map((i: any) => i.cluster))).filter(Boolean).sort() as string[];
  const availableLocations = Array.from(
    new Set(
      (insights || []).filter((i: any) => formData.cluster ? i.cluster === formData.cluster : true)
        .map((i: any) => i.branch)
    )
  ).filter(Boolean).sort() as string[];

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
        drEmail: doc.mailId || "",
        newReviewUri: doc.newReviewUri || ""
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
        const compiledText = `${data.generated_post.headline}\n\n${data.generated_post.main_post}\n\nKnow More: ${formData.sourceLink}\n\n${(data.generated_post.hashtags || []).map((h: string) => `#${h}`).join(' ')}`;
        setFormData(prev => ({ ...prev, description: compiledText }));
        toast({ title: "Post Generated!", description: "AI has created content for your post." });
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
    const file = e.target.files?.[0];
    if (file) {
      // 1. Basic type check
      if (!file.type.startsWith('image/')) {
        toast({ title: "Invalid File Type", description: "Please select a valid image file (JPG, PNG, WebP).", variant: "destructive" });
        e.target.value = "";
        setSelectedFile(null);
        setImagePreviewUrl("");
        return;
      }

      // 2. Load image to check dimensions
      const reader = new FileReader();
      reader.onload = (readerEvent: any) => {
        const img = new Image();
        img.onload = () => {
          if (img.width < 250 || img.height < 250) {
            toast({
              title: "Image too small",
              description: `The selected image is ${img.width}x${img.height} pixels. GMB requires at least 250x250 pixels. Please use a larger image.`,
              variant: "destructive"
            });
            e.target.value = "";
            setSelectedFile(null);
            setImagePreviewUrl("");
          } else {
            setSelectedFile(file);
            setImagePreviewUrl(readerEvent.target.result);
          }
        };
        img.onerror = () => {
          console.warn("Could not verify image dimensions, but file type is valid.");
          setSelectedFile(file);
          setImagePreviewUrl(readerEvent.target.result);
        };
        img.src = readerEvent.target.result;
      };
      reader.onerror = () => {
        toast({ title: "Read Error", description: "Could not read the selected file.", variant: "destructive" });
        e.target.value = "";
        setSelectedFile(null);
        setImagePreviewUrl("");
      };
      reader.readAsDataURL(file);
    }
  };

  const loadSheetData = async () => {
    setTableLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/gmb-postings`);
      const data = await res.json();
      setTableData(data.data || []);
    } catch (e) {
      console.error("Failed to load GMB postings data:", e);
    } finally {
      setTableLoading(false);
    }
  };

  useEffect(() => {
    loadSheetData();
  }, []);

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

    if (!selectedFile && !formData.images) {
      toast({
        title: "Post Image Required",
        description: "Please upload an image for the GMB post. It must be at least 250x250 pixels.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      let imageUrl = formData.images;

      // 1. Upload image if selected
      if (selectedFile) {
        const fileData = new FormData();
        fileData.append('image', selectedFile);

        const uploadRes = await fetch("https://multiplierai.co/GMB/upload.php", {
          method: 'POST',
          body: fileData
        });
        const uploadJson = await uploadRes.json();
        if (uploadJson.success) {
          imageUrl = uploadJson.imageUrl;
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
        newReviewUri: formData.newReviewUri,
        sourceLink: formData.sourceLink,
        imageUrl: imageUrl,
        postsText: formData.description || (aiPreview 
          ? `${aiPreview.headline}\n\n${aiPreview.main_post}\n\nKnow More: ${formData.sourceLink}\n\n${(aiPreview.hashtags || []).map((h: string) => `#${h}`).join(' ')}` 
          : ""),
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
    } catch (error: any) {
      console.error("Submission error:", error);
      toast({
        title: "Submission Failed",
        description: error.message || "Please try again later. Check your connection.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const triggerSuccessUI = () => {
    setIsAnimating(true);

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
        title: "Post Submitted!",
        description: "Your GMB post has been successfully recorded!",
      });
      setFormData({
        cluster: "",
        location: "",
        drName: "",
        drAccount: "",
        drEmail: "",
        newReviewUri: "",
        sourceLink: "",
        description: "",
        images: "",
        status: "Pending"
      });
      setSelectedFile(null);
      setImagePreviewUrl("");
      setAiPreview(null);
      setScheduleDate(undefined);
      setScheduleTime("");
      loadSheetData();
    }, 3200);
  };

  return (
    <DashboardLayout
      title="GMB Posting"
      subtitle="Create, schedule, and track Google My Business postings"
    >
      {isAnimating && (
        <>
          <style>{`
            @keyframes flyPost {
              0% { transform: translate(-50vw, 50vh) rotate(-45deg) scale(0.3); opacity: 0; }
              15% { opacity: 1; transform: translate(-30vw, -20vh) rotate(15deg) scale(0.8); }
              30% { transform: translate(10vw, -30vh) rotate(-10deg) scale(0.5); }
              50% { transform: translate(40vw, 10vh) rotate(25deg) scale(0.9); }
              80% { transform: translate(0, 0) rotate(0deg) scale(1.1); opacity: 1; }
              100% { transform: translate(0, 0) rotate(0deg) scale(0); opacity: 0; }
            }
            .post-fly-overlay {
              position: fixed;
              top: 0; left: 0; right: 0; bottom: 0;
              background: rgba(255, 255, 255, 0.4);
              backdrop-filter: blur(2px);
              z-index: 9998;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .animate-post-fly {
              animation: flyPost 3s cubic-bezier(0.25, 0.1, 0.25, 1) forwards;
            }
          `}</style>
          <div className="post-fly-overlay">
            <div className="animate-post-fly drop-shadow-xl">
              <div className="bg-[#217a74] text-white p-5 rounded-xl shadow-xl flex items-center justify-center border-4 border-white transform rotate-3">
                <Send className="w-10 h-10 opacity-90 stroke-[2.5]" />
                <div className="ml-3 font-bold text-lg tracking-wider uppercase">Post<br />Submitted!</div>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="space-y-8 animate-fade-in max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Form Column */}
          <Card className="lg:col-span-1 h-fit shadow-sm border-slate-200">
            <CardHeader className="bg-slate-50/50 border-b">
              <CardTitle className="flex items-center gap-2 text-lg text-slate-800">
                <FileText className="h-5 w-5 text-[#217a74]" />
                GMB Post Creation
              </CardTitle>
              <CardDescription>
                Create, customize, and publish or schedule GMB posts.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-4">

                {/* Cluster */}
                <div className="space-y-2">
                  <Label>Cluster</Label>
                  <Select
                    required
                    value={formData.cluster}
                    onValueChange={(val) => setFormData(prev => ({ ...prev, cluster: val, location: "", drName: "" }))}
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

                {/* Location */}
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Select
                    required
                    value={formData.location}
                    onValueChange={(val) => {
                      handleSelectChange('location', val);
                      setFormData(prev => ({ ...prev, drName: "" }));
                    }}
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

                {/* Doctor Selection */}
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

                {/* Source Link */}
                <div className="space-y-2">
                  <Label>Source Link (PR, Blog etc.)</Label>
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
                      title="Generate post with AI"
                      className="shrink-0 bg-indigo-50 border-indigo-200 hover:bg-indigo-100 text-indigo-600"
                    >
                      <Sparkles className={`h-4 w-4 ${aiLoading ? 'animate-pulse' : ''}`} />
                    </Button>
                  </div>
                </div>

                {/* AI Preview Card */}
                {aiPreview && (
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2 animate-in fade-in slide-in-from-top-1">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> AI Preview</span>
                      <Button variant="ghost" size="sm" className="h-5 px-1 text-[9px]" onClick={() => setAiPreview(null)}>Clear</Button>
                    </div>
                    <h4 className="font-bold text-sm text-slate-900 leading-tight">{aiPreview.headline}</h4>
                    <p className="text-xs text-slate-700 whitespace-pre-wrap">{aiPreview.main_post}</p>
                    {formData.sourceLink && (
                      <p className="text-xs text-slate-700 font-medium break-all">Know More: {formData.sourceLink}</p>
                    )}
                    <div className="flex flex-wrap gap-1">
                      {(aiPreview.hashtags || []).slice(0, 4).map((h: string) => (
                        <span key={h} className="text-[10px] text-indigo-600 font-medium">#{h}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Post Caption / Description */}
                <div className="space-y-2">
                  <Label>Post Content / Caption</Label>
                  <Textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Enter the post text or generate with AI using a source link above..."
                    rows={4}
                  />
                </div>

                {/* Post Image */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    Post Image <span className="text-red-500 font-bold text-xs">* (Min 250x250)</span>
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      required
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="text-xs file:bg-indigo-50 file:text-indigo-700 file:border-0 file:rounded-md file:px-2 file:py-1 file:mr-2 hover:file:bg-indigo-100 cursor-pointer"
                    />
                    {selectedFile && <ImageIcon className="h-4 w-4 text-emerald-500 shrink-0" />}
                  </div>
                  {imagePreviewUrl && (
                    <div className="mt-2 relative w-20 h-20 rounded-md overflow-hidden border border-slate-200">
                      <img src={imagePreviewUrl} alt="Post preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>

                {/* Schedule Date & Time */}
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
                    <div className="relative">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          try {
                            if (timeInputRef.current && typeof timeInputRef.current.showPicker === 'function') {
                              timeInputRef.current.showPicker();
                            }
                          } catch (e) {
                            console.log("showPicker not supported on this browser.");
                          }
                        }}
                        className={cn("w-full justify-start text-left font-normal bg-white text-xs h-9", !scheduleTime && "text-muted-foreground")}
                      >
                        <Clock className="mr-2 h-3 w-3" />
                        {scheduleTime ? scheduleTime : <span>Pick a time</span>}
                      </Button>
                      <input
                        type="time"
                        ref={timeInputRef}
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        className="absolute bottom-0 left-0 w-0 h-0 opacity-0 pointer-events-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select required value={formData.status} onValueChange={(val) => handleSelectChange('status', val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Status" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="Pending">Pending</SelectItem>
                      {(!scheduleDate && !scheduleTime) && (
                        <SelectItem value="Approved">Approve</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <Button type="submit" disabled={loading} className="w-full bg-[#217a74] hover:bg-[#1a625d] text-white font-medium">
                  {loading ? "Submitting..." : (scheduleDate && scheduleTime ? "Schedule Post" : "Submit Post")}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Table Column */}
          <Card className="lg:col-span-2 shadow-sm border-slate-200 flex flex-col">
            <CardHeader className="bg-slate-50/50 border-b flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle className="text-lg text-slate-800">Live GMB Postings Tracker</CardTitle>
                <CardDescription>
                  Tracking GMB Postings, scheduled times, and live statuses.
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
                  <p className="font-medium text-slate-700">No Postings Found</p>
                  <p className="text-sm mt-1">Submit a post or click Sync to fetch existing GMB postings.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-slate-50 sticky top-0 z-10">
                    <TableRow>
                      <TableHead>Cluster</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Doctor Name</TableHead>
                      <TableHead>Post Content</TableHead>
                      <TableHead>Scheduled</TableHead>
                      <TableHead>Profile</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tableData.map((row, idx) => (
                      <TableRow key={row._id || idx}>
                        <TableCell className="font-medium text-slate-800">{row.Cluster || row.cluster || '-'}</TableCell>
                        <TableCell>{row.Location || row.location || '-'}</TableCell>
                        <TableCell className="font-medium text-slate-700">{row["Doctor Name"] || row.doctorName || '-'}</TableCell>
                        <TableCell>
                          <div className="max-w-[220px] truncate text-xs text-slate-600" title={row.postsText}>
                            {row.postsText || '-'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-[11px] text-slate-600">
                            {row.scheduledTime ? new Date(row.scheduledTime).toLocaleString() : 'Immediate'}
                          </div>
                        </TableCell>
                        <TableCell>
                          {row.newReviewUri ? (
                            <a href={row.newReviewUri} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline text-xs font-medium inline-flex items-center gap-1">
                              View Profile <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : '-'}
                        </TableCell>
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
