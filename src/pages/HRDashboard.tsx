import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase, formatPH, uploadImage, lastNameOf, DEFAULT_AREA_CODES, type Profile, type AttendanceRow, type Announcement, type KioskSettings, type AreaCode, type Message } from "@/lib/supabase";
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
import { format, subDays, startOfDay } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function HRDashboard() {
  const { profile } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [settings, setSettings] = useState<KioskSettings | null>(null);
  const [visitors, setVisitors] = useState<any[]>([]);
  const [clinicReqs, setClinicReqs] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [areaCodes, setAreaCodes] = useState<AreaCode[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");

  const loadAll = async () => {
    const [p, a, ann, s, v, c, h, ac, m] = await Promise.all([
      supabase.from("profiles").select("id, company_id, full_name, dob, role, avatar_url, is_approved, email, position, area_code").order("created_at", { ascending: false }),
      supabase.from("attendance").select("*").order("timestamp", { ascending: false }).limit(1000),
      supabase.from("announcements").select("*").order("created_at", { ascending: false }),
      supabase.from("kiosk_settings").select("*").limit(1).maybeSingle(),
      supabase.from("visitors").select("*").order("time_in", { ascending: false }).limit(200),
      supabase.from("clinic_requests").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("holidays").select("*").order("date", { ascending: true }),
      supabase.from("area_codes").select("*").order("code"),
      profile ? supabase.from("messages").select("*").or(`to_company_id.eq.${profile.company_id},from_company_id.eq.${profile.company_id}`).order("created_at", { ascending: false }).limit(200) : Promise.resolve({ data: [] }),
    ]);
    setProfiles((p.data as Profile[]) ?? []);
    setAttendance((a.data as AttendanceRow[]) ?? []);
    setAnnouncements((ann.data as Announcement[]) ?? []);
    setSettings((s.data as KioskSettings) ?? null);
    setVisitors(v.data ?? []);
    setClinicReqs(c.data ?? []);
    setHolidays(h.data ?? []);
    setAreaCodes((ac.data as AreaCode[]) ?? []);
    setMessages((m.data as Message[]) ?? []);
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [profile?.company_id]);

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
            <TabsTrigger value="areas" className="rounded-xl">Area Codes</TabsTrigger>
            <TabsTrigger value="inbox" className="rounded-xl">Inbox</TabsTrigger>
            <TabsTrigger value="visitors" className="rounded-xl">Visitors</TabsTrigger>
            <TabsTrigger value="clinic" className="rounded-xl">Clinic</TabsTrigger>
            <TabsTrigger value="holidays" className="rounded-xl">Holidays</TabsTrigger>
            <TabsTrigger value="settings" className="rounded-xl">Settings</TabsTrigger>
          </TabsList>

          {/* EMPLOYEES */}
          <TabsContent value="employees" className="space-y-4">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search by company ID or name…" value={search} onChange={e => setSearch(e.target.value)} className="pl-10 rounded-xl" />
              </div>
              <AddEmployeeDialog areaCodes={areaCodes} onAdded={loadAll} />
            </div>
            <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-soft overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-4">Employee</th>
                    <th className="p-4">Company ID</th>
                    <th className="p-4">Role</th>
                    <th className="p-4">Area</th>
                    <th className="p-4">DOB</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
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
                      <td className="p-4 font-mono text-xs">{p.area_code ?? "—"}</td>
                      <td className="p-4">{p.dob ? format(new Date(p.dob), "PP") : "—"}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <Switch checked={p.is_approved} onCheckedChange={() => toggleApproval(p)} />
                          <span className={p.is_approved ? "text-success font-medium" : "text-muted-foreground"}>{p.is_approved ? "Approved" : "Pending"}</span>
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="inline-flex gap-1">
                          <EditEmployeeDialog employee={p} areaCodes={areaCodes} onSaved={loadAll} />
                          <Button size="icon" variant="ghost" onClick={async () => {
                            if (!confirm(`Delete ${p.full_name}? This cannot be undone.`)) return;
                            const { error } = await supabase.from("profiles").delete().eq("id", p.id);
                            if (error) return toast.error(error.message);
                            toast.success("Employee deleted"); loadAll();
                          }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (<tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No employees found.</td></tr>)}
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
              onChanged={loadAll}
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
          <TabsContent value="areas">
            <AreaCodesPanel rows={areaCodes} onChanged={loadAll} />
          </TabsContent>
          <TabsContent value="inbox">
            <InboxPanel currentId={profile?.company_id ?? ""} messages={messages} profiles={profiles} onChanged={loadAll} />
          </TabsContent>
          <TabsContent value="visitors">
            <VisitorsTable rows={visitors} />
          </TabsContent>
          <TabsContent value="clinic">
            <ClinicTable rows={clinicReqs} onChanged={loadAll} />
          </TabsContent>
          <TabsContent value="holidays">
            <HolidaysPanel rows={holidays} onChanged={loadAll} />
          </TabsContent>
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
  const [form, setForm] = useState({ company_id: "", full_name: "", password: "", role: "Employee", dob: "", email: "", position: "" });
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
      email: form.email.trim() || null,
      position: form.position.trim() || null,
      is_approved: true,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Employee added");
    setOpen(false);
    setForm({ company_id: "", full_name: "", password: "", role: "Employee", dob: "", email: "", position: "" });
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
          <Field label="Email"><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Position"><Input value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} placeholder="e.g. Operator" /></Field>
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

function AttendanceTable({ attendance, profiles, settings }: { attendance: AttendanceRow[]; profiles: Profile[]; settings: KioskSettings | null }) {
  const profileMap = useMemo(() => {
    const m: Record<string, Profile> = {};
    profiles.forEach(p => { m[p.company_id] = p; });
    return m;
  }, [profiles]);

  const grouped = useMemo(() => {
    const map: Record<string, { date: string; companyId: string; in?: AttendanceRow; out?: AttendanceRow }> = {};
    attendance.forEach(r => {
      const date = formatPH(r.timestamp, { year: "numeric", month: "2-digit", day: "2-digit" });
      const key = `${r.company_id}|${date}`;
      map[key] = map[key] ?? { date, companyId: r.company_id };
      if (r.type === "time_in") map[key].in = r;
      else map[key].out = r;
    });
    return Object.values(map).sort((a, b) => (b.date + b.companyId).localeCompare(a.date + a.companyId));
  }, [attendance]);

  const lateDay = settings?.late_threshold_day ?? "06:05";
  const lateNight = settings?.late_threshold_night ?? "18:05";

  const isLate = (row: AttendanceRow): boolean => {
    if (!row) return false;
    const t = formatPH(row.timestamp, { hour: "2-digit", minute: "2-digit", hour12: false });
    const threshold = row.shift === "night" ? lateNight : lateDay;
    return t > threshold;
  };

  const computeOT = (g: { in?: AttendanceRow; out?: AttendanceRow }): string => {
    if (!g.in || !g.out) return "—";
    const outDate = new Date(g.out.timestamp);
    const inDate = new Date(g.in.timestamp);
    const shift = g.in.shift;
    const inPHHour = parseInt(formatPH(inDate, { hour: "2-digit", hour12: false }));
    const endPH = new Date(inDate);
    if (shift === "day") {
      endPH.setUTCHours(18 - 8, 0, 0, 0);
      if (inPHHour >= 18) endPH.setUTCDate(endPH.getUTCDate() + 1);
    } else {
      endPH.setUTCHours(6 - 8, 0, 0, 0);
      endPH.setUTCDate(endPH.getUTCDate() + 1);
    }
    const diffMin = Math.round((outDate.getTime() - endPH.getTime()) / 60000);
    if (diffMin <= 0) return "—";
    const h = Math.floor(diffMin / 60); const m = diffMin % 60;
    return `${h}h ${m}m`;
  };

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-soft overflow-x-auto">
      <table className="w-full text-sm min-w-[800px]">
        <thead className="bg-muted/50 text-left">
          <tr>
            <th className="p-4">Date</th>
            <th className="p-4">Employee</th>
            <th className="p-4">Position</th>
            <th className="p-4">Time In</th>
            <th className="p-4">Time Out</th>
            <th className="p-4">Shift</th>
            <th className="p-4">Status</th>
            <th className="p-4">Overtime</th>
          </tr>
        </thead>
        <tbody>
          {grouped.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No attendance records.</td></tr>}
          {grouped.map(g => {
            const p = profileMap[g.companyId];
            const late = g.in ? isLate(g.in) : false;
            return (
              <tr key={`${g.companyId}-${g.date}`} className="border-t border-border hover:bg-muted/30">
                <td className="p-4">{g.date}</td>
                <td className="p-4 font-medium">{p?.full_name ?? g.companyId}</td>
                <td className="p-4 text-muted-foreground">{p?.position ?? "—"}</td>
                <td className="p-4">{g.in ? formatPH(g.in.timestamp, { hour: "2-digit", minute: "2-digit", hour12: true }) : "—"}</td>
                <td className="p-4">{g.out ? formatPH(g.out.timestamp, { hour: "2-digit", minute: "2-digit", hour12: true }) : "—"}</td>
                <td className="p-4">{g.in?.shift ? <Badge variant="secondary" className="rounded-lg capitalize">{g.in.shift}</Badge> : "—"}</td>
                <td className="p-4">
                  {late
                    ? <Badge className="rounded-lg bg-warning/20 text-foreground border border-warning/40">Late</Badge>
                    : g.in ? <Badge className="rounded-lg bg-success/15 text-success">On time</Badge> : <Badge variant="secondary" className="rounded-lg">—</Badge>}
                </td>
                <td className="p-4 font-mono text-xs">{computeOT(g)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SettingsPanel({ settings, onSaved }: { settings: KioskSettings | null; onSaved: () => void }) {
  const [form, setForm] = useState<Partial<KioskSettings>>({
    canteen_status: settings?.canteen_status ?? "open",
    clinic_status: settings?.clinic_status ?? "open",
    late_threshold_day: settings?.late_threshold_day ?? "06:05",
    late_threshold_night: settings?.late_threshold_night ?? "18:05",
    geofence_radius_m: settings?.geofence_radius_m ?? 100,
    geofence_lat: settings?.geofence_lat ?? 14.258657284905194,
    geofence_lng: settings?.geofence_lng ?? 121.11928280273479,
    holiday_mode: settings?.holiday_mode ?? "allow",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) setForm({
      canteen_status: settings.canteen_status,
      clinic_status: settings.clinic_status,
      late_threshold_day: settings.late_threshold_day,
      late_threshold_night: settings.late_threshold_night,
      geofence_radius_m: settings.geofence_radius_m,
      geofence_lat: settings.geofence_lat,
      geofence_lng: settings.geofence_lng,
      holiday_mode: settings.holiday_mode ?? "allow",
    });
  }, [settings]);

  const save = async () => {
    setSaving(true);
    const payload = { ...form, updated_at: new Date().toISOString() };
    const { error } = settings
      ? await supabase.from("kiosk_settings").update(payload).eq("id", settings.id)
      : await supabase.from("kiosk_settings").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Settings saved.");
    onSaved();
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="rounded-2xl bg-card border border-border shadow-soft p-6 space-y-4">
        <h3 className="font-bold flex items-center gap-2"><SettingsIcon className="h-4 w-4 text-primary" /> Operational Status</h3>
        <div className="space-y-3">
          <StatusRow icon={<Coffee className="h-4 w-4" />} label="Canteen"
            value={form.canteen_status as any} onChange={v => setForm({ ...form, canteen_status: v })} />
          <StatusRow icon={<Stethoscope className="h-4 w-4" />} label="Clinic"
            value={form.clinic_status as any} onChange={v => setForm({ ...form, clinic_status: v })} />
        </div>
      </div>

      <div className="rounded-2xl bg-card border border-border shadow-soft p-6 space-y-4">
        <h3 className="font-bold">Late Policy (PH 24h)</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Day shift threshold</Label>
            <Input type="time" value={form.late_threshold_day as string} onChange={e => setForm({ ...form, late_threshold_day: e.target.value })} className="rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label>Night shift threshold</Label>
            <Input type="time" value={form.late_threshold_night as string} onChange={e => setForm({ ...form, late_threshold_night: e.target.value })} className="rounded-xl" />
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-card border border-border shadow-soft p-6 space-y-4">
        <h3 className="font-bold">Holiday Behavior</h3>
        <div className="space-y-1.5">
          <Label>On Philippine Holidays</Label>
          <Select value={form.holiday_mode as string} onValueChange={(v) => setForm({ ...form, holiday_mode: v as any })}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="allow">Allow Time In/Out</SelectItem>
              <SelectItem value="disable">Disable kiosk</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-2xl bg-card border border-border shadow-soft p-6 space-y-4">
        <h3 className="font-bold">Geofence (validation only — UI hidden on kiosk)</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5"><Label>Latitude</Label><Input type="number" step="any" value={form.geofence_lat ?? 0} onChange={e => setForm({ ...form, geofence_lat: parseFloat(e.target.value) })} className="rounded-xl" /></div>
          <div className="space-y-1.5"><Label>Longitude</Label><Input type="number" step="any" value={form.geofence_lng ?? 0} onChange={e => setForm({ ...form, geofence_lng: parseFloat(e.target.value) })} className="rounded-xl" /></div>
          <div className="space-y-1.5"><Label>Radius (m)</Label><Input type="number" value={form.geofence_radius_m ?? 100} onChange={e => setForm({ ...form, geofence_radius_m: parseInt(e.target.value || "0") })} className="rounded-xl" /></div>
        </div>
      </div>

      <div className="md:col-span-2">
        <Button onClick={save} disabled={saving} className="rounded-xl gradient-primary text-primary-foreground hover:opacity-90 shadow-soft">{saving ? "Saving…" : "Save Settings"}</Button>
      </div>
    </div>
  );
}

function VisitorsTable({ rows }: { rows: any[] }) {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-soft overflow-x-auto">
      <table className="w-full text-sm min-w-[700px]">
        <thead className="bg-muted/50 text-left">
          <tr>
            <th className="p-4">Time In</th><th className="p-4">Name</th><th className="p-4">Company</th>
            <th className="p-4">Purpose</th><th className="p-4">Person to Visit</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No visitors logged.</td></tr>}
          {rows.map(v => (
            <tr key={v.id} className="border-t border-border hover:bg-muted/30">
              <td className="p-4 font-mono text-xs">{formatPH(v.time_in, { dateStyle: "short", timeStyle: "short" } as any)}</td>
              <td className="p-4 font-medium">{v.full_name}</td>
              <td className="p-4">{v.company ?? "—"}</td>
              <td className="p-4">{v.purpose ?? "—"}</td>
              <td className="p-4">{v.person_to_visit ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClinicTable({ rows, onChanged }: { rows: any[]; onChanged: () => void }) {
  const update = async (id: string, status: string) => {
    const { error } = await supabase.from("clinic_requests").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Updated"); onChanged();
  };
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-soft overflow-x-auto">
      <table className="w-full text-sm min-w-[700px]">
        <thead className="bg-muted/50 text-left">
          <tr>
            <th className="p-4">Requested</th><th className="p-4">Employee</th><th className="p-4">Medicine</th>
            <th className="p-4">Pickup</th><th className="p-4">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No requests.</td></tr>}
          {rows.map(r => (
            <tr key={r.id} className="border-t border-border hover:bg-muted/30">
              <td className="p-4 text-xs">{format(new Date(r.created_at), "PPp")}</td>
              <td className="p-4 font-medium">{r.employee_name}</td>
              <td className="p-4">{r.medicine}</td>
              <td className="p-4">{r.pickup_time ? format(new Date(r.pickup_time), "PPp") : "—"}</td>
              <td className="p-4">
                <Select value={r.status} onValueChange={(v) => update(r.id, v)}>
                  <SelectTrigger className="rounded-xl w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="follow_up">To Follow Up</SelectItem>
                  </SelectContent>
                </Select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HolidaysPanel({ rows, onChanged }: { rows: any[]; onChanged: () => void }) {
  const [form, setForm] = useState({ name: "", date: "" });
  const add = async () => {
    if (!form.name || !form.date) { toast.error("Name and date required"); return; }
    const { error } = await supabase.from("holidays").insert({ name: form.name, date: form.date, active: true });
    if (error) return toast.error(error.message);
    toast.success("Holiday added"); setForm({ name: "", date: "" }); onChanged();
  };
  const toggle = async (id: string, active: boolean) => {
    await supabase.from("holidays").update({ active }).eq("id", id); onChanged();
  };
  const remove = async (id: string) => {
    await supabase.from("holidays").delete().eq("id", id); onChanged();
  };
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-card border border-border shadow-soft p-5 space-y-3">
        <h3 className="font-bold">Add Holiday</h3>
        <div className="grid sm:grid-cols-3 gap-3">
          <Input placeholder="Holiday name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="rounded-xl" />
          <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="rounded-xl" />
          <Button onClick={add} className="rounded-xl gradient-primary text-primary-foreground"><Plus className="h-4 w-4 mr-2" />Add</Button>
        </div>
        <p className="text-xs text-muted-foreground">Built-in fixed PH Regular Holidays are auto-detected; add movable holidays (e.g. Eid'l Fitr, Maundy Thursday) here.</p>
      </div>
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-soft">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left"><tr><th className="p-4">Date</th><th className="p-4">Name</th><th className="p-4">Active</th><th className="p-4"></th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No custom holidays.</td></tr>}
            {rows.map(h => (
              <tr key={h.id} className="border-t border-border">
                <td className="p-4 font-mono">{h.date}</td>
                <td className="p-4 font-medium">{h.name}</td>
                <td className="p-4"><Switch checked={h.active} onCheckedChange={(v) => toggle(h.id, v)} /></td>
                <td className="p-4 text-right"><Button size="icon" variant="ghost" onClick={() => remove(h.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


function StatusRow({ icon, label, value, onChange }: { icon: React.ReactNode; label: string; value: "open"|"closed"|"holiday"; onChange: (v: "open"|"closed"|"holiday") => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm font-medium"><span className="text-primary">{icon}</span>{label}</div>
      <Select value={value} onValueChange={(v) => onChange(v as any)}>
        <SelectTrigger className="rounded-xl w-40"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="open">Open</SelectItem>
          <SelectItem value="closed">Closed</SelectItem>
          <SelectItem value="holiday">Holiday</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
