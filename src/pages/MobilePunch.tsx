import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { supabase, haversineMeters, shiftFromTimeIn, formatPH, phDateKey, COMPANY_LAT, COMPANY_LNG, DEFAULT_RADIUS_M, type KioskSettings } from "@/lib/supabase";
import { toast } from "sonner";
import { Loader2, Smartphone, MapPin, ShieldCheck } from "lucide-react";

export default function MobilePunch() {
  const { profile } = useAuth();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoErr, setGeoErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState<KioskSettings | null>(null);
  const [todayLogs, setTodayLogs] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("kiosk_settings").select("*").limit(1).maybeSingle();
      if (data) setSettings(data as KioskSettings);
    })();
  }, []);

  useEffect(() => {
    if (!("geolocation" in navigator)) { setGeoErr("Geolocation not supported."); return; }
    const w = navigator.geolocation.watchPosition(
      (p) => { setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }); setGeoErr(null); },
      (e) => setGeoErr(e.message),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(w);
  }, []);

  const loadToday = async () => {
    if (!profile) return;
    const today = phDateKey();
    const startUtc = new Date(`${today}T00:00:00+08:00`).toISOString();
    const endUtc = new Date(`${today}T23:59:59+08:00`).toISOString();
    const { data } = await supabase.from("attendance").select("*")
      .eq("company_id", profile.company_id).gte("timestamp", startUtc).lte("timestamp", endUtc);
    setTodayLogs(data ?? []);
  };
  useEffect(() => { loadToday(); /* eslint-disable-next-line */ }, [profile]);

  if (!profile) return null;

  const radius = settings?.geofence_radius_m ?? DEFAULT_RADIUS_M;
  const cLat = settings?.geofence_lat ?? COMPANY_LAT;
  const cLng = settings?.geofence_lng ?? COMPANY_LNG;
  const dist = coords ? Math.round(haversineMeters(coords.lat, coords.lng, cLat, cLng)) : null;
  const inside = dist !== null && dist <= radius;
  const hasIn = todayLogs.some(r => r.type === "time_in");
  const hasOut = todayLogs.some(r => r.type === "time_out");
  const next: "in" | "out" | null = !hasIn ? "in" : !hasOut ? "out" : null;

  const punch = async () => {
    if (!next) { toast.error("Already completed today."); return; }
    if (!inside) { toast.error("Outside company premises."); return; }
    setBusy(true);
    try {
      const ts = new Date();
      const shift = next === "in" ? shiftFromTimeIn(ts) : null;
      const { error } = await supabase.from("attendance").insert({
        company_id: profile.company_id,
        type: next === "in" ? "time_in" : "time_out",
        timestamp: ts.toISOString(),
        shift,
        source: "mobile_fallback",
      });
      if (error) throw error;
      toast.success(`Time ${next.toUpperCase()} recorded (mobile fallback).`);
      loadToday();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen gradient-subtle">
      <AppHeader />
      <main className="container py-8 max-w-md space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Smartphone className="h-6 w-6 text-primary" /> Mobile Time In/Out</h1>
          <p className="text-sm text-muted-foreground">Fallback only when the kiosk is unavailable. Logs are tagged <span className="font-mono">MOBILE_FALLBACK</span>.</p>
        </div>

        <div className="rounded-2xl bg-card border border-border shadow-soft p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-primary" />
            {geoErr ? <span className="text-destructive">{geoErr}</span>
              : !coords ? <span className="text-muted-foreground">Locating…</span>
              : inside ? <span className="text-success font-semibold flex items-center gap-1"><ShieldCheck className="h-4 w-4" /> Inside premises ({dist}m)</span>
              : <span className="text-destructive font-semibold">Outside premises ({dist}m, allowed {radius}m)</span>}
          </div>

          <div className="text-sm space-y-1">
            <div>Time In: <span className="font-semibold">{todayLogs.find(l=>l.type==="time_in") ? formatPH(todayLogs.find(l=>l.type==="time_in").timestamp, { hour:"2-digit", minute:"2-digit", hour12:true }) : "—"}</span></div>
            <div>Time Out: <span className="font-semibold">{todayLogs.find(l=>l.type==="time_out") ? formatPH(todayLogs.find(l=>l.type==="time_out").timestamp, { hour:"2-digit", minute:"2-digit", hour12:true }) : "—"}</span></div>
          </div>

          <Button onClick={punch} disabled={busy || !next || !inside}
            className="w-full h-14 rounded-2xl text-lg font-bold gradient-primary text-primary-foreground">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : next ? `Time ${next.toUpperCase()}` : "Completed"}
          </Button>
        </div>
      </main>
    </div>
  );
}
