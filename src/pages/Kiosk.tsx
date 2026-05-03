import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  supabase,
  haversineMeters,
  shiftFromTimeIn,
  formatPH,
  phDateKey,
  phMonthDay,
  ADMIN_SHORTCUT_CODE,
  VISITOR_CODE,
  COMPANY_LAT,
  COMPANY_LNG,
  DEFAULT_RADIUS_M,
  type KioskSettings,
  type Profile,
  type Announcement,
  type Holiday,
} from "@/lib/supabase";
import { PH_REGULAR_HOLIDAYS_FIXED } from "@/lib/holidays";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { IdleAds } from "@/components/IdleAds";
import { VisitorDialog } from "@/components/VisitorDialog";
import { toast } from "sonner";
import { Clock, Loader2, ShieldCheck, UserPlus, LogIn as LogInIcon, PartyPopper, Sparkles } from "lucide-react";
import factoryBg from "@/assets/factory-bg.webp";
import abnLogo from "@/assets/abn-logo.svg";
import confetti from "canvas-confetti";

type Status = "open" | "closed" | "holiday";
const IDLE_MS = 15000;

export default function Kiosk() {
  const [code, setCode] = useState("");
  const [now, setNow] = useState(new Date());
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<{ name: string; action: "in" | "out"; time: string; birthday?: boolean } | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number; acc: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [settings, setSettings] = useState<KioskSettings | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [showVisitor, setShowVisitor] = useState(false);
  const [idle, setIdle] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const idleTimer = useRef<number | null>(null);
  const navigate = useNavigate();

  // Clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Load reference data
  useEffect(() => {
    (async () => {
      const [s, p, a, h] = await Promise.all([
        supabase.from("kiosk_settings").select("*").limit(1).maybeSingle(),
        supabase.from("profiles").select("id, company_id, full_name, dob, role, position, avatar_url, is_approved, email").eq("is_approved", true),
        supabase.from("announcements").select("*").eq("active", true).order("created_at", { ascending: false }),
        supabase.from("holidays").select("*").eq("active", true),
      ]);
      if (s.data) setSettings(s.data as KioskSettings);
      if (p.data) setProfiles(p.data as Profile[]);
      if (a.data) setAnnouncements(a.data as Announcement[]);
      if (h.data) setHolidays(h.data as Holiday[]);
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

  // Idle detection
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

  const radius = settings?.geofence_radius_m ?? DEFAULT_RADIUS_M;
  const centerLat = settings?.geofence_lat ?? COMPANY_LAT;
  const centerLng = settings?.geofence_lng ?? COMPANY_LNG;
  const distance = coords ? Math.round(haversineMeters(coords.lat, coords.lng, centerLat, centerLng)) : null;
  const inside = distance !== null && distance <= radius;

  // Holiday detection (PH today)
  const todayPH = phDateKey(now);
  const todayMD = todayPH.slice(5);
  const customHoliday = holidays.find(h => h.date === todayPH);
  const fixedHolidayName = PH_REGULAR_HOLIDAYS_FIXED[todayMD];
  const holidayName = customHoliday?.name ?? fixedHolidayName ?? null;
  const holidayMode = settings?.holiday_mode ?? "allow";
  const kioskDisabled = !!holidayName && holidayMode === "disable";

  // Birthdays today
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = code.trim();
    if (!id) return;

    if (id === ADMIN_SHORTCUT_CODE) { navigate("/attendance-list"); return; }
    if (id === VISITOR_CODE) { setCode(""); setShowVisitor(true); return; }

    if (kioskDisabled) { toast.error("Kiosk is disabled today (Holiday)."); return; }
    if (!inside) { toast.error("You are outside company premises."); return; }

    setBusy(true);
    try {
      const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .select("id, company_id, full_name, position, dob, is_approved")
        .eq("company_id", id)
        .maybeSingle();
      if (pErr) throw pErr;
      if (!profile) { toast.error("Company ID not found."); return; }
      if (!profile.is_approved) { toast.error("Account pending HR approval."); return; }

      const startUtc = new Date(`${todayPH}T00:00:00+08:00`).toISOString();
      const endUtc = new Date(`${todayPH}T23:59:59+08:00`).toISOString();
      const { data: logs } = await supabase
        .from("attendance").select("*")
        .eq("company_id", profile.company_id)
        .gte("timestamp", startUtc).lte("timestamp", endUtc);

      const hasIn = (logs ?? []).some((r: any) => r.type === "time_in");
      const hasOut = (logs ?? []).some((r: any) => r.type === "time_out");
      if (hasIn && hasOut) { toast.error("Already completed Time In and Time Out for today."); return; }

      const action: "in" | "out" = hasIn ? "out" : "in";
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
      setConfirm({ name: profile.full_name, action, time: timeStr, birthday: !!isBirthday });
      setCode("");
      if (isBirthday) fireConfetti();
      setTimeout(() => { setConfirm(null); inputRef.current?.focus(); }, isBirthday ? 6500 : 4000);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to record attendance");
    } finally {
      setBusy(false);
    }
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
          <img src={abnLogo} alt="AB Nutribev Corp." className="h-12 w-12 rounded-xl bg-white/95 p-1 shadow-soft" />
          <div className="leading-tight">
            <div className="font-bold text-lg">AB Nutribev Corp.</div>
            <div className="text-xs opacity-90 uppercase tracking-widest">Guard Manifest Kiosk</div>
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

      {/* Holiday banner */}
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

      <main className="relative z-10 container pb-10 pt-4 md:pt-8 grid lg:grid-cols-[1.1fr_1fr] gap-8 items-center min-h-[calc(100vh-120px)]">
        <section className="text-primary-foreground space-y-6">
          <div>
            <div className="text-sm opacity-90 uppercase tracking-widest">Philippine Time · Asia/Manila</div>
            <div className="mt-2 flex items-center gap-3 text-5xl md:text-7xl font-extrabold tabular-nums drop-shadow">
              <Clock className="h-10 w-10 md:h-14 md:w-14 opacity-90" /><span>{timeStr}</span>
            </div>
            <div className="mt-2 text-lg md:text-xl opacity-95">{dateStr}</div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/10 border border-white/20 backdrop-blur-md p-4 space-y-2">
              <div className="text-sm font-semibold uppercase tracking-wider opacity-90">Facilities</div>
              <FacilityRow label="Canteen" status={(settings?.canteen_status ?? "open") as Status} />
              <FacilityRow label="Clinic" status={(settings?.clinic_status ?? "open") as Status} />
            </div>
            {birthdayPeople.length > 0 && (
              <div className="rounded-2xl bg-white/10 border border-white/20 backdrop-blur-md p-4">
                <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider opacity-90">
                  <PartyPopper className="h-4 w-4" /> Birthdays Today
                </div>
                <div className="mt-2 text-sm space-y-1 max-h-24 overflow-hidden">
                  {birthdayPeople.slice(0, 3).map(p => (
                    <div key={p.id} className="truncate">🎂 <span className="font-semibold">{p.full_name}</span> {p.position && <span className="opacity-80">— {p.position}</span>}</div>
                  ))}
                  {birthdayPeople.length > 3 && <div className="text-xs opacity-80">+{birthdayPeople.length - 3} more</div>}
                </div>
              </div>
            )}
          </div>
        </section>

        <section>
          <div className="rounded-2xl bg-white/95 dark:bg-card/95 backdrop-blur-xl shadow-elegant p-6 md:p-8 border border-white/40">
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold">Tap Your Company ID</h2>
              <p className="text-sm text-muted-foreground mt-1">Welcome to AB Nutribev Corp.</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                ref={inputRef} value={code} onChange={(e) => setCode(e.target.value)}
                placeholder="Enter or scan Company ID"
                className="h-16 text-2xl text-center rounded-2xl"
                autoFocus disabled={busy || kioskDisabled}
              />
              <Button type="submit" disabled={busy || !code.trim() || kioskDisabled}
                className="w-full h-14 rounded-2xl text-lg font-bold gradient-primary text-primary-foreground shadow-elegant hover:opacity-90">
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Submit"}
              </Button>
              <p className="text-center text-xs text-muted-foreground">Visitor? Enter code <span className="font-mono font-semibold">{VISITOR_CODE}</span></p>
            </form>
          </div>
          {geoError && <p className="mt-3 text-center text-xs text-warning-foreground/90">⚠ {geoError}</p>}
        </section>
      </main>

      {/* Confirmation overlay */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm animate-fade-in p-4">
          <div className={`rounded-2xl shadow-elegant border p-8 md:p-10 max-w-lg w-full text-center ${
            confirm.birthday
              ? "bg-gradient-to-br from-warning/30 via-card to-accent/30 border-warning/40"
              : "bg-card border-border"
          }`}>
            <div className={`mx-auto h-16 w-16 rounded-full flex items-center justify-center mb-4 ${
              confirm.birthday ? "bg-warning/30 text-warning-foreground" : "bg-success/15 text-success"
            }`}>
              {confirm.birthday ? <PartyPopper className="h-8 w-8" /> : <ShieldCheck className="h-8 w-8" />}
            </div>
            {confirm.birthday ? (
              <>
                <h3 className="text-2xl md:text-3xl font-extrabold mb-2">Happy Birthday, {confirm.name}! 🎉🎂</h3>
                <p className="text-lg text-muted-foreground">Thank you for your hard work!</p>
                <p className="text-sm text-muted-foreground mt-3">Logged IN at {confirm.time}.</p>
              </>
            ) : (
              <>
                <h3 className="text-2xl font-bold mb-2">
                  {confirm.action === "in" ? `${greet()}, ${confirm.name}.` : `Good job today, ${confirm.name}.`}
                </h3>
                <p className="text-lg text-muted-foreground">
                  You are now logged <span className="font-semibold text-foreground">{confirm.action === "in" ? "IN" : "OUT"}</span> at {confirm.time}.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      <VisitorDialog open={showVisitor} onOpenChange={setShowVisitor} />

      {idle && !confirm && !showVisitor && (
        <IdleAds birthdayPeople={birthdayPeople} announcements={announcements} onExit={() => { setIdle(false); inputRef.current?.focus(); }} />
      )}
    </div>
  );
}

function FacilityRow({ label, status }: { label: string; status: Status }) {
  const map: Record<Status, string> = {
    open: "bg-success/20 text-white border-success/40",
    closed: "bg-destructive/20 text-white border-destructive/40",
    holiday: "bg-warning/20 text-white border-warning/40",
  };
  return (
    <div className="flex items-center justify-between text-sm">
      <span>{label}</span>
      <Badge variant="outline" className={`rounded-lg border ${map[status]} capitalize`}>{status}</Badge>
    </div>
  );
}

function greet(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
