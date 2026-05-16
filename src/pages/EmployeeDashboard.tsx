import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  supabase, uploadImage, formatPH, lastNameOf,
  SYSTEM_ROLES, JOB_POSITIONS, UNIFORM_FIELDS,
  type AttendanceRow, type Announcement, type Profile, type UniformSizes,
} from "@/lib/supabase";
import { AppHeader } from "@/components/AppHeader";
import { ChatMessenger } from "@/components/ChatMessenger";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import PPERequestPage from "@/pages/PPERequest";
import { PushPermissionBanner } from "@/components/PushPermissionBanner";
import {
  CalendarDays, User, MessageSquare, ShieldCheck, Home,
  Camera, KeyRound, Mail, Eye, EyeOff, ChevronLeft, ChevronRight,
  Clock, LogIn, LogOut, Megaphone, CheckCircle2, AlertCircle,
  Briefcase, IdCard, Cake, MapPin, Building2, Pencil, ArrowUpRight, Shirt,
} from "lucide-react";

// ─── PH date helpers (no date-fns timezone bugs) ──────────────────────────────

function phDateKey(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
}

function phMonthLabel(d: Date): string {
  return new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", month: "long", year: "numeric" }).format(d);
}

function phDayNum(d: Date): number {
  return parseInt(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", day: "numeric" }).format(d));
}

function phWeekday(d: Date): number {
  return parseInt(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", weekday: "short" }).format(d) === "Sun" ? "0" :
    new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", weekday: "short" }).format(d) === "Mon" ? "1" :
    new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", weekday: "short" }).format(d) === "Tue" ? "2" :
    new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", weekday: "short" }).format(d) === "Wed" ? "3" :
    new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", weekday: "short" }).format(d) === "Thu" ? "4" :
    new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", weekday: "short" }).format(d) === "Fri" ? "5" : "6");
}

function daysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) { days.push(new Date(d)); d.setDate(d.getDate() + 1); }
  return days;
}

function firstDayOfMonth(year: number, month: number): number {
  // 0=Sun using PH locale
  const d = new Date(year, month, 1);
  return new Date(d.toLocaleString("en-US", { timeZone: "Asia/Manila" })).getDay();
}

// ─── Tab config ────────────────────────────────────────────────────────────────

type Tab = "home" | "calendar" | "profile" | "messages" | "ppe";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "home",      label: "Home",     icon: <Home         className="h-5 w-5" /> },
  { id: "calendar",  label: "Calendar", icon: <CalendarDays className="h-5 w-5" /> },
  { id: "profile",   label: "Profile",  icon: <User         className="h-5 w-5" /> },
  { id: "messages",  label: "Messages", icon: <MessageSquare className="h-5 w-5" /> },
  { id: "ppe",       label: "PPE",      icon: <ShieldCheck  className="h-5 w-5" /> },
];

// ─── Main component ────────────────────────────────────────────────────────────

