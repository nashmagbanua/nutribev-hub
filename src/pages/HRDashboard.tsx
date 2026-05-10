import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  supabase, formatPH, uploadImage, lastNameOf,
  DEFAULT_AREA_CODES, SYSTEM_ROLES, JOB_POSITIONS,
  type SystemRole, type JobPosition,
  type Profile, type AttendanceRow, type Announcement,
  type KioskSettings, type AreaCode, type Message,
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
import {
  Search, UserPlus, Users, CalendarCheck, Megaphone, Trash2, Plus,
  Settings as SettingsIcon, Coffee, Stethoscope, Pencil, MapPin,
  Inbox as InboxIcon, Send, CheckCircle2, ImageIcon, TrendingUp,
  Download, Clock, AlertTriangle, LogIn, LogOut,
} from "lucide-react";
import { subDays, startOfDay } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

// ─── helpers ──────────────────────────────────────────────────────────────────

function phToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

function phDateKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
}

function exportCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const csv = [headers, ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = filename;
  a.click();
}

// ─── main component ────────────────────────────────────────────────────────────

export default function HRDashboard() {
  const { profile } = useAuth();
  const [profiles, setProfiles]           = useState<Profile[]>([]);
  const [attendance, setAttendance]       = useState<AttendanceRow[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [settings, setSettings]           = useState<KioskSettings | null>(null);
  const [visitors, setVisitors]           = useState<any[]>([]);
  const [clinicReqs, setClinicReqs]       = useState<any[]>([]);
  const [holidays, setHolidays]           = useState<any[]>([]);
  const [areaCodes, setAreaCodes]         = useState<AreaCode[]>([]);
  const [messages, setMessages]           = useState<Message[]>([]);
  const [search, setSearch]               = useState("");
  const [dateFilter, setDateFilter]       = useState<string>(phToday);
  const [employeeFilter, setEmployeeFilter] = useState("");
  const didGreet                          = useRef(false);

  const loadAll = async () => {
    const [p, a, ann, s, v, c, h, ac, m] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, company_id, full_name, dob, role, system_role, avatar_url, is_approved, email, position, job_position, department, area_code")
        .order("created_at", { ascending: false }),
      supabase.from("attendance").select("*").order("timestamp", { ascending: false }).limit(2000),
      supabase.from("announcements").select("*").order("created_at", { ascending: false }),
      supabase.from("kiosk_settings").select("*").limit(1).maybeSingle(),
      supabase.from("visitors").select("*").order("time_in", { ascending: false }).limit(200),
      supabase.from("clinic_requests").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("holidays").select("*").order("date", { ascending: true }),
      supabase.from("area_codes").select("*").order("code"),
      profile
        ? supabase
            .from("messages")
            .select("*")
            .or(`to_company_id.eq.${profile.company_id},from_company_id.eq.${profile.company_id}`)
            .order("created_at", { ascending: false })
            .limit(200)
        : Promise.resolve({ data: [] }),
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

  // ── Welcome toast — once per session after data loads ───────────────────────
  useEffect(() => {
    if (!profile || didGreet.current || profiles.length === 0) return;
    didGreet.current = true;
    const sessionKey = `greeted_${profile.company_id}`;
    if (sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, "1");

    const unread  = messages.filter(m => m.to_company_id === profile.company_id && !m.read).length;
    const pending = profiles.filter(p => !p.is_approved).length;
    const parts: string[] = [];
    if (unread  > 0) parts.push(`${unread} unread message${unread   > 1 ? "s" : ""}`);
    if (pending > 0) parts.push(`${pending} pending approval${pending > 1 ? "s" : ""}`);

    toast.success(`Welcome back, ${profile.full_name.split(" ")[0]}! 👋`, {
      description: parts.length ? parts.join(" · ") : "Everything looks good.",
      duration: 5000,
    });
  }, [profile, profiles, messages]);

  // ── Derived ──────────────────────────────────────────────────────────────────

  const areaMap = useMemo(() => {
    const m: Record<string, string> = {};
    areaCodes.forEach(a => { m[a.code] = a.name; });
    return m;
  }, [areaCodes]);

  const filteredEmployees = useMemo(() =>
    profiles.filter(p => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        p.company_id?.toLowerCase().includes(q) ||
        p.full_name?.toLowerCase().includes(q)  ||
        (p.position ?? "").toLowerCase().includes(q) ||
        (areaMap[p.area_code ?? ""] ?? "").toLowerCase().includes(q)
      );
    }),
  [profiles, search, areaMap]);

  const pendingCount = useMemo(() => profiles.filter(p => !p.is_approved).length, [profiles]);
  const unreadCount  = useMemo(
    () => messages.filter(m => m.to_company_id === profile?.company_id && !m.read).length,
    [messages, profile]
  );

  const filteredAttendance = useMemo(() => attendance.filter(r => {
    const key = phDateKey(new Date(r.timestamp));
    if (dateFilter && key !== dateFilter) return false;
    if (employeeFilter) {
      const q    = employeeFilter.toLowerCase();
      const name = profiles.find(p => p.company_id === r.company_id)?.full_name ?? "";
      if (!r.company_id.toLowerCase().includes(q) && !name.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [attendance, dateFilter, employeeFilter, profiles]);

  // Analytics
  const chartData = useMemo(() =>
    Array.from({ length: 7 }).map((_, i) => {
      const d   = startOfDay(subDays(new Date(), 6 - i));
      const key = phDateKey(d);
      const present = new Set(
        attendance
          .filter(r => phDateKey(new Date(r.timestamp)) === key && r.type === "time_in")
          .map(r => r.company_id)
      ).size;
      return {
        day: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d),
        present,
      };
    }),
  [attendance]);

  const todayKey     = phToday();
  const presentToday = useMemo(() =>
    new Set(attendance.filter(r => phDateKey(new Date(r.timestamp)) === todayKey && r.type === "time_in").map(r => r.company_id)).size,
  [attendance, todayKey]);

  const insideNow = useMemo(() => {
    const latest = new Map<string, AttendanceRow>();
    attendance.forEach(r => { if (!latest.has(r.company_id)) latest.set(r.company_id, r); });
    let n = 0;
    latest.forEach(r => { if (r.type === "time_in") n++; });
    return n;
  }, [attendance]);

  const totalApproved = profiles.filter(p => p.is_approved).length;
  const rate          = totalApproved ? Math.round((presentToday / totalApproved) * 100) : 0;

  const lateToday = useMemo(() => {
    const lateDay   = settings?.late_threshold_day   ?? "06:05";
    const lateNight = settings?.late_threshold_night ?? "18:05";
    return attendance.filter(r => {
      if (r.type !== "time_in") return false;
      if (phDateKey(new Date(r.timestamp)) !== todayKey) return false;
      const t = formatPH(r.timestamp, { hour: "2-digit", minute: "2-digit", hour12: false });
      return t > (r.shift === "night" ? lateNight : lateDay);
    }).length;
  }, [attendance, todayKey, settings]);

  const toggleApproval = async (p: Profile) => {
    const next = !p.is_approved;
    const { error } = await supabase.from("profiles").update({ is_approved: next }).eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success(`${p.full_name} ${next ? "approved ✓" : "approval revoked"}`);
    setProfiles(profiles.map(x => x.id === p.id ? { ...x, is_approved: next } : x));
  };

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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Kpi label="Total Employees"  value={totalApproved} icon={<Users         className="h-5 w-5" />} color="from-primary to-primary/80" />
          <Kpi label="Present Today"    value={presentToday}  icon={<CalendarCheck className="h-5 w-5" />} color="from-emerald-500 to-emerald-600" />
          <Kpi label="Inside Now"       value={insideNow}     icon={<LogIn         className="h-5 w-5" />} color="from-sky-500 to-sky-600" />
          <Kpi label="Attendance Rate"  value={`${rate}%`}    icon={<TrendingUp    className="h-5 w-5" />} color="from-violet-500 to-violet-600" />
        </div>

        <Tabs defaultValue="employees" className="space-y-4">
          <TabsList className="rounded-2xl flex-wrap h-auto gap-1">

            {/* Employees tab — pending badge */}
            <TabsTrigger value="employees" className="rounded-xl relative">
              Employees
              {pendingCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center leading-none">
                  {pendingCount > 9 ? "9+" : pendingCount}
                </span>
              )}
            </TabsTrigger>

            <TabsTrigger value="attendance"    className="rounded-xl">Attendance</TabsTrigger>
            <TabsTrigger value="analytics"     className="rounded-xl">Analytics</TabsTrigger>
            <TabsTrigger value="announcements" className="rounded-xl">Announcements</TabsTrigger>
            <TabsTrigger value="areas"         className="rounded-xl">Area Codes</TabsTrigger>

            {/* Inbox tab — unread badge */}
            <TabsTrigger value="inbox" className="rounded-xl relative">
              Inbox
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center leading-none">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </TabsTrigger>

            <TabsTrigger value="visitors"  className="rounded-xl">Visitors</TabsTrigger>
            <TabsTrigger value="clinic"    className="rounded-xl">Clinic</TabsTrigger>
            <TabsTrigger value="holidays"  className="rounded-xl">Holidays</TabsTrigger>
            <TabsTrigger value="settings"  className="rounded-xl">Settings</TabsTrigger>
          </TabsList>

          {/* ── EMPLOYEES ──────────────────────────────────────────────────── */}
          <TabsContent value="employees" className="space-y-4">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by ID, name, position, area…"
                  value={search} onChange={e => setSearch(e.target.value)}
                  className="pl-10 rounded-xl"
                />
              </div>
              <AddEmployeeDialog areaCodes={areaCodes} onAdded={loadAll} />
            </div>

            {pendingCount > 0 && (
              <div className="rounded-xl bg-warning/10 border border-warning/30 px-4 py-3 flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
                <span>
                  <strong>{pendingCount}</strong> employee{pendingCount > 1 ? "s" : ""} pending HR approval — review below.
                </span>
              </div>
            )}

            <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-soft overflow-x-auto">
              <table className="w-full text-sm min-w-[960px]">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-4">Employee</th>
                    <th className="p-4">Company ID</th>
                    <th className="p-4">Role</th>
                    <th className="p-4">Position</th>
                    <th className="p-4">Area</th>
                    <th className="p-4">DOB</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map(p => (
                    <tr key={p.id} className={`border-t border-border hover:bg-muted/30 ${!p.is_approved ? "bg-warning/5" : ""}`}>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={p.avatar_url ?? undefined} />
                            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                              {p.full_name?.split(" ").map(n => n[0]).slice(0, 2).join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium leading-snug">{p.full_name}</div>
                            {p.email && <div className="text-xs text-muted-foreground">{p.email}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 font-mono text-xs">{p.company_id}</td>
                      <td className="p-4">
                        <Badge variant="secondary" className="rounded-lg capitalize text-xs">
                          {SYSTEM_ROLES.find(r => r.value === (p.system_role ?? p.role))?.label ?? p.role}
                        </Badge>
                      </td>
                      <td className="p-4 text-muted-foreground text-xs">
                        {JOB_POSITIONS.find(r => r.value === (p.job_position ?? p.position))?.label ?? p.position ?? "—"}
                      </td>
                      <td className="p-4">
                        {p.area_code && areaMap[p.area_code]
                          ? <Badge variant="outline" className="rounded-lg text-xs">{areaMap[p.area_code]}</Badge>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="p-4 text-xs">
                        {p.dob
                          ? new Intl.DateTimeFormat("en-PH", { year: "numeric", month: "short", day: "numeric" }).format(new Date(p.dob + "T00:00:00"))
                          : "—"}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Switch checked={p.is_approved} onCheckedChange={() => toggleApproval(p)} />
                          <span className={`text-xs font-medium ${p.is_approved ? "text-emerald-600" : "text-muted-foreground"}`}>
                            {p.is_approved ? "Approved" : "Pending"}
                          </span>
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
                  {filteredEmployees.length === 0 && (
                    <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No employees found.</td></tr>
                  )}
                </tbody>
              </table>
              <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground">
                {filteredEmployees.length} of {profiles.length} employees{search && " — filtered by search"}
              </div>
            </div>
          </TabsContent>

          {/* ── ATTENDANCE ─────────────────────────────────────────────────── */}
          <TabsContent value="attendance" className="space-y-4">
            <div className="flex flex-wrap gap-3 items-center">
              <Input
                type="date" value={dateFilter}
                onChange={e => setDateFilter(e.target.value)}
                className="rounded-xl max-w-[180px]"
              />
              <div className="relative flex-1 min-w-[180px]">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Filter by ID or name"
                  value={employeeFilter} onChange={e => setEmployeeFilter(e.target.value)}
                  className="pl-10 rounded-xl max-w-[260px]"
                />
              </div>
              <Button variant="outline" onClick={() => { setDateFilter(phToday()); setEmployeeFilter(""); }} className="rounded-xl">Today</Button>
              <Button variant="outline" onClick={() => { setDateFilter(""); setEmployeeFilter(""); }} className="rounded-xl">Clear</Button>
              <Button
                variant="outline" className="rounded-xl flex items-center gap-2 ml-auto"
                disabled={filteredAttendance.length === 0}
                onClick={() => {
                  const pm: Record<string, Profile> = {};
                  profiles.forEach(p => { pm[p.company_id] = p; });
                  exportCSV(
                    `attendance-${dateFilter || "all"}.csv`,
                    ["Company ID", "Name", "Position", "Type", "Timestamp (PH)", "Shift"],
                    filteredAttendance.map(r => {
                      const p = pm[r.company_id];
                      return [
                        r.company_id,
                        p?.full_name ?? r.company_id,
                        JOB_POSITIONS.find(x => x.value === (p?.job_position ?? p?.position))?.label ?? p?.position ?? "—",
                        r.type === "time_in" ? "Time In" : "Time Out",
                        formatPH(r.timestamp, { dateStyle: "short", timeStyle: "short" } as any),
                        r.shift ?? "—",
                      ];
                    })
                  );
                }}
              >
                <Download className="h-4 w-4" /> Export CSV
              </Button>
            </div>
            <AttendanceTable attendance={filteredAttendance} profiles={profiles} settings={settings} onChanged={loadAll} />
          </TabsContent>

          {/* ── ANALYTICS ──────────────────────────────────────────────────── */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Kpi label="Present Today"   value={presentToday} icon={<CalendarCheck className="h-5 w-5" />} color="from-emerald-500 to-emerald-600" />
              <Kpi label="Inside Now"      value={insideNow}    icon={<LogIn         className="h-5 w-5" />} color="from-sky-500 to-sky-600" />
              <Kpi label="Late Today"      value={lateToday}    icon={<Clock         className="h-5 w-5" />} color="from-orange-400 to-orange-500" />
              <Kpi label="Attendance Rate" value={`${rate}%`}   icon={<TrendingUp    className="h-5 w-5" />} color="from-violet-500 to-violet-600" />
            </div>
            <div className="rounded-2xl bg-card border border-border shadow-soft p-6">
              <h3 className="font-bold mb-4">Attendance — Last 7 Days</h3>
              <div className="h-80">
                <ResponsiveContainer>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }}
                      formatter={(v: number) => [v, "Employees present"]}
                    />
                    <Bar dataKey="present" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </TabsContent>

          {/* ── ANNOUNCEMENTS ──────────────────────────────────────────────── */}
          <TabsContent value="announcements" className="space-y-4">
            <AnnouncementForm onAdded={loadAll} />
            <div className="grid md:grid-cols-2 gap-4">
              {announcements.map(a => (
                <div key={a.id} className="rounded-2xl bg-card border border-border shadow-soft p-5">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <Megaphone className="h-4 w-4 text-primary" />
                      <h4 className="font-bold">{a.title}</h4>
                    </div>
                    <Button size="icon" variant="ghost" onClick={async () => {
                      await supabase.from("announcements").delete().eq("id", a.id);
                      toast.success("Deleted"); loadAll();
                    }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                  {a.image_url && <img src={a.image_url} alt={a.title} className="rounded-xl mb-3 max-h-40 w-full object-cover" />}
                  {a.body && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{a.body}</p>}
                  <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                    <Switch checked={a.active} onCheckedChange={async v => {
                      await supabase.from("announcements").update({ active: v }).eq("id", a.id); loadAll();
                    }} />
                    <span>{a.active ? "Active" : "Hidden"}</span>
                    <span className="ml-auto">{formatPH(a.created_at, { dateStyle: "medium" } as any)}</span>
                  </div>
                </div>
              ))}
              {announcements.length === 0 && <p className="text-muted-foreground text-sm">No announcements yet.</p>}
            </div>
          </TabsContent>

          {/* ── AREA CODES ─────────────────────────────────────────────────── */}
          <TabsContent value="areas">
            <AreaCodesPanel rows={areaCodes} onChanged={loadAll} />
          </TabsContent>

          {/* ── INBOX ──────────────────────────────────────────────────────── */}
          <TabsContent value="inbox">
            <InboxPanel currentId={profile?.company_id ?? ""} messages={messages} profiles={profiles} onChanged={loadAll} />
          </TabsContent>

          {/* ── VISITORS ───────────────────────────────────────────────────── */}
          <TabsContent value="visitors">
            <VisitorsTable rows={visitors} />
          </TabsContent>

          {/* ── CLINIC ─────────────────────────────────────────────────────── */}
          <TabsContent value="clinic">
            <ClinicTable rows={clinicReqs} onChanged={loadAll} />
          </TabsContent>

          {/* ── HOLIDAYS ───────────────────────────────────────────────────── */}
          <TabsContent value="holidays">
            <HolidaysPanel rows={holidays} onChanged={loadAll} />
          </TabsContent>

          {/* ── SETTINGS ───────────────────────────────────────────────────── */}
          <TabsContent value="settings">
            <SettingsPanel settings={settings} onSaved={loadAll} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// ─── Kpi ──────────────────────────────────────────────────────────────────────

function Kpi({ label, value, icon, color }: { label: string; value: any; icon: React.ReactNode; color?: string }) {
  return (
    <div className="rounded-2xl bg-card border border-border shadow-soft p-5 flex items-center justify-between gap-3">
      <div>
        <div className="text-xs text-muted-foreground mb-1">{label}</div>
        <div className="text-3xl font-extrabold tabular-nums leading-none">{value}</div>
      </div>
      <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${color ?? "from-primary to-primary/80"} text-white flex items-center justify-center shadow-soft shrink-0`}>
        {icon}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

// ─── AddEmployeeDialog ────────────────────────────────────────────────────────

function AddEmployeeDialog({ onAdded, areaCodes }: { onAdded: () => void; areaCodes: AreaCode[] }) {
  const [open, setOpen] = useState(false);
  const blank = {
    company_id: "", full_name: "", password: "",
    system_role: "employee" as SystemRole,
    job_position: "" as JobPosition | "",
    dob: "", email: "", area_code: "",
  };
  const [form, setForm]     = useState(blank);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.company_id || !form.full_name || !form.password) {
      toast.error("Company ID, name, and password are required"); return;
    }
    if (!form.job_position) { toast.error("Please select a position"); return; }
    setSaving(true);
    const { data: existing } = await supabase.from("profiles").select("id").eq("company_id", form.company_id.trim()).maybeSingle();
    if (existing) { toast.error("That Company ID is already registered."); setSaving(false); return; }

    const legacyRole = ({"hr_admin":"HR","manager":"Manager","supervisor":"Supervisor","nurse":"Nurse","safety_officer":"Safety Officer"} as Record<string,string>)[form.system_role] ?? "Employee";
    const { error } = await supabase.from("profiles").insert({
      company_id:   form.company_id.trim(),
      full_name:    form.full_name.trim(),
      password:     form.password,
      role:         legacyRole,
      system_role:  form.system_role,
      position:     form.job_position,
      job_position: form.job_position,
      dob:          form.dob || null,
      email:        form.email.trim() || null,
      area_code:    form.area_code || null,
      is_approved:  true,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`${form.full_name} added and approved ✓`);
    setOpen(false); setForm(blank); onAdded();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-xl gradient-primary text-primary-foreground hover:opacity-90 shadow-soft">
          <UserPlus className="h-4 w-4 mr-2" />Add Employee
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl max-w-lg" aria-describedby={undefined}>
        <DialogHeader><DialogTitle>Add Employee</DialogTitle></DialogHeader>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Company ID *"><Input value={form.company_id} onChange={e => setForm({ ...form, company_id: e.target.value })} placeholder="e.g. 100001" /></Field>
          <Field label="Full Name *"><Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></Field>
          <Field label="Email"><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Date of Birth"><Input type="date" value={form.dob} onChange={e => setForm({ ...form, dob: e.target.value })} /></Field>
          <Field label="Role *">
            <Select value={form.system_role} onValueChange={v => setForm({ ...form, system_role: v as SystemRole })}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select role" /></SelectTrigger>
              <SelectContent>{SYSTEM_ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Position *">
            <Select value={form.job_position} onValueChange={v => setForm({ ...form, job_position: v as JobPosition })}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select position" /></SelectTrigger>
              <SelectContent>{JOB_POSITIONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Area">
            <Select value={form.area_code} onValueChange={v => setForm({ ...form, area_code: v })}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select area" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— None —</SelectItem>
                {areaCodes.map(a => <SelectItem key={a.id} value={a.code}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Password *"><Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></Field>
        </div>
        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl">Cancel</Button>
          <Button onClick={submit} disabled={saving} className="rounded-xl gradient-primary text-primary-foreground">
            {saving ? "Saving…" : "Add & Approve"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── EditEmployeeDialog ───────────────────────────────────────────────────────

function EditEmployeeDialog({ employee, areaCodes, onSaved }: { employee: Profile; areaCodes: AreaCode[]; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    full_name:    employee.full_name,
    system_role:  (employee.system_role ?? "employee") as SystemRole,
    job_position: (employee.job_position ?? employee.position ?? "") as JobPosition | "",
    area_code:    employee.area_code ?? "",
    dob:          employee.dob ?? "",
    email:        employee.email ?? "",
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.full_name.trim()) { toast.error("Full name is required"); return; }
    setSaving(true);
    const legacyRole = ({"hr_admin":"HR","manager":"Manager","supervisor":"Supervisor","nurse":"Nurse","safety_officer":"Safety Officer"} as Record<string,string>)[form.system_role] ?? "Employee";
    const { error } = await supabase.from("profiles").update({
      full_name:    form.full_name.trim(),
      role:         legacyRole,
      system_role:  form.system_role,
      position:     form.job_position || null,
      job_position: form.job_position || null,
      area_code:    form.area_code || null,
      dob:          form.dob || null,
      email:        form.email.trim() || null,
    }).eq("id", employee.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Employee updated ✓"); setOpen(false); onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" title="Edit employee"><Pencil className="h-4 w-4" /></Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl max-w-lg" aria-describedby={undefined}>
        <DialogHeader><DialogTitle>Edit — {employee.full_name}</DialogTitle></DialogHeader>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Field label="Full Name *"><Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></Field>
          </div>
          <Field label="Email"><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Date of Birth"><Input type="date" value={form.dob} onChange={e => setForm({ ...form, dob: e.target.value })} /></Field>
          <Field label="Role *">
            <Select value={form.system_role} onValueChange={v => setForm({ ...form, system_role: v as SystemRole })}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>{SYSTEM_ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Position *">
            <Select value={form.job_position} onValueChange={v => setForm({ ...form, job_position: v as JobPosition })}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select position" /></SelectTrigger>
              <SelectContent>{JOB_POSITIONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Area">
              <Select value={form.area_code || "__none__"} onValueChange={v => setForm({ ...form, area_code: v === "__none__" ? "" : v })}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select area" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— None —</SelectItem>
                  {areaCodes.map(a => <SelectItem key={a.id} value={a.code}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </div>
        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl">Cancel</Button>
          <Button onClick={submit} disabled={saving} className="rounded-xl gradient-primary text-primary-foreground">
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── AnnouncementForm ─────────────────────────────────────────────────────────

function AnnouncementForm({ onAdded }: { onAdded: () => void }) {
  const [form, setForm]     = useState({ title: "", body: "" });
  const [file, setFile]     = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    setSaving(true);
    try {
      let image_url: string | null = null;
      if (file) {
        if (file.size > 2 * 1024 * 1024) toast.info("Large file — compressing…");
        image_url = await uploadImage("uploads", `announcements/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`, file);
      }
      const { error } = await supabase.from("announcements").insert({ ...form, image_url, active: true });
      if (error) throw error;
      toast.success("Announcement published ✓");
      setForm({ title: "", body: "" }); setFile(null); onAdded();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to publish");
    } finally { setSaving(false); }
  };

  return (
    <div className="rounded-2xl bg-card border border-border shadow-soft p-5 space-y-3">
      <h3 className="font-bold flex items-center gap-2"><Megaphone className="h-4 w-4 text-primary" /> New Announcement</h3>
      <div className="grid md:grid-cols-2 gap-3">
        <Input placeholder="Title *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="rounded-xl" />
        <Input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setFile(e.target.files?.[0] ?? null)} className="rounded-xl" />
      </div>
      <Textarea placeholder="Body (optional)" value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} className="rounded-xl" rows={3} />
      {file && <p className="text-xs text-muted-foreground flex items-center gap-2"><ImageIcon className="h-3 w-3" />{file.name} — will be auto-compressed.</p>}
      <Button onClick={submit} disabled={saving} className="rounded-xl gradient-primary text-primary-foreground">
        <Plus className="h-4 w-4 mr-2" />{saving ? "Publishing…" : "Publish"}
      </Button>
    </div>
  );
}

// ─── AttendanceTable ──────────────────────────────────────────────────────────

function AttendanceTable({ attendance, profiles, settings, onChanged }: {
  attendance: AttendanceRow[]; profiles: Profile[]; settings: KioskSettings | null; onChanged: () => void;
}) {
  const profileMap = useMemo(() => {
    const m: Record<string, Profile> = {};
    profiles.forEach(p => { m[p.company_id] = p; });
    return m;
  }, [profiles]);

  // Group into day-pairs; night shift time_out before 08:00 belongs to previous date
  const grouped = useMemo(() => {
    const map: Record<string, { date: string; companyId: string; in?: AttendanceRow; out?: AttendanceRow }> = {};
    attendance.forEach(r => {
      const ts     = new Date(r.timestamp);
      const phHour = parseInt(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", hour: "numeric", hour12: false }).format(ts));
      let displayDate = phDateKey(ts);
      if (r.type === "time_out" && phHour < 8) {
        const prev = new Date(ts);
        prev.setDate(prev.getDate() - 1);
        displayDate = phDateKey(prev);
      }
      const key = `${r.company_id}|${displayDate}`;
      map[key] = map[key] ?? { date: displayDate, companyId: r.company_id };
      if (r.type === "time_in") {
        if (!map[key].in  || r.timestamp < map[key].in!.timestamp)  map[key].in  = r;
      } else {
        if (!map[key].out || r.timestamp > map[key].out!.timestamp) map[key].out = r;
      }
    });
    return Object.values(map).sort((a, b) => (b.date + b.companyId).localeCompare(a.date + a.companyId));
  }, [attendance]);

  const lateDay   = settings?.late_threshold_day   ?? "06:05";
  const lateNight = settings?.late_threshold_night ?? "18:05";

  const isLate = (row: AttendanceRow): boolean => {
    const t = formatPH(row.timestamp, { hour: "2-digit", minute: "2-digit", hour12: false });
    return t > (row.shift === "night" ? lateNight : lateDay);
  };

  const computeOT = (g: { in?: AttendanceRow; out?: AttendanceRow }): string => {
    if (!g.in || !g.out) return "—";
    const inDate  = new Date(g.in.timestamp);
    const outDate = new Date(g.out.timestamp);
    const endPH   = new Date(inDate);
    if (g.in.shift === "day") {
      endPH.setUTCHours(18 - 8, 0, 0, 0);
      if (parseInt(formatPH(inDate, { hour: "2-digit", hour12: false })) >= 18) endPH.setUTCDate(endPH.getUTCDate() + 1);
    } else {
      endPH.setUTCHours(6 - 8, 0, 0, 0);
      endPH.setUTCDate(endPH.getUTCDate() + 1);
    }
    const diffMin = Math.round((outDate.getTime() - endPH.getTime()) / 60000);
    if (diffMin <= 0) return "—";
    return `${Math.floor(diffMin / 60)}h ${diffMin % 60}m`;
  };

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-soft overflow-x-auto">
      <table className="w-full text-sm min-w-[820px]">
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
            <th className="p-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {grouped.length === 0 && (
            <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">No attendance records.</td></tr>
          )}
          {grouped.map(g => {
            const p        = profileMap[g.companyId];
            const late     = g.in ? isLate(g.in) : false;
            const posLabel = JOB_POSITIONS.find(r => r.value === (p?.job_position ?? p?.position))?.label ?? p?.position ?? "—";
            return (
              <tr key={`${g.companyId}-${g.date}`} className="border-t border-border hover:bg-muted/30">
                <td className="p-4 font-mono text-xs">{g.date}</td>
                <td className="p-4">
                  <div className="font-medium leading-snug">{p?.full_name ?? g.companyId}</div>
                  <div className="text-xs text-muted-foreground font-mono">{g.companyId}</div>
                </td>
                <td className="p-4 text-muted-foreground text-xs">{posLabel}</td>
                <td className="p-4 font-mono text-xs">
                  {g.in ? formatPH(g.in.timestamp, { hour: "2-digit", minute: "2-digit", hour12: true }) : "—"}
                </td>
                <td className="p-4 font-mono text-xs">
                  {g.out
                    ? formatPH(g.out.timestamp, { hour: "2-digit", minute: "2-digit", hour12: true })
                    : <span className="text-emerald-500 font-medium text-xs">Inside</span>}
                </td>
                <td className="p-4">
                  {g.in?.shift
                    ? <Badge variant="secondary" className="rounded-lg capitalize text-xs">{g.in.shift}</Badge>
                    : "—"}
                </td>
                <td className="p-4">
                  {late
                    ? <Badge className="rounded-lg bg-warning/20 text-foreground border border-warning/40 text-xs">Late</Badge>
                    : g.in
                      ? <Badge className="rounded-lg bg-emerald-500/15 text-emerald-600 text-xs">On time</Badge>
                      : "—"}
                </td>
                <td className="p-4 font-mono text-xs">{computeOT(g)}</td>
                <td className="p-4 text-right">
                  <div className="inline-flex gap-1">
                    {g.in  && <EditAttendanceDialog row={g.in}  label="In"  onSaved={onChanged} />}
                    {g.out && <EditAttendanceDialog row={g.out} label="Out" onSaved={onChanged} />}
                    <Button size="icon" variant="ghost" title="Delete record" onClick={async () => {
                      if (!confirm("Delete this attendance record (both in/out)?")) return;
                      const ids = [g.in?.id, g.out?.id].filter(Boolean) as string[];
                      const { error } = await supabase.from("attendance").delete().in("id", ids);
                      if (error) return toast.error(error.message);
                      toast.success("Deleted"); onChanged();
                    }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {grouped.length > 0 && (
        <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground">
          {grouped.length} record{grouped.length !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}

// ─── EditAttendanceDialog — labelled icons, no duplicate pencils ──────────────

function EditAttendanceDialog({ row, label, onSaved }: { row: AttendanceRow; label: "In" | "Out"; onSaved: () => void }) {
  const [open, setOpen]     = useState(false);
  const toLocal = (iso: string) => {
    const d   = new Date(iso);
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const [val, setVal]       = useState(toLocal(row.timestamp));
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    const { error } = await supabase.from("attendance").update({ timestamp: new Date(val).toISOString() }).eq("id", row.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`Time ${label} updated ✓`); setOpen(false); onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" title={`Edit Time ${label}`}>
          {label === "In"
            ? <LogIn  className="h-4 w-4 text-emerald-500" />
            : <LogOut className="h-4 w-4 text-muted-foreground" />}
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl max-w-sm" aria-describedby={undefined}>
        <DialogHeader><DialogTitle>Edit Time {label}</DialogTitle></DialogHeader>
        <Field label="Timestamp (local time)">
          <Input type="datetime-local" value={val} onChange={e => setVal(e.target.value)} className="rounded-xl" />
        </Field>
        <DialogFooter>
          <Button variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving} className="rounded-xl gradient-primary text-primary-foreground">
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── InboxPanel ───────────────────────────────────────────────────────────────

function InboxPanel({ currentId, messages, profiles, onChanged }: {
  currentId: string; messages: Message[]; profiles: Profile[]; onChanged: () => void;
}) {
  const [reply, setReply] = useState<Record<string, string>>({});
  const incoming = messages.filter(m => m.to_company_id === currentId);
  const nameOf   = (cid: string) => profiles.find(p => p.company_id === cid)?.full_name ?? cid;

  const send = async (toId: string) => {
    const body = (reply[toId] ?? "").trim();
    if (!body) return;
    const { error } = await supabase.from("messages").insert({ from_company_id: currentId, to_company_id: toId, body });
    if (error) return toast.error(error.message);
    setReply({ ...reply, [toId]: "" });
    toast.success("Reply sent ✓"); onChanged();
  };

  const markRead = async (id: string) => {
    await supabase.from("messages").update({ read: true }).eq("id", id); onChanged();
  };
  const remove = async (id: string) => {
    await supabase.from("messages").delete().eq("id", id);
    toast.success("Deleted"); onChanged();
  };

  return (
    <div className="space-y-3">
      <h3 className="font-bold flex items-center gap-2">
        <InboxIcon className="h-4 w-4 text-primary" />
        Inbox
        {incoming.filter(m => !m.read).length > 0 && (
          <Badge className="rounded-full bg-destructive text-destructive-foreground text-xs px-2">
            {incoming.filter(m => !m.read).length} unread
          </Badge>
        )}
      </h3>
      {incoming.length === 0 && <p className="text-muted-foreground text-sm">No messages.</p>}
      {incoming.map(m => (
        <div key={m.id} className={`rounded-2xl border bg-card shadow-soft p-4 ${!m.read ? "border-primary/40 bg-primary/5" : "border-border"}`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-semibold">
                {nameOf(m.from_company_id)}
                <span className="text-xs text-muted-foreground font-mono ml-1">({m.from_company_id})</span>
                {!m.read && <Badge className="ml-2 rounded-full text-[10px] px-2 py-0 bg-primary text-primary-foreground">New</Badge>}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {formatPH(m.created_at, { dateStyle: "medium", timeStyle: "short" } as any)}
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              {!m.read && (
                <Button size="sm" variant="ghost" className="rounded-lg text-xs h-7" onClick={() => markRead(m.id)}>
                  Mark read
                </Button>
              )}
              <Button size="icon" variant="ghost" onClick={() => remove(m.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
          <p className="mt-2 text-sm whitespace-pre-wrap">{m.body}</p>
          <div className="mt-3 flex gap-2">
            <Input
              placeholder="Reply… (Enter to send)"
              value={reply[m.from_company_id] ?? ""}
              onChange={e => setReply({ ...reply, [m.from_company_id]: e.target.value })}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(m.from_company_id); } }}
              className="rounded-xl"
            />
            <Button onClick={() => send(m.from_company_id)} className="rounded-xl gradient-primary text-primary-foreground">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── VisitorsTable ────────────────────────────────────────────────────────────

function VisitorsTable({ rows }: { rows: any[] }) {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-soft overflow-x-auto">
      <table className="w-full text-sm min-w-[700px]">
        <thead className="bg-muted/50 text-left">
          <tr>
            <th className="p-4">Time In</th>
            <th className="p-4">Name</th>
            <th className="p-4">Company</th>
            <th className="p-4">Purpose</th>
            <th className="p-4">Person to Visit</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No visitors logged.</td></tr>}
          {rows.map(v => (
            <tr key={v.id} className="border-t border-border hover:bg-muted/30">
              <td className="p-4 font-mono text-xs">{formatPH(v.time_in, { dateStyle: "short", timeStyle: "short" } as any)}</td>
              <td className="p-4 font-medium">{v.full_name}</td>
              <td className="p-4 text-muted-foreground">{v.company ?? "—"}</td>
              <td className="p-4 text-muted-foreground">{v.purpose ?? "—"}</td>
              <td className="p-4 text-muted-foreground">{v.person_to_visit ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── ClinicTable ──────────────────────────────────────────────────────────────

function ClinicTable({ rows, onChanged }: { rows: any[]; onChanged: () => void }) {
  const update = async (id: string, patch: any) => {
    const { error } = await supabase.from("clinic_requests").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Updated ✓"); onChanged();
  };

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-soft overflow-x-auto">
      <table className="w-full text-sm min-w-[1000px]">
        <thead className="bg-muted/50 text-left">
          <tr>
            <th className="p-4">Requested</th>
            <th className="p-4">Employee</th>
            <th className="p-4">Medicine</th>
            <th className="p-4">Symptoms / Reason</th>
            <th className="p-4">Pickup</th>
            <th className="p-4">Status</th>
            <th className="p-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No requests.</td></tr>}
          {rows.map(r => (
            <tr key={r.id} className="border-t border-border hover:bg-muted/30">
              <td className="p-4 font-mono text-xs">{formatPH(r.created_at, { dateStyle: "short", timeStyle: "short" } as any)}</td>
              <td className="p-4 font-medium">{r.employee_name}<div className="text-xs text-muted-foreground font-mono">{r.company_id}</div></td>
              <td className="p-4 font-medium">{r.medicine}</td>
              <td className="p-4 text-sm max-w-[200px]">
                {r.symptoms
                  ? <span className="text-foreground/90">{r.symptoms}</span>
                  : <span className="text-muted-foreground">—</span>}
                {r.notes && <div className="text-xs text-muted-foreground mt-0.5 italic">{r.notes}</div>}
              </td>
              <td className="p-4 font-mono text-xs">{r.pickup_time ? formatPH(r.pickup_time, { dateStyle: "short", timeStyle: "short" } as any) : "—"}</td>
              <td className="p-4">
                <Select value={r.status} onValueChange={v => update(r.id, { status: v, picked_up_at: v === "picked_up" ? new Date().toISOString() : r.picked_up_at })}>
                  <SelectTrigger className="rounded-xl w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="follow_up">To Follow Up</SelectItem>
                    <SelectItem value="picked_up">Picked Up</SelectItem>
                  </SelectContent>
                </Select>
              </td>
              <td className="p-4 text-right">
                <Button size="sm" variant="outline" className="rounded-xl" onClick={() => update(r.id, { status: "picked_up", picked_up_at: new Date().toISOString() })}>
                  <CheckCircle2 className="h-4 w-4 mr-1" />Picked Up
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── AreaCodesPanel ───────────────────────────────────────────────────────────

function AreaCodesPanel({ rows, onChanged }: { rows: AreaCode[]; onChanged: () => void }) {
  const [form, setForm] = useState({ code: "", name: "" });

  const seedDefaults = async () => {
    const existing = new Set(rows.map(r => r.code));
    const toInsert = DEFAULT_AREA_CODES.filter(d => !existing.has(d.code)).map(d => ({ ...d, active: true }));
    if (toInsert.length === 0) { toast.info("All defaults already present."); return; }
    const { error } = await supabase.from("area_codes").insert(toInsert);
    if (error) return toast.error(error.message);
    toast.success(`Seeded ${toInsert.length} area code${toInsert.length > 1 ? "s" : ""} ✓`); onChanged();
  };

  const add = async () => {
    if (!form.code || !form.name) { toast.error("Code and name required"); return; }
    const { error } = await supabase.from("area_codes").insert({ code: form.code.trim(), name: form.name.trim(), active: true });
    if (error) return toast.error(error.message);
    toast.success("Area added ✓"); setForm({ code: "", name: "" }); onChanged();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-card border border-border shadow-soft p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> Area Codes</h3>
          <Button variant="outline" className="rounded-xl" onClick={seedDefaults}>Seed Defaults</Button>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <Input placeholder="Code (e.g. 1009)" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} className="rounded-xl" />
          <Input placeholder="Name (e.g. Logistics)" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="rounded-xl" />
          <Button onClick={add} className="rounded-xl gradient-primary text-primary-foreground"><Plus className="h-4 w-4 mr-2" />Add Area</Button>
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-soft">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="p-4">Code</th>
              <th className="p-4">Name</th>
              <th className="p-4">Active</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No area codes — click "Seed Defaults".</td></tr>}
            {rows.map(a => (
              <tr key={a.id} className="border-t border-border hover:bg-muted/30">
                <td className="p-4 font-mono font-bold">{a.code}</td>
                <td className="p-4 font-medium">{a.name}</td>
                <td className="p-4">
                  <Switch checked={a.active} onCheckedChange={async v => {
                    await supabase.from("area_codes").update({ active: v }).eq("id", a.id); onChanged();
                  }} />
                </td>
                <td className="p-4 text-right">
                  <Button size="icon" variant="ghost" onClick={async () => {
                    if (!confirm(`Delete area ${a.code} — ${a.name}?`)) return;
                    const { error } = await supabase.from("area_codes").delete().eq("id", a.id);
                    if (error) return toast.error(error.message);
                    toast.success("Deleted"); onChanged();
                  }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── HolidaysPanel ────────────────────────────────────────────────────────────

function HolidaysPanel({ rows, onChanged }: { rows: any[]; onChanged: () => void }) {
  const [form, setForm] = useState({ name: "", date: "" });

  const add = async () => {
    if (!form.name || !form.date) { toast.error("Name and date required"); return; }
    const { error } = await supabase.from("holidays").insert({ name: form.name, date: form.date, active: true });
    if (error) return toast.error(error.message);
    toast.success("Holiday added ✓"); setForm({ name: "", date: "" }); onChanged();
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
        <p className="text-xs text-muted-foreground">Built-in PH Regular Holidays are auto-detected. Add movable holidays (e.g. Eid'l Fitr, Maundy Thursday) here.</p>
      </div>
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-soft">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr><th className="p-4">Date</th><th className="p-4">Name</th><th className="p-4">Active</th><th className="p-4"></th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No custom holidays.</td></tr>}
            {rows.map(h => (
              <tr key={h.id} className="border-t border-border hover:bg-muted/30">
                <td className="p-4 font-mono">{h.date}</td>
                <td className="p-4 font-medium">{h.name}</td>
                <td className="p-4">
                  <Switch checked={h.active} onCheckedChange={v => supabase.from("holidays").update({ active: v }).eq("id", h.id).then(() => onChanged())} />
                </td>
                <td className="p-4 text-right">
                  <Button size="icon" variant="ghost" onClick={async () => {
                    await supabase.from("holidays").delete().eq("id", h.id); onChanged();
                  }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── SettingsPanel ────────────────────────────────────────────────────────────

function SettingsPanel({ settings, onSaved }: { settings: KioskSettings | null; onSaved: () => void }) {
  const [form, setForm] = useState<Partial<KioskSettings>>({
    canteen_status:       settings?.canteen_status       ?? "open",
    clinic_status:        settings?.clinic_status        ?? "open",
    late_threshold_day:   settings?.late_threshold_day   ?? "06:05",
    late_threshold_night: settings?.late_threshold_night ?? "18:05",
    geofence_radius_m:    settings?.geofence_radius_m    ?? 100,
    geofence_lat:         settings?.geofence_lat         ?? 14.258657284905194,
    geofence_lng:         settings?.geofence_lng         ?? 121.11928280273479,
    holiday_mode:         settings?.holiday_mode         ?? "allow",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setForm({
      canteen_status:       settings.canteen_status,
      clinic_status:        settings.clinic_status,
      late_threshold_day:   settings.late_threshold_day,
      late_threshold_night: settings.late_threshold_night,
      geofence_radius_m:    settings.geofence_radius_m,
      geofence_lat:         settings.geofence_lat,
      geofence_lng:         settings.geofence_lng,
      holiday_mode:         settings.holiday_mode ?? "allow",
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
    toast.success("Settings saved ✓"); onSaved();
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="rounded-2xl bg-card border border-border shadow-soft p-6 space-y-4">
        <h3 className="font-bold flex items-center gap-2"><SettingsIcon className="h-4 w-4 text-primary" /> Operational Status</h3>
        <div className="space-y-3">
          <StatusRow icon={<Coffee      className="h-4 w-4" />} label="Canteen" value={form.canteen_status as any} onChange={v => setForm({ ...form, canteen_status: v })} />
          <StatusRow icon={<Stethoscope className="h-4 w-4" />} label="Clinic"  value={form.clinic_status  as any} onChange={v => setForm({ ...form, clinic_status:  v })} />
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
          <Select value={form.holiday_mode as string} onValueChange={v => setForm({ ...form, holiday_mode: v as any })}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="allow">Allow Time In/Out</SelectItem>
              <SelectItem value="disable">Disable kiosk</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-2xl bg-card border border-border shadow-soft p-6 space-y-4">
        <h3 className="font-bold">Geofence</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5"><Label>Latitude</Label>
            <Input type="number" step="any" value={form.geofence_lat ?? 0} onChange={e => setForm({ ...form, geofence_lat: parseFloat(e.target.value) })} className="rounded-xl" />
          </div>
          <div className="space-y-1.5"><Label>Longitude</Label>
            <Input type="number" step="any" value={form.geofence_lng ?? 0} onChange={e => setForm({ ...form, geofence_lng: parseFloat(e.target.value) })} className="rounded-xl" />
          </div>
          <div className="space-y-1.5"><Label>Radius (m)</Label>
            <Input type="number" value={form.geofence_radius_m ?? 100} onChange={e => setForm({ ...form, geofence_radius_m: parseInt(e.target.value || "0") })} className="rounded-xl" />
          </div>
        </div>
      </div>

      <div className="md:col-span-2">
        <Button onClick={save} disabled={saving} className="rounded-xl gradient-primary text-primary-foreground hover:opacity-90 shadow-soft">
          {saving ? "Saving…" : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}

// ─── StatusRow ────────────────────────────────────────────────────────────────

function StatusRow({ icon, label, value, onChange }: {
  icon: React.ReactNode; label: string;
  value: "open" | "closed" | "holiday";
  onChange: (v: "open" | "closed" | "holiday") => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <span className="text-primary">{icon}</span>{label}
      </div>
      <Select value={value} onValueChange={v => onChange(v as any)}>
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
