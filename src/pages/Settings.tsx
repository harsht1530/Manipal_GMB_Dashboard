import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  User,
  Shield,
  Trash2,
  Edit2,
  Plus,
  Loader2,
  Lock,
  Mail,
  Building2,
  Network,
  Palette,
  Camera,
  Moon,
  Sun,
  Laptop,
  Download,
  Filter,
  BellRing
} from "lucide-react";
import * as XLSX from "xlsx";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface UserData {
  _id: string;
  user: string;
  orgEmail: string;
  mail?: string;
  psw: string;
  Cluster?: string;
  Branch?: string;
  Name?: string;
  notifyPhoneChange?: boolean;
  notifyNameChange?: boolean;
  notifyMonthlyReport?: boolean;
}

const Settings = () => {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const [roleFilter, setRoleFilter] = useState("All");
  const [personalInfo, setPersonalInfo] = useState({
    name: currentUser?.name || "",
    notifications: currentUser?.notifications || {
      phoneChange: true,
      nameChange: true,
      monthlyReport: true
    }
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [availableClusters, setAvailableClusters] = useState<string[]>([]);
  const [availableBranches, setAvailableBranches] = useState<string[]>([]);

  // Form State
  const [formData, setFormData] = useState({
    user: "",
    orgEmail: "",
    psw: "",
    role: "Branch", // User role (stored in 'user' field in DB)
    Cluster: "",
    Branch: "",
    Name: ""
  });

  useEffect(() => {
    if (currentUser?.role === "Admin") {
      fetchUsers();
      fetchClustersBranches();
    }
  }, [currentUser, navigate]);

  const fetchClustersBranches = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/clusters-branches`);
      const data = await res.json();
      if (data.success) {
        setAvailableClusters(data.data.clusters);
        setAvailableBranches(data.data.branches);
      }
    } catch (error) {
      console.error("Failed to fetch clusters/branches", error);
    }
  };

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/users`);
      const data = await res.json();
      if (data.success) {
        setUsers(data.data);
      }
    } catch (error) {
      toast.error("Failed to fetch users");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingUser ? "PUT" : "POST";
    const url = editingUser ? `${import.meta.env.VITE_API_BASE_URL}/api/users/${editingUser._id}` : `${import.meta.env.VITE_API_BASE_URL}/api/users`;

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          user: formData.role // In this DB schema, 'user' field stores the role
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`User ${editingUser ? "updated" : "created"} successfully`);
        setIsDialogOpen(false);
        setEditingUser(null);
        resetForm();
        fetchUsers();
      }
    } catch (error) {
      toast.error("Operation failed");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/users/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success("User deleted");
        fetchUsers();
      }
    } catch (error) {
      toast.error("Delete failed");
    }
  };

  const handleEdit = (user: UserData) => {
    setEditingUser(user);
    setFormData({
      user: user.user,
      orgEmail: user.orgEmail || user.mail || "",
      psw: user.psw,
      role: user.user,
      Cluster: user.Cluster || "",
      Branch: user.Branch || "",
      Name: user.Name || ""
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      user: "",
      orgEmail: "",
      psw: "",
      role: "Branch",
      Cluster: "",
      Branch: "",
      Name: ""
    });
  };

  const handleUpdateProfile = async (e?: React.FormEvent, updatedNotifications?: { phoneChange: boolean, nameChange: boolean, monthlyReport: boolean }) => {
    if (e) e.preventDefault();
    setIsSavingProfile(true);
    try {
      const userInDb = users.find(u => (u.orgEmail || u.mail) === currentUser?.email);
      if (!userInDb) {
        toast.error("Could not find user record to update");
        return;
      }

      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/users/${userInDb._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Name: personalInfo.name,
          notifyPhoneChange: updatedNotifications ? updatedNotifications.phoneChange : personalInfo.notifications.phoneChange,
          notifyNameChange: updatedNotifications ? updatedNotifications.nameChange : personalInfo.notifications.nameChange,
          notifyMonthlyReport: updatedNotifications ? updatedNotifications.monthlyReport : personalInfo.notifications.monthlyReport
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Settings updated successfully");
        const updatedUser = {
          ...currentUser,
          name: personalInfo.name,
          notifications: updatedNotifications || personalInfo.notifications
        };
        localStorage.setItem("user", JSON.stringify(updatedUser));
        // Only reload if name changed to update header, otherwise just let state be
        if (personalInfo.name !== currentUser?.name) {
          window.location.reload();
        }
      }
    } catch (error) {
      toast.error("Failed to update settings");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleExportCSV = () => {
    const dataToExport = filteredUsers.map(u => ({
      Name: u.Name || "No Name",
      Email: u.orgEmail || u.mail,
      Role: u.user,
      "Access Scope": u.user === "Admin" ? "Global" : (u.user === "Cluster" ? u.Cluster : u.Branch)
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Users");
    XLSX.writeFile(wb, "Manipal_Users_Export.xlsx");
  };

  const filteredUsers = users.filter(u => {
    if (roleFilter === "All") return true;
    return u.user === roleFilter;
  });

  if (!currentUser) {
    return null;
  }

  return (
    <DashboardLayout title="Settings" subtitle="Manage account details and user access levels">
      <div className="space-y-8">
        {/* My Account Card */}
        <Card className="animate-fade-in border-primary/20 bg-primary/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary rounded-lg">
                  <User className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle>My Account</CardTitle>
                  <CardDescription>Your current access details</CardDescription>
                </div>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 border-primary/20 hover:bg-primary/10"
                onClick={() => {
                  const me = users.find(u => (u.orgEmail || u.mail) === currentUser?.email);
                  if (me) handleEdit(me);
                }}
              >
                <Edit2 className="h-4 w-4 text-primary" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Mail className="h-4 w-4" /> Email Address
                </p>
                <p className="font-medium">{currentUser.email}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Shield className="h-4 w-4" /> Account Role
                </p>
                <Badge variant="default" className="bg-primary text-white">
                  {currentUser.role}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Lock className="h-4 w-4" /> Access Level
                </p>
                <p className="font-medium text-primary">
                  {currentUser.role === "Admin" ? "Full Administrator Access" : `${currentUser.role} Level Access`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Personalization Section */}
          <Card className="border-primary/10 shadow-md">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/10 rounded-lg">
                  <Palette className="h-5 w-5 text-indigo-500" />
                </div>
                <div>
                  <CardTitle>Personalization</CardTitle>
                  <CardDescription>Customize your dashboard experience</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label className="text-sm font-medium">Appearance Theme</Label>
                <div className="grid grid-cols-3 gap-3">
                  <Button
                    variant={theme === "light" ? "default" : "outline"}
                    className="flex flex-col h-20 gap-2 font-normal"
                    onClick={() => {
                      setTheme("light");
                      document.documentElement.classList.remove("dark");
                    }}
                  >
                    <Sun className="h-5 w-5" />
                    <span>Light</span>
                  </Button>
                  <Button
                    variant={theme === "dark" ? "default" : "outline"}
                    className="flex flex-col h-20 gap-2 font-normal"
                    onClick={() => {
                      setTheme("dark");
                      document.documentElement.classList.add("dark");
                    }}
                  >
                    <Moon className="h-5 w-5" />
                    <span>Dark</span>
                  </Button>
                  <Button
                    variant={theme === "system" ? "default" : "outline"}
                    className="flex flex-col h-20 gap-2 font-normal"
                    onClick={() => setTheme("system")}
                  >
                    <Laptop className="h-5 w-5" />
                    <span>System</span>
                  </Button>
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Compact Sidebar</Label>
                  <p className="text-xs text-muted-foreground">Maximize your workspace</p>
                </div>
                <Badge variant="outline">Soon</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Notification Settings Section */}
          {currentUser.role === "Admin" && (
            <Card className="border-primary/10 shadow-md">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/10 rounded-lg">
                    <BellRing className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <CardTitle>Notification Preferences</CardTitle>
                    <CardDescription>Manage your email alerts</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>GMB Phone Change</Label>
                    <p className="text-xs text-muted-foreground">Alert when profile phonenumber changes</p>
                  </div>
                  <Switch
                    checked={personalInfo.notifications.phoneChange}
                    onCheckedChange={(checked) => {
                      const newNotifications = { ...personalInfo.notifications, phoneChange: checked };
                      setPersonalInfo({ ...personalInfo, notifications: newNotifications });
                      handleUpdateProfile(undefined, newNotifications);
                    }}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Business Name Change</Label>
                    <p className="text-xs text-muted-foreground">Alert when GMB profile name changes</p>
                  </div>
                  <Switch
                    checked={personalInfo.notifications.nameChange}
                    onCheckedChange={(checked) => {
                      const newNotifications = { ...personalInfo.notifications, nameChange: checked };
                      setPersonalInfo({ ...personalInfo, notifications: newNotifications });
                      handleUpdateProfile(undefined, newNotifications);
                    }}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Monthly GMB Report</Label>
                    <p className="text-xs text-muted-foreground">Receive periodic performance insights</p>
                  </div>
                  <Switch
                    checked={personalInfo.notifications.monthlyReport}
                    onCheckedChange={(checked) => {
                      const newNotifications = { ...personalInfo.notifications, monthlyReport: checked };
                      setPersonalInfo({ ...personalInfo, notifications: newNotifications });
                      handleUpdateProfile(undefined, newNotifications);
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* User Management Section */}
        {
          currentUser.role === "Admin" && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded-lg border">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="h-8 w-[130px] border-0 bg-transparent focus:ring-0">
                      <SelectValue placeholder="Filter Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Roles</SelectItem>
                      <SelectItem value="Admin">Admin Only</SelectItem>
                      <SelectItem value="Cluster">Cluster Only</SelectItem>
                      <SelectItem value="Branch">Branch Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2">
                  <Download className="h-4 w-4" /> Export Excel
                </Button>
                <Dialog open={isDialogOpen} onOpenChange={(open) => {
                  setIsDialogOpen(open);
                  if (!open) {
                    setEditingUser(null);
                    resetForm();
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button className="gap-2 shadow-lg hover:shadow-primary/20 transition-all">
                      <Plus className="h-4 w-4" /> Add New User
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                      <DialogTitle>{editingUser ? "Edit User" : "Create New User"}</DialogTitle>
                      <DialogDescription>
                        Fill in the details below to grant platform access.
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Access Role</Label>
                          <Select
                            value={formData.role}
                            onValueChange={(val) => setFormData({ ...formData, role: val })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select Role" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Admin">Admin</SelectItem>
                              <SelectItem value="Cluster">Cluster</SelectItem>
                              <SelectItem value="Branch">Branch</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Password</Label>
                          <Input
                            type="password"
                            required
                            value={formData.psw}
                            onChange={(e) => setFormData({ ...formData, psw: e.target.value })}
                            placeholder="••••••••"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>User's Full Name</Label>
                        <Input
                          required
                          value={formData.Name}
                          onChange={(e) => setFormData({ ...formData, Name: e.target.value })}
                          placeholder="e.g. John Doe"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Organization Email</Label>
                        <Input
                          type="email"
                          required
                          value={formData.orgEmail}
                          onChange={(e) => setFormData({ ...formData, orgEmail: e.target.value })}
                          placeholder="user@manipal.com"
                        />
                      </div>

                      {formData.role === "Cluster" && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                          <Label>Assigned Cluster</Label>
                          <Select
                            value={formData.Cluster}
                            onValueChange={(value) => setFormData({ ...formData, Cluster: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select a cluster" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableClusters.map((cluster) => (
                                <SelectItem key={cluster} value={cluster}>
                                  {cluster}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {formData.role === "Branch" && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                          <Label>Assigned Branch</Label>
                          <Select
                            value={formData.Branch}
                            onValueChange={(value) => setFormData({ ...formData, Branch: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select a branch" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableBranches.map((branch) => (
                                <SelectItem key={branch} value={branch}>
                                  {branch}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <DialogFooter className="pt-4">
                        <Button type="submit" className="w-full">
                          {editingUser ? "Save Changes" : "Create User"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <Card className="shadow-xl border-t-4 border-t-primary">
                <CardContent className="p-0">
                  {isLoading ? (
                    <div className="flex items-center justify-center p-12">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                          <TableHead className="w-[250px] font-bold">Name / Email</TableHead>
                          <TableHead className="font-bold">Role</TableHead>
                          <TableHead className="font-bold">Access Scope</TableHead>
                          <TableHead className="text-right font-bold pr-6">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers.map((u) => {
                          const isAnotherAdmin = u.user === "Admin" && (u.orgEmail || u.mail) !== currentUser?.email;
                          return (
                            <TableRow key={u._id} className="hover:bg-muted/20 transition-colors">
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="font-medium text-foreground">{u.Name || "No Name"}</span>
                                  <span className="text-sm text-muted-foreground">{u.orgEmail || u.mail}</span>
                                  <span className="text-xs text-muted-foreground italic">Password: {u.psw}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={u.user === "Admin" ? "default" : "secondary"}
                                  className={u.user === "Admin" ? "bg-primary" : ""}
                                >
                                  {u.user}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {u.user === "Admin" && <span className="text-sm">Global</span>}
                                {u.user === "Cluster" && (
                                  <div className="flex items-center gap-1.5 text-sm">
                                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="font-semibold">{u.Cluster}</span>
                                  </div>
                                )}
                                {u.user === "Branch" && (
                                  <div className="flex items-center gap-1.5 text-sm">
                                    <Network className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="font-semibold">{u.Branch}</span>
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="text-right pr-4">
                                <div className="flex items-center justify-end gap-2">
                                  {!isAnotherAdmin ? (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleEdit(u)}
                                        className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                                      >
                                        <Edit2 className="h-4 w-4" />
                                      </Button>
                                      {(u.orgEmail || u.mail) !== currentUser?.email && (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => handleDelete(u._id)}
                                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      )}
                                    </>
                                  ) : (
                                    <Badge variant="outline" className="text-[10px] opacity-50">Protected</Badge>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          )
        }
      </div>
    </DashboardLayout>
  );
};

export default Settings;
