import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import {
  supabase, haversineMeters, shiftFromTimeIn, formatPH, withTimeout,
  COMPANY_LAT, COMPANY_LNG, DEFAULT_RADIUS_M, type KioskSettings,
} from "@/lib/supabase";
import { toast } from "sonner";
import { Loader2, Smartphone, MapPin, ShieldCheck, LogIn, LogOut } from "lucide-react";

type Latest = { type: "time_in" | "time_out"; timestamp: string; shift?: string | null } | null;

export default function MobilePunch() {
  const { profile } = useAuth();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoErr, setGeoErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<"in" | "out" | null>(null);
  const [settings, setSettings] = useState<KioskSettings | null>(null);
  const [latest, setLatest] = useState<Latest>(null);

  useEffect(() => {
    withTimeout(supabase.from("kiosk_settings").select("*").limit(1).maybeSingle(), 8000, "Settings")
      .then(({ data }: any) => data && setSettings(data as KioskSettings))
      .catch(() => { /* ignore */ });
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

  const loadLatest = useCallback(async () => {
    if (!profile) return;
    try {
      // Isinama ang 'shift' sa select para makuha ang label ng huling Time In
      const { data } = await withTimeout(
        supabase.from("attendance").select("type, timestamp, shift")
          .eq("company_id", profile.company_id)
          .order("timestamp", { ascending: false }).limit(1),
        8000, "Attendance"
      ) as any;
      setLatest(((data ?? [])[0] as Latest) ?? null);
    } catch (e: any) { toast.error(e.message ?? "Network timeout"); }
  }, [profile]);

  useEffect(() => { loadLatest(); }, [loadLatest]);

  if (!profile) return null;

  const radius = settings?.geofence_radius_m ?? DEFAULT_RADIUS_M;
  const cLat = settings?.geofence_lat ?? COMPANY_LAT;
  const cLng = settings?.geofence_lng ?? COMPANY_LNG;
  const dist = coords ? Math.round(haversineMeters(coords.lat, coords.lng, cLat, cLng)) : null;
  const inside = dist !== null && dist <= radius;

  const shiftOpen = latest?.type === "time_in";

  const punch = async (action: "in" | "out") => {
    if (!inside) { toast.error("Outside company premises."); return; }
    if (action === "in" && shiftOpen) { toast.error("You already have an open shift. Time Out first."); return; }
    if (action === "out" && !shiftOpen) { toast.error("No open shift to Time Out from."); return; }
    
    setBusy(action);
    try {
      const ts = new Date();
      
      /**
       * LOGIC SYNC: 
       * 1. Kapag IN, check ang 15:00 (3PM) cutoff para sa Night Shift.
       * 2. Kapag OUT, kopyahin ang shift ng huling 'In' para hindi magkahiwalay sa dashboard.
       */
      const shift = action === "in" 
        ? shiftFromTimeIn(ts) 
        : (latest?.shift || null);

      await withTimeout(supabase.from("attendance").insert({
        company_id: profile.company_id,
        type: action === "in" ? "time_in" : "time_out",
        timestamp: ts.toISOString(),
        shift,
        source: "mobile_fallback",
      }), 8000, "Save");

      toast.success(action === "in" ? "TIME IN SUCCESS" : "TIME OUT SUCCESS");
      loadLatest();
    } catch (e: any) { 
      toast.error(e.message); 
    } finally { 
      setBusy(null); 
    }
  };

  return (
    <div className="min-h-screen gradient-subtle">
      <AppHeader />
      <main className="container py-8 max-w-md space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Smartphone className="h-6 w-6 text-primary" /> Mobile Time In/Out
          </h1>
          <p className="text-sm text-muted-foreground">
            Fallback when the kiosk is unavailable. Supports early night shift (3PM).
          </p>
        </div>

        <div className="rounded-2xl bg-card border border-border shadow-soft p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-primary" />
            {geoErr ? <span className="text-destructive">{geoErr}</span>
              : !coords ? <span className="text-muted-foreground">Locating…</span>
              : inside ? <span className="text-success font-semibold flex items-center gap-1"><ShieldCheck className="h-4 w-4" /> Inside premises ({dist}m)</span>
              : <span className="text-destructive font-semibold">Outside premises ({dist}m, allowed {radius}m)</span>}
          </div>

          <div className="text-sm rounded-xl bg-muted/40 p-3">
            <div className="font-semibold mb-1 text-xs text-muted-foreground uppercase tracking-wider">Current status</div>
            {latest ? (
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>Last action:</span>
                  <span className="font-mono font-bold uppercase">{latest.type.replace("_", " ")}</span>
                </div>
                <div className="flex justify-between">
                  <span>Time:</span>
                  <span className="font-semibold">{formatPH(latest.timestamp, { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit", hour12:true })}</span>
                </div>
                <div className="flex justify-between">
                  <span>Detected Shift:</span>
                  <span className="capitalize font-semibold text-primary">{latest.shift || "—"}</span>
                </div>
              </div>
            ) : <div className="text-muted-foreground">No records yet.</div>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button 
              onClick={() => punch("in")} 
              disabled={!!busy || !inside || shiftOpen}
              className="h-14 rounded-2xl text-base font-bold gradient-primary text-primary-foreground shadow-md active:scale-95 transition-transform"
            >
              {busy === "in" ? <Loader2 className="h-5 w-5 animate-spin" /> : (<><LogIn className="h-5 w-5 mr-2" /> Time In</>)}
            </Button>
            
            <Button 
              onClick={() => punch("out")} 
              disabled={!!busy || !inside || !shiftOpen}
              variant="outline"
              className="h-14 rounded-2xl text-base font-bold border-2 active:scale-95 transition-transform"
            >
              {busy === "out" ? <Loader2 className="h-5 w-5 animate-spin" /> : (<><LogOut className="h-5 w-5 mr-2" /> Time Out</>)}
            </Button>
          </div>
        </div>

        <div className="text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
            Philippine Standard Time (Asia/Manila)
          </p>
        </div>
      </main>
    </div>
  );
}
