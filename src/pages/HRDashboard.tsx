import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { 
  supabase, 
  formatPH, 
  uploadImage, 
  effectiveRole,
  SYSTEM_ROLES, 
  JOB_POSITIONS, 
  DEPARTMENTS,
  type Profile, 
  type AttendanceRow, 
  type Announcement, 
  type KioskSettings, 
  type AreaCode, 
  type Message, 
  type SystemRole, 
  type Department, 
  type JobPosition 
} from "@/lib/supabase";
import { AppHeader } from "@/components/AppHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Search, UserPlus, Users, CalendarCheck, Megaphone, Trash2, Plus, Settings as SettingsIcon, Coffee, Stethoscope, Pencil, MapPin, Inbox as InboxIcon, Send, CheckCircle2, ImageIcon } from "lucide-react";

export default function HRDashboard() {
  const { profile: adminProfile } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [areaCodes, setAreaCodes] = useState<AreaCode[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [p, a, ann, ac] = await Promise.all([
        supabase.from("profiles")
          .select("id, company_id, full_name, dob, role, system_role, job_position, department, avatar_url, is_approved, email, area_code")
          .order("created_at", { ascending: false }),
        supabase.from("attendance")
          .select("*")
          .order("timestamp", { ascending: false })
          .limit(500),
        supabase.from("announcements")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase.from("area_codes")
          .select("*")
          .order("code", { ascending: true })
      ]);

      setProfiles((p.data as Profile[]) || []);
      setAttendance((a.data as AttendanceRow[]) || []);
      setAnnouncements((ann.data as Announcement[]) || []);
      setAreaCodes((ac.data as AreaCode[]) || []);
    } catch (error) {
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [adminProfile?.company_id]);

  const filteredProfiles = useMemo(() => {
    return profiles.filter(p => 
      p.full_name.toLowerCase().includes(search.toLowerCase()) ||
      p.company_id.includes(search)
    );
  }, [profiles, search]);

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />
      <main className="container mx-auto py-8 px-4 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">HR Management</h1>
            <p className="text-slate-500">Manage employees, attendance, and company updates.</p>
          </div>
          <AddEmployeeDialog areaCodes={areaCodes} onAdded={loadAll} />
        </div>

        <Tabs defaultValue="employees" className="w-full">
          <TabsList className="bg-white border mb-4">
            <TabsTrigger value="employees" className="gap-2"><Users className="h-4 w-4" /> Employees</TabsTrigger>
            <TabsTrigger value="attendance" className="gap-2"><CalendarCheck className="h-4 w-4" /> Attendance</TabsTrigger>
            <TabsTrigger value="announcements" className="gap-2"><Megaphone className="h-4 w-4" /> Announcements</TabsTrigger>
          </TabsList>

          <TabsContent value="employees" className="space-y-4">
            <div className="flex items-center gap-2 max-w-sm">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Search name or ID..." 
                  className="pl-10" 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="bg-white border rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="p-4 text-sm font-semibold text-slate-600">Employee</th>
                    <th className="p-4 text-sm font-semibold text-slate-600">ID</th>
                    <th className="p-4 text-sm font-semibold text-slate-600">Role</th>
                    <th className="p-4 text-sm font-semibold text-slate-600">Department</th>
                    <th className="p-4 text-sm font-semibold text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredProfiles.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={p.avatar_url || ""} />
                            <AvatarFallback>{p.full_name[0]}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{p.full_name}</span>
                        </div>
                      </td>
                      <td className="p-4 text-sm font-mono">{p.company_id}</td>
                      <td className="p-4">
                        <Badge variant="outline" className="capitalize">
                          {effectiveRole(p).replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="p-4 text-sm text-slate-600">{p.department || "—"}</td>
                      <td className="p-4">
                        {p.is_approved ? (
                          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Pending</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="attendance">
            <div className="bg-white border rounded-xl p-6 text-center text-slate-500">
              Attendance records are being grouped by Operational Workday.
              <p className="text-xs mt-2">Check supabase.ts for grouping logic.</p>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function AddEmployeeDialog({ onAdded, areaCodes }: { onAdded: () => void; areaCodes: AreaCode[] }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    company_id: "",
    full_name: "",
    password: "",
    system_role: "employee" as SystemRole,
    department: "production" as Department,
    job_position: "opscrew" as JobPosition,
    email: "",
    area_code: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const { error } = await supabase.from("profiles").insert({
        company_id: form.company_id.trim(),
        full_name: form.full_name.trim(),
        password: form.password,
        system_role: form.system_role,
        department: form.department,
        job_position: form.job_position,
        role: form.system_role, // Sync for legacy support
        email: form.email || null,
        area_code: form.area_code || null,
        is_approved: true
      });

      if (error) throw error;

      toast.success("Employee created successfully");
      setOpen(false);
      onAdded();
      setForm({
        company_id: "", full_name: "", password: "",
        system_role: "employee", department: "production",
        job_position: "opscrew", email: "", area_code: ""
      });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2"><UserPlus className="h-4 w-4" /> Add Employee</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Employee Registration</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Company ID</Label>
              <Input required value={form.company_id} onChange={e => setForm({...form, company_id: e.target.value})} placeholder="e.g. 12345" />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input required type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input required value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} placeholder="Juan Dela Cruz" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>System Role</Label>
              <Select value={form.system_role} onValueChange={v => setForm({...form, system_role: v as SystemRole})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SYSTEM_ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={form.department} onValueChange={v => setForm({...form, department: v as Department})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Job Position</Label>
            <Select value={form.job_position} onValueChange={v => setForm({...form, job_position: v as JobPosition})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {JOB_POSITIONS.map(j => <SelectItem key={j.value} value={j.value}>{j.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="pt-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating..." : "Register Employee"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