export default function EmployeeDashboard() {
  const { profile, refreshProfile } = useAuth();
  const [tab, setTab]               = useState<Tab>("home");
  const [rows, setRows]             = useState<AttendanceRow[]>([]);
  const [allRows, setAllRows]       = useState<AttendanceRow[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [unreadMsgs, setUnreadMsgs] = useState(0);
  const [monthCursor, setMonthCursor] = useState(() => new Date());

  const todayKey = phDateKey();

  const loadAttendance = async () => {
    if (!profile) return;
    // Load current month
    const y = monthCursor.getFullYear();
    const m = monthCursor.getMonth();
    const start = new Date(y, m, 1).toISOString();
    const end   = new Date(y, m + 1, 0, 23, 59, 59).toISOString();
    const { data } = await supabase
      .from("attendance").select("*")
      .eq("company_id", profile.company_id)
      .gte("timestamp", start).lte("timestamp", end)
      .order("timestamp", { ascending: false });
    setRows((data as AttendanceRow[]) ?? []);
  };

  const loadAll = async () => {
    if (!profile) return;
    const [att, ann, msg] = await Promise.all([
      // Last 60 days for recent list
      supabase.from("attendance").select("*")
        .eq("company_id", profile.company_id)
        .order("timestamp", { ascending: false }).limit(200),
      supabase.from("announcements").select("*").eq("active", true)
        .order("created_at", { ascending: false }).limit(10),
      supabase.from("messages").select("id, read")
        .eq("to_company_id", profile.company_id).eq("read", false),
    ]);
    setAllRows((att.data as AttendanceRow[]) ?? []);
    setAnnouncements((ann.data as Announcement[]) ?? []);
    setUnreadMsgs((msg.data ?? []).length);
  };

  useEffect(() => { loadAll(); }, [profile?.company_id]);
  useEffect(() => { loadAttendance(); }, [profile?.company_id, monthCursor]);

  // ── Today's status ─────────────────────────────────────────────────────────
  const todayStatus = useMemo(() => {
    const todayRows = allRows.filter(r => phDateKey(new Date(r.timestamp)) === todayKey);
    const timeIn  = todayRows.find(r => r.type === "time_in");
    const timeOut = todayRows.find(r => r.type === "time_out");
    return { timeIn, timeOut, isInside: !!timeIn && !timeOut };
  }, [allRows, todayKey]);

  // ── Calendar data ──────────────────────────────────────────────────────────
  const { presentKeys, absentKeys } = useMemo(() => {
    const present = new Set<string>();
    rows.forEach(r => present.add(phDateKey(new Date(r.timestamp))));

    const y = monthCursor.getFullYear();
    const m = monthCursor.getMonth();
    const days = daysInMonth(y, m);
    const absent = new Set<string>();
    const now = new Date();

    days.forEach(d => {
      const key = phDateKey(d);
      const dayOfWeek = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Manila" })).getDay();
      if (dayOfWeek === 0) return;           // skip Sunday
      if (d > now)         return;           // skip future
      if (!present.has(key)) absent.add(key);
    });
    return { presentKeys: present, absentKeys: absent };
  }, [rows, monthCursor]);

  // ── Month stats ────────────────────────────────────────────────────────────
  const monthStats = useMemo(() => ({
    present: presentKeys.size,
    absent:  absentKeys.size,
    rate:    presentKeys.size + absentKeys.size > 0
      ? Math.round((presentKeys.size / (presentKeys.size + absentKeys.size)) * 100)
      : 0,
  }), [presentKeys, absentKeys]);

  // ── Recent attendance list (grouped by date, last 7 unique days) ───────────
  const recentDays = useMemo(() => {
    const map = new Map<string, { date: string; in?: AttendanceRow; out?: AttendanceRow }>();
    allRows.forEach(r => {
      const key = phDateKey(new Date(r.timestamp));
      if (!map.has(key)) map.set(key, { date: key });
      const entry = map.get(key)!;
      if (r.type === "time_in") {
        if (!entry.in || r.timestamp < entry.in.timestamp) entry.in = r;
      } else {
        if (!entry.out || r.timestamp > entry.out.timestamp) entry.out = r;
      }
    });
    return Array.from(map.values()).slice(0, 7);
  }, [allRows]);

  if (!profile) return null;

  const initials = profile.full_name?.split(" ").map(n => n[0]).slice(0, 2).join("") ?? "?";
  const roleLabel = SYSTEM_ROLES.find(r => r.value === (profile.system_role ?? profile.role))?.label ?? profile.role ?? "Employee";
  const posLabel  = JOB_POSITIONS.find(r => r.value === (profile.job_position ?? profile.position))?.label ?? profile.position ?? "—";

  return (
    <div className="min-h-screen gradient-subtle flex flex-col pb-20 md:pb-0">
      <AppHeader />

      <main className="flex-1 container max-w-2xl py-4 md:py-8 space-y-4">

        {/* ── HOME ──────────────────────────────────────────────────────────── */}
        {tab === "home" && (
          <div className="space-y-4">
          <PushPermissionBanner companyId={profile.company_id} />
            {/* Hero greeting */}
            <div className="rounded-2xl bg-card border border-border shadow-soft p-5 flex items-center gap-4">
              <div className="relative shrink-0">
                <Avatar className="h-14 w-14 ring-2 ring-primary/20">
                  <AvatarImage src={profile.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-primary text-primary-foreground font-bold text-lg">{initials}</AvatarFallback>
                </Avatar>
              </div>
              <div className="min-w-0">
                <p className="text-muted-foreground text-xs">Good {greeting()}</p>
                <h2 className="text-xl font-extrabold leading-tight truncate">{profile.full_name}</h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge variant="secondary" className="rounded-lg text-xs">{roleLabel}</Badge>
                  <span className="text-xs text-muted-foreground">{posLabel}</span>
                </div>
              </div>
            </div>

            {/* Today's status hero */}
            <TodayCard status={todayStatus} />

            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-3">
              <MiniStat label="Present" value={monthStats.present} color="text-emerald-500" />
              <MiniStat label="Absent"  value={monthStats.absent}  color="text-destructive" />
              <MiniStat label="Rate"    value={`${monthStats.rate}%`} color="text-primary" />
            </div>

            {/* Recent attendance */}
            <div className="rounded-2xl bg-card border border-border shadow-soft p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" /> Recent Attendance
                </h3>
                <button onClick={() => setTab("calendar")} className="text-xs text-primary flex items-center gap-0.5 hover:underline">
                  View all <ArrowUpRight className="h-3 w-3" />
                </button>
              </div>
              <div className="space-y-2">
                {recentDays.length === 0 && <p className="text-muted-foreground text-sm text-center py-4">No attendance records yet.</p>}
                {recentDays.map(d => (
                  <div key={d.date} className="flex items-center justify-between rounded-xl bg-muted/40 px-4 py-3">
                    <div>
                      <div className="text-xs font-medium">{formatDateLabel(d.date)}</div>
                      <div className="flex gap-3 mt-0.5">
                        {d.in && <span className="text-xs text-emerald-500 font-mono flex items-center gap-1"><LogIn className="h-3 w-3" />{formatPH(d.in.timestamp, { hour: "2-digit", minute: "2-digit", hour12: true })}</span>}
                        {d.out && <span className="text-xs text-muted-foreground font-mono flex items-center gap-1"><LogOut className="h-3 w-3" />{formatPH(d.out.timestamp, { hour: "2-digit", minute: "2-digit", hour12: true })}</span>}
                        {d.in && !d.out && <span className="text-xs text-sky-500 font-medium">Still inside</span>}
                      </div>
                    </div>
                    <div>
                      {d.in?.shift && (
                        <Badge variant="secondary" className="rounded-lg text-xs capitalize">{d.in.shift}</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Announcements */}
            {announcements.length > 0 && (
              <div className="rounded-2xl bg-card border border-border shadow-soft p-5">
                <h3 className="font-bold flex items-center gap-2 mb-4">
                  <Megaphone className="h-4 w-4 text-primary" /> Announcements
                </h3>
                <div className="space-y-3">
                  {announcements.map(a => (
                    <div key={a.id} className="rounded-xl border border-border p-4 space-y-2">
                      {a.image_url && <img src={a.image_url} alt={a.title} className="rounded-xl w-full max-h-40 object-cover" />}
                      <div className="font-semibold">{a.title}</div>
                      {a.body && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{a.body}</p>}
                      <p className="text-xs text-muted-foreground">{formatPH(a.created_at, { dateStyle: "medium" } as any)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── CALENDAR ──────────────────────────────────────────────────────── */}
        {tab === "calendar" && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-card border border-border shadow-soft p-5">
              {/* Month nav */}
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-base">{phMonthLabel(monthCursor)}</h3>
                <div className="flex items-center gap-1">
                  <button onClick={() => setMonthCursor(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                    className="p-2 rounded-xl hover:bg-muted transition-colors"><ChevronLeft className="h-4 w-4" /></button>
                  <button onClick={() => setMonthCursor(new Date())}
                    className="px-3 py-1.5 rounded-xl hover:bg-muted text-xs font-medium transition-colors border border-border">Today</button>
                  <button onClick={() => setMonthCursor(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                    className="p-2 rounded-xl hover:bg-muted transition-colors"><ChevronRight className="h-4 w-4" /></button>
                </div>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 mb-1">
                {["S","M","T","W","T","F","S"].map((d, i) => (
                  <div key={i} className="text-center text-xs font-semibold text-muted-foreground py-1">{d}</div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstDayOfMonth(monthCursor.getFullYear(), monthCursor.getMonth()) }).map((_, i) => (
                  <div key={`pad-${i}`} />
                ))}
                {daysInMonth(monthCursor.getFullYear(), monthCursor.getMonth()).map(d => {
                  const key       = phDateKey(d);
                  const isPresent = presentKeys.has(key);
                  const isAbsent  = absentKeys.has(key);
                  const isToday   = key === todayKey;
                  return (
                    <div key={key}
                      className={`aspect-square rounded-xl flex items-center justify-center text-sm font-medium border transition-colors
                        ${isPresent ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" :
                          isAbsent  ? "bg-destructive/10 text-destructive border-destructive/20" :
                          "border-transparent text-muted-foreground"}
                        ${isToday ? "ring-2 ring-primary ring-offset-1" : ""}`}
                    >
                      {phDayNum(d)}
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex gap-4 mt-4 flex-wrap">
                <CalLegend color="bg-emerald-500/30" label="Present" />
                <CalLegend color="bg-destructive/20" label="Absent" />
                <CalLegend color="ring-2 ring-primary" label="Today" ring />
              </div>
            </div>

            {/* Month summary */}
            <div className="grid grid-cols-3 gap-3">
              <MiniStat label="Present" value={monthStats.present} color="text-emerald-500" />
              <MiniStat label="Absent"  value={monthStats.absent}  color="text-destructive" />
              <MiniStat label="Rate"    value={`${monthStats.rate}%`} color="text-primary" />
            </div>

            {/* Daily breakdown list */}
            <div className="rounded-2xl bg-card border border-border shadow-soft p-5">
              <h3 className="font-bold mb-4">Daily Breakdown</h3>
              <div className="space-y-2">
                {recentDays.filter(d => {
                  const [y, m] = d.date.split("-").map(Number);
                  return y === monthCursor.getFullYear() && m - 1 === monthCursor.getMonth();
                }).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No records this month.</p>
                )}
                {rows.reduce((acc, r) => {
                  const key = phDateKey(new Date(r.timestamp));
                  if (!acc.find((x: any) => x.date === key)) acc.push({ date: key, rows: [] });
                  acc.find((x: any) => x.date === key).rows.push(r);
                  return acc;
                }, [] as any[]).map((group: any) => {
                  const timeIn  = group.rows.filter((r: AttendanceRow) => r.type === "time_in").sort((a: AttendanceRow, b: AttendanceRow) => a.timestamp.localeCompare(b.timestamp))[0];
                  const timeOut = group.rows.filter((r: AttendanceRow) => r.type === "time_out").sort((a: AttendanceRow, b: AttendanceRow) => b.timestamp.localeCompare(a.timestamp))[0];
                  return (
                    <div key={group.date} className="flex items-center justify-between rounded-xl bg-muted/40 px-4 py-3">
                      <div>
                        <div className="text-xs font-semibold">{formatDateLabel(group.date)}</div>
                        <div className="flex gap-3 mt-0.5 flex-wrap">
                          {timeIn  && <span className="text-xs text-emerald-500 font-mono flex items-center gap-1"><LogIn  className="h-3 w-3" />{formatPH(timeIn.timestamp,  { hour: "2-digit", minute: "2-digit", hour12: true })}</span>}
                          {timeOut && <span className="text-xs text-muted-foreground font-mono flex items-center gap-1"><LogOut className="h-3 w-3" />{formatPH(timeOut.timestamp, { hour: "2-digit", minute: "2-digit", hour12: true })}</span>}
                          {timeIn && !timeOut && <span className="text-xs text-sky-500">Still inside</span>}
                        </div>
                      </div>
                      {timeIn?.shift && <Badge variant="secondary" className="rounded-lg text-xs capitalize">{timeIn.shift}</Badge>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── PROFILE ───────────────────────────────────────────────────────── */}
        {tab === "profile" && (
          <ProfileTab profile={profile} onUpdated={refreshProfile} />
        )}

        {/* ── MESSAGES ──────────────────────────────────────────────────────── */}
        {tab === "messages" && (
          <div className="rounded-2xl bg-card border border-border shadow-soft overflow-hidden">
            <ChatMessenger currentId={profile.company_id} />
          </div>
        )}

        {/* ── PPE ───────────────────────────────────────────────────────────── */}
        {tab === "ppe" && <PPERequestPage embedded />}
      </main>

      {/* ── Bottom nav (mobile) / Side-style tabs (desktop) ───────────────── */}
      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur border-t border-border">
        <div className="flex items-stretch h-16">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors relative ${
                tab === t.id ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.id === "messages" && unreadMsgs > 0 && (
                <span className="absolute top-2 right-1/2 translate-x-3 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                  {unreadMsgs > 9 ? "9+" : unreadMsgs}
                </span>
              )}
              {t.icon}
              <span className="text-[10px] font-medium leading-none">{t.label}</span>
              {tab === t.id && (
                <span className="absolute top-0 inset-x-0 h-0.5 bg-primary rounded-b-full" />
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* Desktop top tabs */}
      <div className="hidden md:block fixed top-16 left-0 right-0 z-30 bg-card/80 backdrop-blur border-b border-border">
        <div className="container max-w-2xl">
          <div className="flex gap-1 py-2">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors relative ${
                  tab === t.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {t.icon}
                {t.label}
                {t.id === "messages" && unreadMsgs > 0 && (
                  <span className="h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                    {unreadMsgs > 9 ? "9+" : unreadMsgs}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── TodayCard ────────────────────────────────────────────────────────────────

function TodayCard({ status }: {
  status: { timeIn?: AttendanceRow; timeOut?: AttendanceRow; isInside: boolean };
}) {
  const { timeIn, timeOut, isInside } = status;
  const notYet = !timeIn;

  return (
    <div className={`rounded-2xl border shadow-soft p-5 ${
      isInside ? "bg-emerald-500/10 border-emerald-500/30" :
      timeOut   ? "bg-muted/40 border-border" :
      "bg-card border-border"
    }`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold flex items-center gap-2 text-sm uppercase tracking-wide text-muted-foreground">
          <Clock className="h-4 w-4" /> Today's Status
        </h3>
        {isInside && (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            Inside
          </span>
        )}
        {timeOut && (
          <Badge variant="secondary" className="rounded-lg text-xs">Timed Out</Badge>
        )}
      </div>

      {notYet ? (
        <div className="flex items-center gap-3">
          <AlertCircle className="h-8 w-8 text-muted-foreground/40" />
          <div>
            <p className="font-semibold">Not yet timed in</p>
            <p className="text-xs text-muted-foreground">Use the kiosk to time in.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-background/60 p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <LogIn className="h-3.5 w-3.5 text-emerald-500" /> Time In
            </div>
            <div className="font-bold text-lg tabular-nums">
              {formatPH(timeIn!.timestamp, { hour: "2-digit", minute: "2-digit", hour12: true })}
            </div>
            {timeIn?.shift && (
              <Badge variant="secondary" className="rounded-lg text-xs capitalize mt-1">{timeIn.shift} shift</Badge>
            )}
          </div>
          <div className="rounded-xl bg-background/60 p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <LogOut className="h-3.5 w-3.5 text-muted-foreground" /> Time Out
            </div>
            {timeOut ? (
              <div className="font-bold text-lg tabular-nums">
                {formatPH(timeOut.timestamp, { hour: "2-digit", minute: "2-digit", hour12: true })}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground font-medium mt-1">—</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ProfileTab ────────────────────────────────────────────────────────────────

function ProfileTab({ profile, onUpdated }: { profile: Profile; onUpdated: () => void }) {
  const roleLabel = SYSTEM_ROLES.find(r => r.value === (profile.system_role ?? profile.role))?.label ?? profile.role ?? "—";
  const posLabel  = JOB_POSITIONS.find(r => r.value === (profile.job_position ?? profile.position))?.label ?? profile.position ?? "—";
  const initials  = profile.full_name?.split(" ").map(n => n[0]).slice(0, 2).join("") ?? "?";

  return (
    <div className="space-y-4">
      {/* Avatar + name */}
      <div className="rounded-2xl bg-card border border-border shadow-soft p-6 flex flex-col items-center gap-4">
        <div className="relative">
          <Avatar className="h-24 w-24 ring-4 ring-primary/20">
            <AvatarImage src={profile.avatar_url ?? undefined} />
            <AvatarFallback className="bg-primary text-primary-foreground font-extrabold text-3xl">{initials}</AvatarFallback>
          </Avatar>
          <AvatarUpload companyId={profile.company_id} onUpdated={onUpdated} />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-extrabold">{profile.full_name}</h2>
          <p className="text-muted-foreground text-sm">{roleLabel}</p>
          {!profile.is_approved && (
            <Badge className="mt-2 rounded-lg bg-warning/20 text-foreground border border-warning/40">Pending Approval</Badge>
          )}
        </div>
      </div>

      {/* Info grid */}
      <div className="rounded-2xl bg-card border border-border shadow-soft p-5 space-y-2">
        <h3 className="font-bold mb-3 flex items-center gap-2"><IdCard className="h-4 w-4 text-primary" /> My Information</h3>
        <InfoRow icon={<IdCard     className="h-4 w-4" />} label="Company ID"  value={profile.company_id} mono />
        <InfoRow icon={<Briefcase  className="h-4 w-4" />} label="Position"    value={posLabel} />
        <InfoRow icon={<Building2  className="h-4 w-4" />} label="Department"  value={profile.department ?? "—"} />
        <InfoRow icon={<MapPin     className="h-4 w-4" />} label="Area"        value={profile.area_code ?? "—"} />
        <InfoRow icon={<Cake       className="h-4 w-4" />} label="Date of Birth"
          value={profile.dob
            ? new Intl.DateTimeFormat("en-PH", { year: "numeric", month: "long", day: "numeric" }).format(new Date(profile.dob + "T00:00:00"))
            : "—"} />
        <InfoRow icon={<Mail       className="h-4 w-4" />} label="Email"       value={profile.email ?? "—"} />
        <InfoRow icon={<CheckCircle2 className="h-4 w-4" />} label="Status"
          value={profile.is_approved ? "Approved" : "Pending HR Approval"}
          valueClass={profile.is_approved ? "text-emerald-600 font-semibold" : "text-warning font-semibold"} />
      </div>

      {/* Uniform Sizes */}
      <UniformSizesCard profile={profile} onUpdated={onUpdated} />

      {/* Actions */}
      <div className="rounded-2xl bg-card border border-border shadow-soft p-5 space-y-3">
        <h3 className="font-bold mb-1 flex items-center gap-2"><Pencil className="h-4 w-4 text-primary" /> Account Settings</h3>
        <div className="flex gap-2 flex-wrap">
          <ChangePasswordDialog companyId={profile.company_id} />
          <UpdateEmailDialog companyId={profile.company_id} current={profile.email ?? ""} />
        </div>
      </div>
    </div>
  );
}

// ─── AvatarUpload ─────────────────────────────────────────────────────────────

function AvatarUpload({ companyId, onUpdated }: { companyId: string; onUpdated: () => void }) {
  const ref  = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onPick = async (file: File | null) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("File too large (max 5 MB)."); return; }
    setBusy(true);
    try {
      const url = await uploadImage("uploads", `avatars/${companyId}.jpg`, file, { maxWidth: 400, targetBytes: 200 * 1024 });
      const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("company_id", companyId);
      if (error) throw error;
      toast.success("Profile photo updated ✓");
      onUpdated();
    } catch (e: any) { toast.error(e.message ?? "Upload failed"); }
    finally { setBusy(false); }
  };

  return (
    <>
      <input ref={ref} type="file" accept="image/*" capture="user" className="hidden"
        onChange={e => onPick(e.target.files?.[0] ?? null)} />
      <Button size="icon" disabled={busy}
        onClick={() => ref.current?.click()}
        className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full gradient-primary text-primary-foreground shadow-soft">
        <Camera className="h-4 w-4" />
      </Button>
    </>
  );
}

// ─── ChangePasswordDialog ─────────────────────────────────────────────────────

function ChangePasswordDialog({ companyId }: { companyId: string }) {
  const [open, setOpen]       = useState(false);
  const [oldPw, setOldPw]     = useState("");
  const [newPw, setNewPw]     = useState("");
  const [confirm, setConfirm] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving]   = useState(false);

  const submit = async () => {
    if (newPw.length < 6) { toast.error("New password must be at least 6 characters."); return; }
    if (newPw !== confirm)  { toast.error("Passwords do not match."); return; }
    setSaving(true);
    const { data, error } = await supabase.from("profiles").select("id").eq("company_id", companyId).eq("password", oldPw).maybeSingle();
    if (error || !data) { toast.error("Current password is incorrect."); setSaving(false); return; }
    const { error: uErr } = await supabase.from("profiles").update({ password: newPw }).eq("id", data.id);
    setSaving(false);
    if (uErr) { toast.error(uErr.message); return; }
    toast.success("Password updated ✓");
    setOpen(false); setOldPw(""); setNewPw(""); setConfirm("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-xl flex-1 min-w-[140px]">
          <KeyRound className="h-4 w-4 mr-2" />Change Password
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl" aria-describedby={undefined}>
        <DialogHeader><DialogTitle>Change Password</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <PwField label="Current password" value={oldPw} onChange={setOldPw} show={showOld} onToggle={() => setShowOld(v => !v)} />
          <PwField label="New password"     value={newPw} onChange={setNewPw} show={showNew} onToggle={() => setShowNew(v => !v)} />
          <div className="space-y-1.5">
            <Label>Confirm new password</Label>
            <Input type={showNew ? "text" : "password"} value={confirm} onChange={e => setConfirm(e.target.value)} className="rounded-xl" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl">Cancel</Button>
          <Button onClick={submit} disabled={saving} className="rounded-xl gradient-primary text-primary-foreground">
            {saving ? "Saving…" : "Update"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── UpdateEmailDialog ────────────────────────────────────────────────────────

function UpdateEmailDialog({ companyId, current }: { companyId: string; current: string }) {
  const [open, setOpen]     = useState(false);
  const [email, setEmail]   = useState(current);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (email && !/^\S+@\S+\.\S+$/.test(email)) { toast.error("Invalid email address."); return; }
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ email: email || null }).eq("company_id", companyId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Email updated ✓");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-xl flex-1 min-w-[140px]">
          <Mail className="h-4 w-4 mr-2" />Update Email
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl" aria-describedby={undefined}>
        <DialogHeader><DialogTitle>Update Email Address</DialogTitle></DialogHeader>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" className="rounded-xl" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl">Cancel</Button>
          <Button onClick={submit} disabled={saving} className="rounded-xl gradient-primary text-primary-foreground">
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


// ─── UniformSizesCard ─────────────────────────────────────────────────────────

function UniformSizesCard({ profile, onUpdated }: { profile: Profile; onUpdated: () => void }) {
  const [open, setOpen]       = useState(false);
  const [saving, setSaving]   = useState(false);
  const sizes = (profile.uniform_sizes ?? null) as UniformSizes | null;

  const blankForm = (): UniformSizes => ({
    tshirt: null, longsleeve: null, pants: null,
    safety_boots: null, safety_shoes: null, last_updated: null,
  });

  const [form, setForm] = useState<UniformSizes>(sizes ?? blankForm());

  const save = async () => {
    setSaving(true);
    const payload: UniformSizes = { ...form, last_updated: new Date().toISOString() };
    const { error } = await supabase
      .from("profiles")
      .update({ uniform_sizes: payload })
      .eq("company_id", profile.company_id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Uniform sizes saved ✓");
    setOpen(false);
    onUpdated();
  };

  const hasSizes = sizes && UNIFORM_FIELDS.some(f => sizes[f.key]);

  return (
    <>
      <div className="rounded-2xl bg-card border border-border shadow-soft p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold flex items-center gap-2">
            <Shirt className="h-4 w-4 text-primary" /> Company Uniform Sizes
          </h3>
          <Button
            size="sm" variant="outline" className="rounded-xl"
            onClick={() => { setForm(sizes ?? blankForm()); setOpen(true); }}
          >
            <Pencil className="h-3.5 w-3.5 mr-1.5" />
            {hasSizes ? "Edit Sizes" : "Fill In Sizes"}
          </Button>
        </div>

        {!hasSizes ? (
          <div className="rounded-xl bg-muted/40 border border-dashed border-border p-5 text-center space-y-2">
            <Shirt className="h-8 w-8 text-muted-foreground/40 mx-auto" />
            <p className="text-sm text-muted-foreground">You haven&apos;t filled in your uniform sizes yet.</p>
            <p className="text-xs text-muted-foreground">HR uses this for uniform ordering — please fill it in.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {UNIFORM_FIELDS.map(f => (
                <div key={f.key} className="rounded-xl bg-muted/40 px-3 py-2.5 text-center">
                  <div className="text-xs text-muted-foreground mb-0.5">{f.label}</div>
                  <div className="font-bold text-lg">
                    {sizes?.[f.key] ?? <span className="text-muted-foreground text-sm font-normal">—</span>}
                  </div>
                </div>
              ))}
            </div>
            {sizes?.last_updated && (
              <p className="text-xs text-muted-foreground text-right">
                Last updated: {formatPH(sizes.last_updated, { dateStyle: "medium", timeStyle: "short" } as any)}
              </p>
            )}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shirt className="h-5 w-5 text-primary" /> My Uniform Sizes
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-1">
            HR uses these sizes for uniform ordering. Please keep them updated.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {UNIFORM_FIELDS.map(f => (
              <div key={f.key} className="space-y-1.5">
                <Label className="text-xs">{f.label}</Label>
                <select
                  value={form[f.key] ?? ""}
                  onChange={e => setForm({ ...form, [f.key]: e.target.value || null })}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">— Select —</option>
                  {f.sizes.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={save} disabled={saving} className="rounded-xl gradient-primary text-primary-foreground">
              {saving ? "Saving…" : "Save Sizes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Small helpers ─────────────────────────────────────────────────────────────

function PwField({ label, value, onChange, show, onToggle }: {
  label: string; value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="relative">
        <Input type={show ? "text" : "password"} value={value} onChange={e => onChange(e.target.value)} className="rounded-xl pr-10" />
        <button type="button" tabIndex={-1} onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value, mono, valueClass }: {
  icon: React.ReactNode; label: string; value: string; mono?: boolean; valueClass?: string;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-muted/40">
      <span className="text-primary shrink-0">{icon}</span>
      <span className="text-muted-foreground text-sm shrink-0 w-28">{label}</span>
      <span className={`font-medium text-sm truncate ml-auto text-right ${mono ? "font-mono" : ""} ${valueClass ?? ""}`}>{value}</span>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: any; color: string }) {
  return (
    <div className="rounded-2xl bg-card border border-border shadow-soft p-4 text-center">
      <div className={`text-2xl font-extrabold tabular-nums ${color}`}>{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

function CalLegend({ color, label, ring }: { color: string; label: string; ring?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`h-3.5 w-3.5 rounded-md ${ring ? "" : color} ${ring ? color : ""}`} />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function greeting(): string {
  const h = parseInt(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", hour: "numeric", hour12: false }).format(new Date()));
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

function formatDateLabel(key: string): string {
  const today     = phDateKey();
  const yesterday = phDateKey(new Date(Date.now() - 86400000));
  if (key === today)     return "Today";
  if (key === yesterday) return "Yesterday";
  return new Intl.DateTimeFormat("en-PH", { weekday: "short", month: "short", day: "numeric" }).format(new Date(key + "T12:00:00"));
}
