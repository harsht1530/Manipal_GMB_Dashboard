import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Ticket, ExternalLink, RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useMongoData } from "@/hooks/useMongoData";
import confetti from "canvas-confetti";

// TODO: Replace these securely provided URLs once you deploy the Apps Script Web Apps.
const OUT_OF_ORG_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbw8t4-Uuu8-l03YqagyWzGbXbykBqnEbT8IJJbEprgcoAeytUs4MheWLwLQFG6qWe7d/exec";
const OPTIMIZATION_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbzHwoe4dpmaCCLw0Ao4LD3HtC3lR6Rn0xnk8Yn78nn2FpBiZv_4bqFBxZoJSlVapV49-g/exec";
const GMB_PROFILE_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbyKt4EgL6aVxvu-ZJYYf8BBktwtWqhgTAth7CRqYdt4KLCdu1IrUOnnRv6nc7WN7RCx_g/exec";
const GMB_POSTINGS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbyoUw3d_K2XwB5VXz0ciOWeJYWdgPZXvct2GSGWzh37gi5BrZxON1_3CZ2QQURawH8t/execs";

export default function RaisingCase() {
  const { toast } = useToast();
  const { insights } = useMongoData();

  const [activeTab, setActiveTab] = useState<'out-of-org' | 'optimization' | 'gmb-profile' | 'gmb-postings'>('out-of-org');
  const [loading, setLoading] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [tableData, setTableData] = useState<any[]>([]);

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
    status: "Pending"
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Derived Dropdown Data directly from the database context
  const clusters = Array.from(new Set(insights?.map((i: any) => i.cluster))).filter(Boolean).sort() as string[];
  const availableLocations = Array.from(
    new Set(
      insights?.filter((i: any) => formData.cluster ? i.cluster === formData.cluster : true)
        .map((i: any) => i.branch)
    )
  ).filter(Boolean).sort() as string[];

  const loadSheetData = async () => {
    let url = "";
    if (activeTab === 'out-of-org') url = OUT_OF_ORG_WEBAPP_URL;
    else if (activeTab === 'optimization') url = OPTIMIZATION_WEBAPP_URL;
    else if (activeTab === 'gmb-profile') url = GMB_PROFILE_WEBAPP_URL;
    else if (activeTab === 'gmb-postings') url = GMB_POSTINGS_WEBAPP_URL;

    if (url.includes("YOUR_")) {
      setTableData([]);
      return;
    }

    setTableLoading(true);
    try {
      const res = await fetch(url);
      const data = await res.json();
      setTableData(data || []);
    } catch (e) {
      console.error("Failed to load sheet data:", e);
    } finally {
      setTableLoading(false);
    }
  };

  useEffect(() => {
    loadSheetData();
  }, [activeTab]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let url = "";
    if (activeTab === 'out-of-org') url = OUT_OF_ORG_WEBAPP_URL;
    else if (activeTab === 'optimization') url = OPTIMIZATION_WEBAPP_URL;
    else if (activeTab === 'gmb-profile') url = GMB_PROFILE_WEBAPP_URL;
    else if (activeTab === 'gmb-postings') url = GMB_POSTINGS_WEBAPP_URL;

    if (url.includes("YOUR_")) {
      toast({
        title: "Configuration Missing",
        description: "Please configure your Google Apps Script Web App URLs first!",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

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
    } else if (activeTab === 'gmb-postings') {
      payload = {
        "Cluster": formData.cluster,
        "Location": formData.location,
        "Doctor Name": formData.drName,
        "Specialty": formData.speciality,
        "Type of Post": formData.typeOfPost,
        "Source Link": formData.sourceLink,
        "GMB Profile Link": formData.gmbProfileLink,
        "Images": formData.images,
        "Where to Post": formData.whereToPost,
        "Status": formData.status
      };
    }

    try {
      // mode: 'no-cors' specifically prevents browser preflight blocks for simple Google Scripts POST requests
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain'
        },
        body: JSON.stringify(payload)
      });

      // Trigger Joyful Animation
      setIsAnimating(true);

      // Fire confetti sequence right exactly when the ticket lands in the center at 1.5 seconds!
      setTimeout(() => {
        const duration = 1500;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 99999 };

        const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

        const interval: any = setInterval(function () {
          const timeLeft = animationEnd - Date.now();

          if (timeLeft <= 0) {
            return clearInterval(interval);
          }

          const particleCount = 50 * (timeLeft / duration);
          confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
          confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
        }, 250);

        // Huge massive center burst instantly
        confetti({
          particleCount: 150,
          spread: 120,
          origin: { y: 0.5, x: 0.5 },
          colors: ['#217a74', '#ffffff', '#ffb020', '#10b981'],
          zIndex: 99999
        });
      }, 1500);

      // Finish sequence after 3.2 seconds
      setTimeout(() => {
        setIsAnimating(false);

        toast({
          title: "Request Submitted!",
          description: "Your ticket has been successfully submitted to the Sheet!",
        });

        // Clear form
        setFormData({
          cluster: "", location: "", businessName: "", gmbLink: "", googleLink: "", dropDownOption: "", description: "",
          drName: "", speciality: "", address: "", phone: "", website: "", opdTimings: "", coverPhoto: "",
          typeOfPost: "", sourceLink: "", gmbProfileLink: "", images: "", whereToPost: "", status: "Pending"
        });

        loadSheetData();
      }, 3200);

    } catch (error) {
      console.error("Submission error:", error);
      toast({
        title: "Error submitting ticket",
        description: "Please try again later. Check your connection or Apps Script setup.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
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
                  <Select required value={formData.cluster} onValueChange={(val) => handleSelectChange('cluster', val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Cluster" />
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
                  <Select required value={formData.location} onValueChange={(val) => handleSelectChange('location', val)} disabled={!formData.cluster && clusters.length > 0}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Location" />
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
                      <Input required name="drName" value={formData.drName} onChange={handleInputChange} placeholder="Dr. Name" />
                    </div>
                    <div className="space-y-2">
                      <Label>Specialty</Label>
                      <Input required name="speciality" value={formData.speciality} onChange={handleInputChange} placeholder="Specialty" />
                    </div>
                    <div className="space-y-2">
                      <Label>Type of Post</Label>
                      <Select required value={formData.typeOfPost} onValueChange={(val) => handleSelectChange('typeOfPost', val)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Post Type" />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          <SelectItem value="PR Article">PR Article</SelectItem>
                          <SelectItem value="Blogs">Blogs</SelectItem>
                          <SelectItem value="Youtube video">Youtube video</SelectItem>
                          <SelectItem value="Facebook">Facebook</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Source Link (PR, Blog, Video, etc.)</Label>
                      <Input type="url" name="sourceLink" value={formData.sourceLink} onChange={handleInputChange} placeholder="https://..." />
                    </div>
                    <div className="space-y-2">
                      <Label>GMB Profile Link (If available)</Label>
                      <Input type="url" name="gmbProfileLink" value={formData.gmbProfileLink} onChange={handleInputChange} placeholder="https://..." />
                    </div>
                    <div className="space-y-2">
                      <Label>Images (If no source link)</Label>
                      <Input name="images" value={formData.images} onChange={handleInputChange} placeholder="Image URLs" />
                    </div>
                    <div className="space-y-2">
                      <Label>Where to post</Label>
                      <Select required value={formData.whereToPost} onValueChange={(val) => handleSelectChange('whereToPost', val)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Destination" />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          <SelectItem value="Hospital & Doctor's Pages">Hospital & Doctor's Pages</SelectItem>
                          <SelectItem value="Only Hospital Page">Only Hospital Page</SelectItem>
                          <SelectItem value="Only Doctor's Page">Only Doctor's Page</SelectItem>
                          <SelectItem value="Doctor, Department, MARS, Clinics & Hospital pages">Doctor, Department, MARS, Clinics & Hospital pages</SelectItem>
                        </SelectContent>
                      </Select>
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
                      <SelectItem value="Done">Done</SelectItem>
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
                  Showing records synced from {activeTab === 'out-of-org' ? 'Out of Organization' : 'Optimization Cards'} sheet.
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
                          <TableHead>Type</TableHead>
                          <TableHead>Target</TableHead>
                        </>
                      )}
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tableData.map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{row.Cluster || '-'}</TableCell>
                        <TableCell>{row.Location || '-'}</TableCell>

                        {(activeTab === 'out-of-org' || activeTab === 'optimization') && (
                          <TableCell>{row["Business name"] || row["Business Name"] || '-'}</TableCell>
                        )}
                        {(activeTab === 'gmb-profile' || activeTab === 'gmb-postings') && (
                          <TableCell>{row["Doctor Name"] || '-'}</TableCell>
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
                            <TableCell>{row["Type of Post"] || '-'}</TableCell>
                            <TableCell>
                              <span className="px-2 py-1 bg-blue-50 text-blue-700 text-[10px] rounded-md font-medium border border-blue-100">
                                {row["Where to Post"] || '-'}
                              </span>
                            </TableCell>
                          </>
                        )}

                        <TableCell>
                          <span className={`px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider rounded-full border ${(() => {
                            const s = (row.Status || '').toLowerCase();
                            if (s === 'resolved' || s === 'completed' || s === 'done') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
                            if (s === 'processing' || s === 'in process' || s === 'in progress') return 'bg-amber-50 text-amber-700 border-amber-200';
                            if (s === 'pending' || s === 'new') return 'bg-blue-50 text-blue-700 border-blue-200';
                            if (s === 'cancelled' || s === 'rejected') return 'bg-red-50 text-red-700 border-red-200';
                            return 'bg-slate-50 text-slate-700 border-slate-200';
                          })()}`}>
                            {row.Status || 'Pending'}
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
