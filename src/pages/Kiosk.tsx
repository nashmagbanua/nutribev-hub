import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  supabase,
  haversineMeters,
  shiftFromTimeIn,
  formatPH,
  phDateKey,
  phMonthDay,
  randomGreeting,
  isMobileDevice,
  ADMIN_SHORTCUT_CODE,
  VISITOR_CODE,
  COMPANY_LAT,
  COMPANY_LNG,
  DEFAULT_RADIUS_M,
  type KioskSettings,
  type Profile,
  type Announcement,
  type Holiday,
  type AreaCode,
  type AttendanceRow,
} from "@/lib/supabase";
import { PH_REGULAR_HOLIDAYS_FIXED } from "@/lib/holidays";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { IdleAds } from "@/components/IdleAds";
import { VisitorDialog } from "@/components/VisitorDialog";
import { toast } from "sonner";
import { Clock, Loader2, ShieldCheck, UserPlus, LogIn as LogInIcon, PartyPopper, Sparkles, Users } from "lucide-react";
import factoryBg from "@/assets/factory-bg.webp";
import abnLogo from "@/assets/abn-logo.svg";
import confetti from "canvas-confetti";
import { EmergencyDashboard } from "@/components/EmergencyDashboard";

type Status = "open" | "closed" | "holiday";
const IDLE_MS = 15000;
const EMERGENCY_CODE = "0001";

