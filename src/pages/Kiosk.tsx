import { useEffect, useMemo, useRef, useState, useCallback } from "react";
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
  const [confirm, setConfirm] = useState<{ name: string; action: "in" | "out"; time: string; greeting: string; birthday?: boolean; shift?: string } | null>(null);
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
  const [insideCount, setInsideCount] = useState<number | null>(null);
  const [activeTodayCount, setActiveTodayCount] = useState<number | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const idleTimer = useRef<number | null>(null);
  const navigate = useNavigate();

  // Mobile redirect
  useEffect(() => {
    if (isMobileDevice()) navigate("/welcome", { replace: true });
  }, [navigate]);

  // Wake lock
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

  // Clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // AUTO-FOCUS & AUTO-EXIT Success Modal on Keydown
  useEffect(() => {
    const handleKeyDown = () => {
      if (confirm) {
        setConfirm(null);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    };
    if (confirm) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [confirm]);

  // Initial Data Fetch
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

  // Geolocation
  useEffect(() => {
    if (!("geolocation" in navigator)) { setGeoError("Geolocation not supported."); return; }
    const watch = navigator.geolocation.watchPosition(
      (pos) => { setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy }); setGeoError(null); },
      (err) => setGeoError(err.message || "Unable to get location."),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 }
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, []);

  // Idle Timer
  const resetIdle = useCallback(() => {
    if (idle) setIdle(false);
    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => {
      // Don't show ads if an active dialog/modal is open
      if (!confirm && !showVisitor && !areaView && !showEmergency) setIdle(true);
    }, IDLE_MS);
  }, [idle, confirm, showVisitor, areaView, showEmergency]);

  useEffect(() => {
    resetIdle();
    const evts = ["mousemove", "keydown", "touchstart", "click"];
    evts.forEach(e => window.addEventListener(e, resetIdle));
    return () => {
      evts.forEach(e => window.removeEventListener(e, resetIdle));
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
    };
  }, [resetIdle]);

  // Derived Values
  const radius = settings?.geofence_radius_m ?? DEFAULT_RADIUS_M;
  const centerLat = settings?.geofence_lat ?? COMPANY_LAT;
  const centerLng = settings?.geofence_lng ?? COMPANY_LNG;
  const distance = coords ? Math.round(haversineMeters(coords.lat, coords.lng, centerLat, centerLng)) : null;
  const inside = distance !== null && distance <= radius;

  const todayPH = phDateKey(now);
  const todayMD = todayPH.slice(5);
  const holidayName = holidays.find(h => h.date === todayPH)?.name ?? PH_REGULAR_HOLIDAYS_FIXED[todayMD] ?? null;
  const kioskDisabled = !!holidayName && settings?.holiday_mode === "disable";

  const birthdayPeople = useMemo(
    () => profiles.filter(p => p.dob && phMonthDay(p.dob) === todayMD),
    [profiles, todayMD]
  );

  // Live counters
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const { data: allRows } = await supabase.from("attendance").select("company_id, type, timestamp").order("timestamp", { ascending: false });
        const rows = (allRows ?? []) as AttendanceRow[];
        const latestByEmp = new Map<string, AttendanceRow>();
        for (const r of rows) { if (!latestByEmp.has(r.company_id)) latestByEmp.set(r.company_id, r); }
        let insideCnt = 0;
        latestByEmp.forEach((r) => { if (r.type === "time_in") insideCnt++; });
        setInsideCount(insideCnt);

        const today = phDateKey(new Date());
        const startUtc = new Date(`${today}T00:00:00+08:00`).toISOString();
        const endUtc = new Date(`${today}T23:59:59+08:00`).toISOString();
        const todayIds = new Set(rows.filter((r) => r.timestamp >= startUtc && r.timestamp <= endUtc).map((r) => r.company_id));
        setActiveTodayCount(todayIds.size);
      } catch { /* silent fail */ }
    };
    fetchCounts();
    const t = window.setInterval(fetchCounts, 15_000);
    return () => window.clearInterval(t);
  }, []);

  const fireConfetti = () => {
    const burst = (origin: { x: number; y: number }) => confetti({
      particleCount: 80, spread: 70, origin, colors: ["#22c55e", "#facc15", "#ef4444", "#8b5cf6"],
    });
    burst({ x: 0.2, y: 0.5 }); burst({ x: 0.8, y: 0.5 });
  };

  const processCode = async (id: string) => {
    const cleaned = id.trim();
    if (!cleaned || busy) return;

    if (cleaned === ADMIN_SHORTCUT_CODE) { setCode(""); navigate("/attendance-list"); return; }
    if (cleaned === EMERGENCY_CODE) { setCode(""); setShowEmergency(true); return; }
    if (cleaned === VISITOR_CODE) { setCode(""); setShowVisitor(true); return; }

    const area = areaCodes.find(a => a.code === cleaned);
    if (area) { 
      setCode(""); 
      const people = profiles.filter(p => p.area_code === area.code);
      const startUtc = new Date(`${todayPH}T00:00:00+08:00`).toISOString();
      const endUtc = new Date(`${todayPH}T23:59:59+08:00`).toISOString();
      const ids = people.map(p => p.company_id);
      let todayLogs: AttendanceRow[] = [];
      if (ids.length) {
        const { data } = await supabase.from("attendance").select("*").in("company_id", ids).gte("timestamp", startUtc).lte("timestamp", endUtc);
        todayLogs = (data as AttendanceRow[]) ?? [];
      }
      setAreaView({ code: area, people, today: todayLogs });
      setTimeout(() => { setAreaView(null); inputRef.current?.focus(); }, 25000);
      return; 
    }

    if (kioskDisabled) { toast.error("Kiosk is disabled today (Holiday)."); setCode(""); return; }
    if (!inside) { toast.error("Outside company premises."); setCode(""); return; }

    setBusy(true);
    try {
      const { data: profile } = await supabase.from("profiles").select("id, company_id, full_name, dob, is_approved").eq("company_id", cleaned).maybeSingle();
      if (!profile) throw new Error("Company ID not found.");
      if (!profile.is_approved) throw new Error("Account pending HR approval.");

      const { data: latestRows } = await supabase.from("attendance").select("*").eq("company_id", profile.company_id).order("timestamp", { ascending: false }).limit(1);
      const latest = (latestRows ?? [])[0];
      const action: "in" | "out" = latest && latest.type === "time_in" ? "out" : "in";

      if (latest && Date.now() - new Date(latest.timestamp).getTime() < 60_000) {
        throw new Error("Please wait a moment before logging again.");
      }

      const ts = new Date();
      // SYNCED LOGIC: 3PM Night Shift Cut-off
      const shift = action === "in" ? shiftFromTimeIn(ts) : (latest?.shift ?? null);

      const { error: insErr } = await supabase.from("attendance").insert({
        company_id: profile.company_id,
        type: action === "in" ? "time_in" : "time_out",
        timestamp: ts.toISOString(),
        shift,
        source: "kiosk",
      });
      if (insErr) throw insErr;

      const isBirthday = action === "in" && profile.dob && phMonthDay(profile.dob) === todayMD;
      setConfirm({
        name: profile.full_name, action, time: formatPH(ts, { hour: "2-digit", minute: "2-digit", hour12: true }),
        greeting: randomGreeting(action), birthday: !!isBirthday, shift: shift || undefined
      });

      if (isBirthday) fireConfetti();
      // PRODUCTION TIMER: Fast for normal, longer for birthday
      setTimeout(() => { setConfirm(null); inputRef.current?.focus(); }, isBirthday ? 5000 : 1500);

    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
      setCode("");
      setTimeout(() => inputRef.current?.focus(), 100); // RE-FOCUS REGARDLESS OF ERROR
    }
  };

  const onChange = (v: string) => {
    const cleaned = v.replace(/\s+/g, "");
    setCode(cleaned);
    if (busy) return;

    if (/^\d{4}$/.test(cleaned)) {
      if (cleaned === EMERGENCY_CODE || areaCodes.some(a => a.code === cleaned)) processCode(cleaned);
    } else if (cleaned === VISITOR_CODE || /^\d{6}$/.test(cleaned) || /^\d{8}$/.test(cleaned)) {
      processCode(cleaned);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden select-none">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${factoryBg})` }} />
      <div className={`absolute inset-0 backdrop-blur-[2px] ${holidayName ? "bg-primary/70" : "bg-primary/80"}`} />

      <header className="relative z-10 container flex items-center justify-between py-4">
        <div className="flex items-center gap-3 text-primary-foreground">
          <img src={abnLogo} alt="Logo" className="h-12 w-12" />
          <div className="font-bold text-lg hidden sm:block">AB Nutribev Corp.</div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </header>

      <main className="relative z-10 container flex flex-col items-center justify-center min-h-[calc(100vh-160px)]">
        <div className="text-primary-foreground space-y-2 mb-8 text-center">
          <div className="text-sm opacity-80 uppercase tracking-widest">Asia/Manila</div>
          <div className="text-6xl md:text-8xl font-black tabular-nums drop-shadow-xl">
            {formatPH(now, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}
          </div>
          <div className="text-lg opacity-90">{formatPH(now, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</div>
        </div>

        <div className="w-full max-w-md bg-card/95 backdrop-blur-xl shadow-2xl p-8 rounded-3xl border border-white/20">
          <Input
            ref={inputRef} value={code}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && processCode(code)}
            placeholder="ENTER ID"
            inputMode="numeric"
            maxLength={8}
            autoComplete="off"
            spellCheck={false}
            className="h-20 text-4xl text-center rounded-2xl tracking-[0.5em] font-black border-2 focus-visible:ring-primary"
            autoFocus disabled={busy || kioskDisabled}
          />
          {busy && <div className="mt-4 flex items-center justify-center text-primary font-bold animate-pulse"><Loader2 className="h-5 w-5 animate-spin mr-2" /> PROCESSING...</div>}
        </div>

        {holidayName && (
          <div className="mt-6 bg-warning/20 border border-warning/50 text-warning-foreground px-6 py-2 rounded-full backdrop-blur-md flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> <strong>Holiday: {holidayName}</strong>
          </div>
        )}

        {(insideCount !== null || activeTodayCount !== null) && (
          <div className="mt-8 flex gap-4">
             <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 text-primary-foreground text-sm">
                👥 Inside: <strong>{insideCount ?? 0}</strong>
             </div>
             <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 text-primary-foreground text-sm">
                🟢 Today: <strong>{activeTodayCount ?? 0}</strong>
             </div>
          </div>
        )}
      </main>

      {/* SUCCESS/BIRTHDAY OVERLAY */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className={`rounded-3xl shadow-2xl border-4 p-10 max-w-xl w-full text-center ${confirm.birthday ? "border-warning bg-warning/10" : "border-success bg-success/10"}`}>
            <div className="mx-auto h-24 w-24 rounded-full bg-background flex items-center justify-center mb-6 shadow-lg">
              {confirm.birthday ? <PartyPopper className="h-12 w-12 text-warning" /> : <ShieldCheck className="h-12 w-12 text-success" />}
            </div>
            <h3 className="text-2xl font-bold text-muted-foreground uppercase tracking-widest">{confirm.greeting}</h3>
            <h2 className="text-5xl font-black my-4">{confirm.name}</h2>
            <div className="text-3xl font-bold opacity-80">
              TIME {confirm.action.toUpperCase()} @ {confirm.time}
            </div>
            {confirm.shift && <Badge className="mt-4 uppercase text-lg px-4 py-1">{confirm.shift} SHIFT</Badge>}
          </div>
        </div>
      )}

      <VisitorDialog open={showVisitor} onOpenChange={(v) => { setShowVisitor(v); if (!v) setTimeout(() => inputRef.current?.focus(), 100); }} />
      <EmergencyDashboard open={showEmergency} onClose={() => { setShowEmergency(false); setTimeout(() => inputRef.current?.focus(), 100); }} />

      <Dialog open={!!areaView} onOpenChange={(v) => { if (!v) { setAreaView(null); setTimeout(() => inputRef.current?.focus(), 100); } }}>
        <DialogContent className="max-w-2xl rounded-3xl">
          <DialogHeader><DialogTitle>Area {areaView?.code.code} Status</DialogTitle></DialogHeader>
          <div className="max-h-[60vh] overflow-auto px-2">
            <table className="w-full">
              <thead className="sticky top-0 bg-background border-b">
                <tr className="text-left text-xs uppercase opacity-60"><th className="p-2">Name</th><th className="p-2">Status</th><th className="p-2">Time</th></tr>
              </thead>
              <tbody>
                {areaView?.people.map(p => {
                  const log = areaView.today.find(l => l.company_id === p.company_id);
                  return (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="p-2 font-bold">{p.full_name}</td>
                      <td className="p-2"><Badge variant={log?.type === "time_in" ? "default" : "outline"}>{log?.type === "time_in" ? "IN" : "OUT/ABSENT"}</Badge></td>
                      <td className="p-2 text-sm font-mono">{log ? formatPH(log.timestamp, { hour: "2-digit", minute: "2-digit" }) : "--:--"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      {idle && <IdleAds birthdayPeople={birthdayPeople} announcements={announcements} onExit={() => { setIdle(false); inputRef.current?.focus(); }} />}
    </div>
  );
}
