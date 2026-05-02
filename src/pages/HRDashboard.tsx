import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase, formatPH, type Profile, type AttendanceRow, type Announcement, type KioskSettings } from "@/lib/supabase";
import { AppHeader } from "@/components/AppHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Search, UserPlus, Users, CalendarCheck, Megaphone, Trash2, Plus, Settings as SettingsIcon, Coffee, Stethoscope } from "lucide-react";
import { format, subDays, startOfDay } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function HRDashboard() {
  const { profile } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [settings, setSettings] = useState<KioskSettings | null>(null);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");

  const loadAll = async () => {
    const [p, a, ann, s] = await Promise.all([
      supabase.from("profiles").select("id, company_id, full_name, dob, role, avatar_url, is_approved, email, position").order("created_at", { ascending: false }),
      supabase.from("attendance").select("*").order("timestamp", { ascending: false }).limit(500),
      supabase.from("announcements").select("*").order("created_at", { ascending: false }),
      supabase.from("kiosk_settings").select("*").limit(1).maybeSingle(),
    ]);
    setProfiles((p.data as Profile[]) ?? []);
    setAttendance((a.data as AttendanceRow[]) ?? []);
    setAnnouncements((ann.data as Announcement[]) ?? []);
    setSettings((s.data as KioskSettings) ?? null);
  };

  useEffect(() => { loadAll(); }, []);

  const filtered = useMemo(() =>
    profiles.filter(p => !search || p.company_id?.toLowerCase().includes(search.toLowerCase()) || p.full_name?.toLowerCase().includes(search.toLowerCase())),
  [profiles, search]);

  const filteredAttendance = useMemo(() => attendance.filter(r => {
    if (dateFilter && format(new Date(r.timestamp), "yyyy-MM-dd") !== dateFilter) return false;
    if (employeeFilter && !r.company_id.toLowerCase().includes(employeeFilter.toLowerCase())) return false;
    return true;
  }), [attendance, dateFilter, employeeFilter]);

  const toggleApproval = async (p: Profile) => {
    const next = !p.is_approved;
    const { error } = await supabase.from("profiles").update({ is_approved: next }).eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success(`${p.full_name} ${next ? "approved" : "revoked"}`);
    setProfiles(profiles.map(x => x.id === p.id ? { ...x, is_approved: next } : x));
  };

  // Analytics: last 7 days attendance counts
  const chartData = useMemo(() => {
    const days = Array.from({ length: 7 }).map((_, i) => startOfDay(subDays(new Date(), 6 - i)));
    return days.map(d => {
      const key = format(d, "yyyy-MM-dd");
      const count = new Set(attendance.filter(r => format(new Date(r.timestamp), "yyyy-MM-dd") === key && r.type === "time_in").map(r => r.company_id)).size;
      return { day: format(d, "MMM d"), present: count };
    });
  }, [attendance]);

  const totalEmployees = profiles.length;
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const presentToday = new Set(attendance.filter(r => format(new Date(r.timestamp), "yyyy-MM-dd") === todayKey && r.type === "time_in").map(r => r.company_id)).size;
  const rate = totalEmployees ? Math.round((presentToday / totalEmployees) * 100) : 0;

  if (!profile) return null;

  return (
    <div className="min-h-screen gradient-subtle">
      <AppHeader />
      <main className="container py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">HR Console</h1>
          <p className="text-muted-foreground">Manage employees, monitor attendance and publish announcements.</p>
        </div>

        {/* KPIs */}
        <div className="grid sm:grid-cols-3 gap-4">
          <Kpi label="Total Employees" value={totalEmployees} icon={<Users className="h-5 w-5" />} />
          <Kpi label="Present Today" value={presentToday} icon={<CalendarCheck className="h-5 w-5" />} />
          <Kpi label="Daily Rate" value={`${rate}%`} icon={<CalendarCheck className="h-5 w-5" />} />
        </div>

        <Tabs defaultValue="employees" className="space-y-4">
          <TabsList className="rounded-2xl flex-wrap h-auto">
            <TabsTrigger value="employees" className="rounded-xl">Employees</TabsTrigger>
            <TabsTrigger value="attendance" className="rounded-xl">Attendance</TabsTrigger>
            <TabsTrigger value="analytics" className="rounded-xl">Analytics</TabsTrigger>
            <TabsTrigger value="announcements" className="rounded-xl">Announcements</TabsTrigger>
            <TabsTrigger value="settings" className="rounded-xl">Settings</TabsTrigger>
          </TabsList>

          {/* EMPLOYEES */}
          <TabsContent value="employees" className="space-y-4">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search by company ID or name…" value={search} onChange={e => setSearch(e.target.value)} className="pl-10 rounded-xl" />
              </div>
              <AddEmployeeDialog onAdded={loadAll} />
            </div>
            <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-soft">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-4">Employee</th>
                    <th className="p-4">Company ID</th>
                    <th className="p-4">Role</th>
                    <th className="p-4">DOB</th>
                    <th className="p-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => (
                    <tr key={p.id} className="border-t border-border hover:bg-muted/30">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9"><AvatarImage src={p.avatar_url ?? undefined} /><AvatarFallback className="bg-primary text-primary-foreground text-xs">{p.full_name?.split(" ").map(n=>n[0]).slice(0,2).join("")}</AvatarFallback></Avatar>
                          <span className="font-medium">{p.full_name}</span>
                        </div>
                      </td>
                      <td className="p-4 font-mono">{p.company_id}</td>
                      <td className="p-4"><Badge variant="secondary" className="rounded-lg">{p.role}</Badge></td>
                      <td className="p-4">{p.dob ? format(new Date(p.dob), "PP") : "—"}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <Switch checked={p.is_approved} onCheckedChange={() => toggleApproval(p)} />
                          <span className={p.is_approved ? "text-success font-medium" : "text-muted-foreground"}>{p.is_approved ? "Approved" : "Pending"}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (<tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No employees found.</td></tr>)}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* ATTENDANCE — daily pairs with shift, late, OT */}
          <TabsContent value="attendance" className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="rounded-xl max-w-[200px]" />
              <Input placeholder="Filter by Company ID or name" value={employeeFilter} onChange={e => setEmployeeFilter(e.target.value)} className="rounded-xl max-w-[260px]" />
              <Button variant="outline" onClick={() => { setDateFilter(""); setEmployeeFilter(""); }} className="rounded-xl">Clear</Button>
            </div>
            <AttendanceTable
              attendance={filteredAttendance}
              profiles={profiles}
              settings={settings}
            />
          </TabsContent>

          {/* ANALYTICS */}
          <TabsContent value="analytics">
            <div className="rounded-2xl bg-card border border-border shadow-soft p-6">
              <h3 className="font-bold mb-4">Attendance — Last 7 Days</h3>
              <div className="h-80">
                <ResponsiveContainer>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" />
                    <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                    <Bar dataKey="present" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </TabsContent>

          {/* ANNOUNCEMENTS */}
          <TabsContent value="announcements" className="space-y-4">
            <AnnouncementForm onAdded={loadAll} />
            <div className="grid md:grid-cols-2 gap-4">
              {announcements.map(a => (
                <div key={a.id} className="rounded-2xl bg-card border border-border shadow-soft p-5">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2"><Megaphone className="h-4 w-4 text-primary" /><h4 className="font-bold">{a.title}</h4></div>
                    <Button size="icon" variant="ghost" onClick={async () => {
                      await supabase.from("announcements").delete().eq("id", a.id);
                      toast.success("Deleted"); loadAll();
                    }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                  {a.image_url && <img src={a.image_url} alt={a.title} className="rounded-xl mb-3 max-h-40 w-full object-cover" />}
                  {a.body && <p className="text-sm text-muted-foreground">{a.body}</p>}
                  <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                    <Switch checked={a.active} onCheckedChange={async v => {
                      await supabase.from("announcements").update({ active: v }).eq("id", a.id); loadAll();
                    }} /> {a.active ? "Active" : "Hidden"}
                  </div>
                </div>
              ))}
              {announcements.length === 0 && <p className="text-muted-foreground">No announcements yet.</p>}
            </div>
          </TabsContent>
          {/* SETTINGS */}
          <TabsContent value="settings">
            <SettingsPanel settings={settings} onSaved={loadAll} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function Kpi({ label, value, icon }: { label: string; value: any; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-card border border-border shadow-soft p-6 flex items-center justify-between">
      <div>
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="text-3xl font-extrabold mt-1">{value}</div>
      </div>
      <div className="h-12 w-12 rounded-xl gradient-primary text-primary-foreground flex items-center justify-center shadow-soft">{icon}</div>
    </div>
  );
}

function AddEmployeeDialog({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ company_id: "", full_name: "", password: "", role: "Employee", dob: "" });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.company_id || !form.full_name || !form.password) { toast.error("Company ID, name, and password are required"); return; }
    setSaving(true);
    const { error } = await supabase.from("profiles").insert({
      company_id: form.company_id.trim(),
      full_name: form.full_name.trim(),
      password: form.password,
      role: form.role,
      dob: form.dob || null,
      is_approved: true,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Employee added");
    setOpen(false);
    setForm({ company_id: "", full_name: "", password: "", role: "Employee", dob: "" });
    onAdded();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-xl gradient-primary text-primary-foreground hover:opacity-90 shadow-soft"><UserPlus className="h-4 w-4 mr-2" />Add Employee</Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl">
        <DialogHeader><DialogTitle>Add Employee</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Company ID"><Input value={form.company_id} onChange={e => setForm({ ...form, company_id: e.target.value })} /></Field>
          <Field label="Full name"><Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></Field>
          <Field label="Password"><Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></Field>
          <Field label="Role"><Input value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} placeholder="Employee / HR / Admin" /></Field>
          <Field label="Date of birth"><Input type="date" value={form.dob} onChange={e => setForm({ ...form, dob: e.target.value })} /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl">Cancel</Button>
          <Button onClick={submit} disabled={saving} className="rounded-xl gradient-primary text-primary-foreground">{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AnnouncementForm({ onAdded }: { onAdded: () => void }) {
  const [form, setForm] = useState({ title: "", body: "", image_url: "" });
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    setSaving(true);
    const { error } = await supabase.from("announcements").insert({ ...form, active: true });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Announcement published");
    setForm({ title: "", body: "", image_url: "" });
    onAdded();
  };
  return (
    <div className="rounded-2xl bg-card border border-border shadow-soft p-5 space-y-3">
      <h3 className="font-bold flex items-center gap-2"><Megaphone className="h-4 w-4 text-primary" /> New Announcement</h3>
      <div className="grid md:grid-cols-3 gap-3">
        <Input placeholder="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="rounded-xl" />
        <Input placeholder="Image URL (optional)" value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })} className="rounded-xl" />
        <Input placeholder="Body" value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} className="rounded-xl" />
      </div>
      <Button onClick={submit} disabled={saving} className="rounded-xl gradient-primary text-primary-foreground"><Plus className="h-4 w-4 mr-2" />{saving ? "Publishing…" : "Publish"}</Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