export default function Kiosk() {
  const [code, setCode] = useState("");
  const [now, setNow] = useState(new Date());
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<{ name: string; action: "in" | "out"; time: string; greeting: string; birthday?: boolean } | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number; acc: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [settings, setSettings] = useState<KioskSettings | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [areaCodes, setAreaCodes] = useState<AreaCode[]>([]);
  const [areaView, setAreaView] = useState<{ code: AreaCode; people: Profile[]; today: AttendanceRow[] } | null>(null);
  const [showVisitor, setShowVisitor] = useState(false);
  const [idle, setIdle] = useState(false);
  const [showEmergency, setShowEmergency] = useState(false);
  // Live counters for the kiosk screen
  const [insideCount, setInsideCount] = useState<number | null>(null);
  const [activeTodayCount, setActiveTodayCount] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const idleTimer = useRef<number | null>(null);
  const navigate = useNavigate();

  // Mobile redirect → show landing page on phones.
  useEffect(() => {
    if (isMobileDevice()) navigate("/welcome", { replace: true });
  }, [navigate]);

  // Wake lock to keep kiosk screen on 24/7
  useEffect(() => {
    let lock: any = null;
    const acquire = async () => {
      try { if ("wakeLock" in navigator) lock = await (navigator as any).wakeLock.request("screen"); } catch { /* ignore */ }
    };
    acquire();
    const onVis = () => { if (document.visibilityState === "visible") acquire(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { document.removeEventListener("visibilitychange", onVis); try { lock?.release?.(); } catch { /* ignore */ } };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    (async () => {
      const [s, p, a, h, ac] = await Promise.all([
        supabase.from("kiosk_settings").select("*").limit(1).maybeSingle(),
        supabase.from("profiles").select("id, company_id, full_name, dob, role, position, avatar_url, is_approved, email, area_code").eq("is_approved", true),
        supabase.from("announcements").select("*").eq("active", true).order("created_at", { ascending: false }),
        supabase.from("holidays").select("*").eq("active", true),
        supabase.from("area_codes").select("*").eq("active", true).order("code"),
      ]);
      if (s.data) setSettings(s.data as KioskSettings);
      if (p.data) setProfiles(p.data as Profile[]);
      if (a.data) setAnnouncements(a.data as Announcement[]);
      if (h.data) setHolidays(h.data as Holiday[]);
      if (ac.data) setAreaCodes(ac.data as AreaCode[]);
    })();
  }, []);

  useEffect(() => {
    if (!("geolocation" in navigator)) { setGeoError("Geolocation not supported."); return; }
    const watch = navigator.geolocation.watchPosition(
      (pos) => { setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy }); setGeoError(null); },
      (err) => setGeoError(err.message || "Unable to get location."),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 }
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, []);

  const resetIdle = () => {
    if (idle) setIdle(false);
    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setIdle(true), IDLE_MS);
  };
  useEffect(() => {
    resetIdle();
    const evts = ["mousemove", "keydown", "touchstart", "click"];
    evts.forEach(e => window.addEventListener(e, resetIdle));
    return () => {
      evts.forEach(e => window.removeEventListener(e, resetIdle));
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Live counters (inside now + active today) ──────────────────────────────
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        // Fetch ALL attendance rows to compute latest-record-per-employee.
        const { data: allRows } = await supabase
          .from("attendance")
          .select("company_id, type, timestamp")
          .order("timestamp", { ascending: false });

        const rows = (allRows ?? []) as AttendanceRow[];

        // Latest record per employee → inside if time_in
        const latestByEmp = new Map<string, AttendanceRow>();
        for (const r of rows) {
          if (!latestByEmp.has(r.company_id)) latestByEmp.set(r.company_id, r);
        }
        let inside = 0;
        latestByEmp.forEach((r) => { if (r.type === "time_in") inside++; });
        setInsideCount(inside);

        // Active today = employees who have ANY record today (PH time)
        const today = phDateKey(new Date());
        const startUtc = new Date(`${today}T00:00:00+08:00`).toISOString();
        const endUtc = new Date(`${today}T23:59:59+08:00`).toISOString();
        const todayIds = new Set(
          rows.filter((r) => r.timestamp >= startUtc && r.timestamp <= endUtc).map((r) => r.company_id)
        );
        setActiveTodayCount(todayIds.size);
      } catch {
        // Silently fail; counters just won't update
      }
    };

    fetchCounts();
    const t = window.setInterval(fetchCounts, 15_000); // Refresh every 15 s
    return () => window.clearInterval(t);
  }, []);


  const centerLat = settings?.geofence_lat ?? COMPANY_LAT;
  const centerLng = settings?.geofence_lng ?? COMPANY_LNG;
  const distance = coords ? Math.round(haversineMeters(coords.lat, coords.lng, centerLat, centerLng)) : null;
  const inside = distance !== null && distance <= radius;

  const todayPH = phDateKey(now);
  const todayMD = todayPH.slice(5);
  const customHoliday = holidays.find(h => h.date === todayPH);
  const fixedHolidayName = PH_REGULAR_HOLIDAYS_FIXED[todayMD];
  const holidayName = customHoliday?.name ?? fixedHolidayName ?? null;
  const holidayMode = settings?.holiday_mode ?? "allow";
  const kioskDisabled = !!holidayName && holidayMode === "disable";

  const birthdayPeople = useMemo(
    () => profiles.filter(p => p.dob && phMonthDay(p.dob) === todayMD),
    [profiles, todayMD]
  );

  const fireConfetti = () => {
    const burst = (origin: { x: number; y: number }) => confetti({
      particleCount: 90, spread: 75, startVelocity: 45, origin, ticks: 200,
      colors: ["#22c55e", "#16a34a", "#facc15", "#f97316", "#ef4444", "#8b5cf6"],
    });
    burst({ x: 0.2, y: 0.4 }); burst({ x: 0.8, y: 0.4 }); burst({ x: 0.5, y: 0.3 });
    setTimeout(() => burst({ x: 0.5, y: 0.5 }), 500);
  };

  const openAreaView = async (areaCode: AreaCode) => {
    const people = profiles.filter(p => p.area_code === areaCode.code);
    const startUtc = new Date(`${todayPH}T00:00:00+08:00`).toISOString();
    const endUtc = new Date(`${todayPH}T23:59:59+08:00`).toISOString();
    const ids = people.map(p => p.company_id);
    let today: AttendanceRow[] = [];
    if (ids.length) {
      const { data } = await supabase.from("attendance").select("*").in("company_id", ids).gte("timestamp", startUtc).lte("timestamp", endUtc);
      today = (data as AttendanceRow[]) ?? [];
    }
    setAreaView({ code: areaCode, people, today });
    // Auto-close after 25s
    setTimeout(() => setAreaView(null), 25000);
  };

  const processCode = async (id: string) => {
    if (!id) return;
    if (id === ADMIN_SHORTCUT_CODE) { setCode(""); navigate("/attendance-list"); return; }
    if (id === EMERGENCY_CODE) { setCode(""); setShowEmergency(true); return; }
    if (id === VISITOR_CODE) { setCode(""); setShowVisitor(true); return; }

    // Area code lookup (supervisor)
    const area = areaCodes.find(a => a.code === id);
    if (area) { setCode(""); await openAreaView(area); return; }

    if (kioskDisabled) { toast.error("Kiosk is disabled today (Holiday)."); setCode(""); return; }
    if (!inside) { toast.error("You are outside company premises."); setCode(""); return; }

    setBusy(true);
    try {
      const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .select("id, company_id, full_name, position, dob, is_approved")
        .eq("company_id", id)
        .maybeSingle();
      if (pErr) throw pErr;
      if (!profile) { toast.error("Company ID not found."); setCode(""); return; }
      if (!profile.is_approved) { toast.error("Account pending HR approval."); setCode(""); return; }

      // Latest-record logic — supports cross-date night shift.
      // If latest record is an open time_in (no time_out after it) → TIME OUT.
      // Otherwise → TIME IN.
      const { data: latestRows } = await supabase
        .from("attendance").select("*")
        .eq("company_id", profile.company_id)
        .order("timestamp", { ascending: false })
        .limit(1);
      const latest = (latestRows ?? [])[0] as any | undefined;
      const action: "in" | "out" = latest && latest.type === "time_in" ? "out" : "in";

      // Prevent duplicate within 60s.
      if (latest && Date.now() - new Date(latest.timestamp).getTime() < 60_000) {
        toast.error("Please wait a moment before logging again.");
        setCode("");
        return;
      }

      const ts = new Date();
      const shift = action === "in" ? shiftFromTimeIn(ts) : null;

      const { error: insErr } = await supabase.from("attendance").insert({
        company_id: profile.company_id,
        type: action === "in" ? "time_in" : "time_out",
        timestamp: ts.toISOString(),
        shift,
        source: "kiosk",
      });
      if (insErr) throw insErr;

      const isBirthday = action === "in" && profile.dob && phMonthDay(profile.dob) === todayMD;
      const timeStr = formatPH(ts, { hour: "2-digit", minute: "2-digit", hour12: true });
      setConfirm({
        name: profile.full_name, action, time: timeStr,
        greeting: randomGreeting(action), birthday: !!isBirthday,
      });
      setCode("");
      if (isBirthday) fireConfetti();
      setTimeout(() => { setConfirm(null); inputRef.current?.focus(); }, isBirthday ? 6500 : 3500);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to record attendance");
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  // Auto-submit when input reaches 6 digits, or on Enter
  const onChange = (v: string) => {
    const cleaned = v.replace(/\s+/g, "");
    setCode(cleaned);
    // 4-char codes: area codes, emergency (0001), visitor (12345 is 5 chars handled by Enter).
    // 6-digit codes: employee Company IDs.
    // 8-digit code: ADMIN_SHORTCUT_CODE.
    const is4Digit = /^\d{4}$/.test(cleaned);
    const is6Digit = /^\d{6}$/.test(cleaned);
    const is8Digit = /^\d{8}$/.test(cleaned);
    if ((is4Digit || is6Digit || is8Digit) && !busy) {
      processCode(cleaned);
    }
  };
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); processCode(code.trim()); }
  };

  const dateStr = formatPH(now, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const timeStr = formatPH(now, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${factoryBg})` }} aria-hidden />
      <div className={`absolute inset-0 backdrop-blur-[2px] ${
        holidayName ? "bg-gradient-to-br from-accent/80 via-primary/70 to-warning/60" : "bg-gradient-to-br from-primary/85 via-primary/70 to-accent/60"
      }`} aria-hidden />

      <header className="relative z-10 container flex items-center justify-between py-4">
        <div className="flex items-center gap-3 text-primary-foreground">
          <img src={abnLogo} alt="AB Nutribev Corp." className="h-12 w-12 drop-shadow-lg" />
          <div className="leading-tight hidden sm:block">
            <div className="font-bold text-lg">AB Nutribev Corp.</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/login" className="hidden sm:inline-flex items-center gap-2 text-sm bg-white/15 hover:bg-white/25 text-primary-foreground backdrop-blur rounded-full px-4 py-2 transition-smooth">
            <LogInIcon className="h-4 w-4" /> Employee Login
          </Link>
          <Link to="/register" className="hidden sm:inline-flex items-center gap-2 text-sm bg-white/15 hover:bg-white/25 text-primary-foreground backdrop-blur rounded-full px-4 py-2 transition-smooth">
            <UserPlus className="h-4 w-4" /> Register
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {holidayName && (
        <div className="relative z-10 container">
          <div className="rounded-2xl bg-white/15 backdrop-blur-md border border-white/30 text-primary-foreground px-5 py-3 flex items-center gap-3 shadow-elegant animate-fade-in">
            <Sparkles className="h-5 w-5 text-warning" />
            <div className="flex-1">
              <div className="font-bold">Today is a Philippine Regular Holiday: {holidayName}</div>
              <div className="text-xs opacity-90">{kioskDisabled ? "Kiosk Time In/Out is disabled today." : "Time In/Out remains available."}</div>
            </div>
          </div>
        </div>
      )}

      {/* MINIMAL CENTERED LINEAR LAYOUT */}
      <main className="relative z-10 container pb-10 pt-6 md:pt-10 flex flex-col items-center justify-center text-center min-h-[calc(100vh-160px)]">
        <div className="text-primary-foreground space-y-2 mb-8">
          <div className="text-xs md:text-sm opacity-90 uppercase tracking-[0.3em]">Asia/Manila</div>
          <div className="flex items-center gap-3 justify-center text-5xl md:text-7xl font-extrabold tabular-nums drop-shadow">
            <Clock className="h-10 w-10 md:h-14 md:w-14 opacity-90" /><span>{timeStr}</span>
          </div>
          <div className="text-base md:text-lg opacity-95">{dateStr}</div>
        </div>

        <div className="w-full max-w-md rounded-2xl bg-white/95 dark:bg-card/95 backdrop-blur-xl shadow-elegant p-6 md:p-8 border border-white/40">
          <Input
            ref={inputRef} value={code}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKey}
            placeholder="Enter Company ID"
            inputMode="numeric"
            maxLength={8}
            className="h-16 text-3xl text-center rounded-2xl tracking-widest font-bold"
            autoFocus disabled={busy || kioskDisabled}
          />
          {busy && <div className="mt-3 flex items-center justify-center text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin mr-2" /> Processing…</div>}
        </div>

        {birthdayPeople.length > 0 && (
          <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-md text-primary-foreground px-4 py-2 text-sm border border-white/20">
            <PartyPopper className="h-4 w-4" /> Birthdays today: {birthdayPeople.slice(0,3).map(p => p.full_name).join(", ")}{birthdayPeople.length > 3 ? ` +${birthdayPeople.length - 3}` : ""}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-primary-foreground/90 text-xs">
          <FacilityChip label="Canteen" status={(settings?.canteen_status ?? "open") as Status} />
          <FacilityChip label="Clinic" status={(settings?.clinic_status ?? "open") as Status} />
        </div>

        {geoError && <p className="mt-4 text-center text-xs text-warning/90">⚠ {geoError}</p>}

        {/* Live counters */}
        {(insideCount !== null || activeTodayCount !== null) && (
          <div className="mt-5 flex items-center justify-center gap-3 flex-wrap">
            {insideCount !== null && (
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-md text-primary-foreground px-4 py-2 text-sm border border-white/20 font-medium tabular-nums">
                👥 Inside Now: <strong>{insideCount}</strong>
              </span>
            )}
            {activeTodayCount !== null && (
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-md text-primary-foreground px-4 py-2 text-sm border border-white/20 font-medium tabular-nums">
                🟢 Active Today: <strong>{activeTodayCount}</strong>
              </span>
            )}
          </div>
        )}
      </main>

      {/* Confirmation overlay — centered, bold name, random greeting */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm animate-fade-in p-4">
          <div className={`rounded-2xl shadow-elegant border p-10 md:p-14 max-w-xl w-full text-center ${
            confirm.birthday
              ? "bg-gradient-to-br from-warning/30 via-card to-accent/30 border-warning/40"
              : "bg-card border-border"
          }`}>
            <div className={`mx-auto h-20 w-20 rounded-full flex items-center justify-center mb-6 ${
              confirm.birthday ? "bg-warning/30 text-warning-foreground" : "bg-success/15 text-success"
            }`}>
              {confirm.birthday ? <PartyPopper className="h-10 w-10" /> : <ShieldCheck className="h-10 w-10" />}
            </div>
            {confirm.birthday ? (
              <>
                <p className="text-lg md:text-xl text-muted-foreground">Happy Birthday,</p>
                <h3 className="text-4xl md:text-5xl font-extrabold mt-1 mb-3">{confirm.name}! 🎉🎂</h3>
                <p className="text-lg text-muted-foreground">Thank you for your hard work!</p>
                <p className="text-sm text-muted-foreground mt-4">Logged IN at {confirm.time}.</p>
              </>
            ) : (
              <>
                <p className="text-lg md:text-xl text-muted-foreground">{confirm.greeting},</p>
                <h3 className="text-4xl md:text-5xl font-extrabold mt-1 mb-4">{confirm.name}</h3>
                <p className="text-lg text-muted-foreground">
                  Time {confirm.action === "in" ? "In" : "Out"} recorded at <span className="font-semibold text-foreground">{confirm.time}</span>
                </p>
              </>
            )}
          </div>
        </div>
      )}

      <VisitorDialog open={showVisitor} onOpenChange={setShowVisitor} />

      {/* Emergency Evacuation Dashboard */}
      <EmergencyDashboard
        open={showEmergency}
        onClose={() => { setShowEmergency(false); setTimeout(() => inputRef.current?.focus(), 100); }}
      />

      {/* Area code overlay */}
      <Dialog open={!!areaView} onOpenChange={(v) => !v && setAreaView(null)}>
        <DialogContent className="rounded-2xl max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Area {areaView?.code.code} — {areaView?.code.name}
            </DialogTitle>
          </DialogHeader>
          {areaView && (
            <div className="max-h-[60vh] overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left sticky top-0">
                  <tr><th className="p-3">Employee</th><th className="p-3">Status</th><th className="p-3">Time</th></tr>
                </thead>
                <tbody>
                  {areaView.people.length === 0 && <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">No employees assigned to this area.</td></tr>}
                  {areaView.people
                    .slice()
                    .sort((a, b) => a.full_name.localeCompare(b.full_name))
                    .map(p => {
                      const myLogs = areaView.today.filter(t => t.company_id === p.company_id);
                      const inLog = myLogs.find(l => l.type === "time_in");
                      const outLog = myLogs.find(l => l.type === "time_out");
                      const status = outLog ? "Timed Out" : inLog ? "Timed In" : "Absent";
                      const statusColor = outLog ? "secondary" : inLog ? "default" : "outline";
                      const time = outLog
                        ? formatPH(outLog.timestamp, { hour: "2-digit", minute: "2-digit", hour12: true })
                        : inLog ? formatPH(inLog.timestamp, { hour: "2-digit", minute: "2-digit", hour12: true }) : "—";
                      return (
                        <tr key={p.id} className="border-t border-border">
                          <td className="p-3 font-medium">{p.full_name}</td>
                          <td className="p-3"><Badge variant={statusColor as any} className="rounded-lg">{status}</Badge></td>
                          <td className="p-3 font-mono text-xs">{time}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {idle && !confirm && !showVisitor && !areaView && !showEmergency && (
        <IdleAds birthdayPeople={birthdayPeople} announcements={announcements} onExit={() => { setIdle(false); inputRef.current?.focus(); }} />
      )}
    </div>
  );
}

function FacilityChip({ label, status }: { label: string; status: Status }) {
  const tone = status === "open" ? "bg-success/30 border-success/50" : status === "closed" ? "bg-destructive/30 border-destructive/50" : "bg-warning/30 border-warning/50";
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 border ${tone}`}>
      <span className="font-semibold">{label}</span>
      <span className="capitalize opacity-90">{status}</span>
    </span>
  );
}
