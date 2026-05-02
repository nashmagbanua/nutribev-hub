import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  supabase,
  haversineMeters,
  shiftFromTimeIn,
  formatPH,
  ADMIN_SHORTCUT_CODE,
  COMPANY_LAT,
  COMPANY_LNG,
  DEFAULT_RADIUS_M,
  type KioskSettings,
} from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { toast } from "sonner";
import { Clock, Loader2, MapPin, ShieldCheck, UserPlus, LogIn as LogInIcon } from "lucide-react";
import factoryBg from "@/assets/factory-bg.webp";
import abnLogo from "@/assets/abn-logo.svg";
import { Link } from "react-router-dom";

type Status = "open" | "closed" | "holiday";

export default function Kiosk() {
  const [code, setCode] = useState("");
  const [now, setNow] = useState(new Date());
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<{ name: string; action: "in" | "out"; time: string } | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number; acc: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [settings, setSettings] = useState<KioskSettings | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Settings (canteen, clinic, geofence, threshold)
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("kiosk_settings").select("*").limit(1).maybeSingle();
      if (data) setSettings(data as KioskSettings);
    })();
  }, []);

  // Geolocation
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setGeoError("Geolocation not supported by this device.");
      return;
    }
    const watch = navigator.geolocation.watchPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy });
        setGeoError(null);
      },
      (err) => setGeoError(err.message || "Unable to get your location."),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 }
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, []);

  const radius = settings?.geofence_radius_m ?? DEFAULT_RADIUS_M;
  const centerLat = settings?.geofence_lat ?? COMPANY_LAT;
  const centerLng = settings?.geofence_lng ?? COMPANY_LNG;
  const distance = coords ? Math.round(haversineMeters(coords.lat, coords.lng, centerLat, centerLng)) : null;
  const inside = distance !== null && distance <= radius;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = code.trim();
    if (!id) return;

    // Admin shortcut
    if (id === ADMIN_SHORTCUT_CODE) {
      navigate("/attendance-list");
      return;
    }

    if (!inside) {
      toast.error("You are outside company premises.");
      return;
    }

    setBusy(true);
    try {
      const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .select("id, company_id, full_name, position, is_approved")
        .eq("company_id", id)
        .maybeSingle();
      if (pErr) throw pErr;
      if (!profile) {
        toast.error("Company ID not found.");
        return;
      }
      if (!profile.is_approved) {
        toast.error("Account pending HR approval.");
        return;
      }

      // Check today's logs (PH date) for this employee
      const today = formatPH(new Date(), { year: "numeric", month: "2-digit", day: "2-digit" });
      // get all events for today via timezone-safe range
      const startUtc = new Date(`${toIso(today)}T00:00:00+08:00`).toISOString();
      const endUtc = new Date(`${toIso(today)}T23:59:59+08:00`).toISOString();
      const { data: logs } = await supabase
        .from("attendance")
        .select("*")
        .eq("company_id", profile.company_id)
        .gte("timestamp", startUtc)
        .lte("timestamp", endUtc);

      const hasIn = (logs ?? []).some((r: any) => r.type === "time_in");
      const hasOut = (logs ?? []).some((r: any) => r.type === "time_out");

      if (hasIn && hasOut) {
        toast.error("You have already completed Time In and Time Out for today.");
        return;
      }

      const action: "in" | "out" = hasIn ? "out" : "in";
      const ts = new Date();
      const shift = action === "in" ? shiftFromTimeIn(ts) : null;

      const { error: insErr } = await supabase.from("attendance").insert({
        company_id: profile.company_id,
        type: action === "in" ? "time_in" : "time_out",
        timestamp: ts.toISOString(),
        shift,
      });
      if (insErr) throw insErr;

      const timeStr = formatPH(ts, { hour: "2-digit", minute: "2-digit", hour12: true });
      setConfirm({ name: profile.full_name, action, time: timeStr });
      setCode("");
      // Auto-reset
      setTimeout(() => {
        setConfirm(null);
        inputRef.current?.focus();
      }, 4000);
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
      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${factoryBg})` }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-gradient-to-br from-primary/85 via-primary/70 to-accent/60 backdrop-blur-[2px]" aria-hidden />

      {/* Top bar */}
      <header className="relative z-10 container flex items-center justify-between py-4">
        <div className="flex items-center gap-3 text-primary-foreground">
          <img src={abnLogo} alt="AB Nutribev Corp." className="h-12 w-12 rounded-xl bg-white/95 p-1 shadow-soft" />
          <div className="leading-tight">
            <div className="font-bold text-lg">AB Nutribev Corp.</div>
            <div className="text-xs opacity-90 uppercase tracking-widest">Gaurd Manifest Kiosk</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/login"
            className="hidden sm:inline-flex items-center gap-2 text-sm bg-white/15 hover:bg-white/25 text-primary-foreground backdrop-blur rounded-full px-4 py-2 transition-smooth"
          >
            <LogInIcon className="h-4 w-4" /> Employee Login
          </Link>
          <Link
            to="/register"
            className="hidden sm:inline-flex items-center gap-2 text-sm bg-white/15 hover:bg-white/25 text-primary-foreground backdrop-blur rounded-full px-4 py-2 transition-smooth"
          >
            <UserPlus className="h-4 w-4" /> Register
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="relative z-10 container pb-10 pt-4 md:pt-10 grid lg:grid-cols-[1.1fr_1fr] gap-8 items-center min-h-[calc(100vh-80px)]">
        {/* Left: clock + status */}
        <section className="text-primary-foreground space-y-6">
          <div>
            <div className="text-sm opacity-90 uppercase tracking-widest">Philippine Time · Asia/Manila</div>
            <div className="mt-2 flex items-center gap-3 text-5xl md:text-7xl font-extrabold tabular-nums drop-shadow">
              <Clock className="h-10 w-10 md:h-14 md:w-14 opacity-90" />
              <span>{timeStr}</span>
            </div>
            <div className="mt-2 text-lg md:text-xl opacity-95">{dateStr}</div>
          </div>

          {/* Geo + facility status */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/10 border border-white/20 backdrop-blur-md p-4">
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider opacity-90">
                <MapPin className="h-4 w-4" /> Location
              </div>
              {geoError && <div className="mt-2 text-sm text-red-100">{geoError}</div>}
              {!geoError && !coords && <div className="mt-2 text-sm opacity-90">Locating…</div>}
              {coords && (
                <div className="mt-2 text-sm">
                  {inside ? (
                    <span className="inline-flex items-center gap-2 font-semibold">
                      <ShieldCheck className="h-4 w-4" /> Inside premises ({distance}m)
                    </span>
                  ) : (
                    <span className="font-semibold">Outside premises ({distance}m, allowed {radius}m)</span>
                  )}
                </div>
              )}
            </div>
            <div className="rounded-2xl bg-white/10 border border-white/20 backdrop-blur-md p-4 space-y-2">
              <div className="text-sm font-semibold uppercase tracking-wider opacity-90">Facilities</div>
              <FacilityRow label="Canteen" status={(settings?.canteen_status ?? "open") as Status} />
              <FacilityRow label="Clinic" status={(settings?.clinic_status ?? "open") as Status} />
            </div>
          </div>
        </section>

        {/* Right: input card */}
        <section>
          <div className="rounded-2xl bg-white/95 dark:bg-card/95 backdrop-blur-xl shadow-elegant p-6 md:p-8 border border-white/40">
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold">Tap Your Company ID</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Welcome to Nutribev Corp.
              </p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                ref={inputRef}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Enter or scan Company ID"
                className="h-16 text-2xl text-center rounded-2xl"
                autoFocus
                disabled={busy}
              />
              <Button
                type="submit"
                disabled={busy || !code.trim()}
                className="w-full h-14 rounded-2xl text-lg font-bold gradient-primary text-primary-foreground shadow-elegant hover:opacity-90"
              >
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Submit"}
              </Button>
              {!inside && coords && (
                <p className="text-center text-xs text-destructive font-medium">
                  Time In/Out is disabled — you are outside company premises.
                </p>
              )}
            </form>
          </div>
          <p className="mt-4 text-center text-xs text-primary-foreground/85">
            Need an account? <Link to="/register" className="underline font-semibold">Register here</Link>
          </p>
        </section>
      </main>

      {/* Confirmation overlay */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm animate-fade-in p-4">
          <div className="rounded-2xl bg-card shadow-elegant border border-border p-8 md:p-10 max-w-lg w-full text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-success/15 text-success flex items-center justify-center mb-4">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <h3 className="text-2xl font-bold mb-2">
              {confirm.action === "in"
                ? `${greet()}, ${confirm.name}.`
                : `Good job today, ${confirm.name}.`}
            </h3>
            <p className="text-lg text-muted-foreground">
              You are now logged <span className="font-semibold text-foreground">{confirm.action === "in" ? "IN" : "OUT"}</span> at {confirm.time}.
            </p>
          </div>
        </div>
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

function toIso(localPHDate: string): string {
  // Input from formatPH "MM/DD/YYYY" or "YYYY-MM-DD" — normalize
  if (/^\d{4}-\d{2}-\d{2}$/.test(localPHDate)) return localPHDate;
  const [m, d, y] = localPHDate.split("/");
  return `${y}-${m}-${d}`;
}
