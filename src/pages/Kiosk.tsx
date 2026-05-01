import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase, type Announcement } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, Clock, LogIn as LogInIcon, LogOut as LogOutIcon, Loader2, ShieldCheck, Megaphone } from "lucide-react";

const IDLE_MS = 10_000;

export default function Kiosk() {
  const [companyId, setCompanyId] = useState("");
  const [now, setNow] = useState(new Date());
  const [submitting, setSubmitting] = useState<null | "in" | "out">(null);
  const [idle, setIdle] = useState(false);
  const [ads, setAds] = useState<Announcement[]>([]);
  const [adIndex, setAdIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const idleTimer = useRef<number | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // load announcements
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("announcements")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false });
      setAds((data as Announcement[]) ?? []);
    })();
  }, []);

  // rotate ads
  useEffect(() => {
    if (!idle || ads.length === 0) return;
    const t = setInterval(() => setAdIndex(i => (i + 1) % ads.length), 6000);
    return () => clearInterval(t);
  }, [idle, ads.length]);

  // idle detection
  const resetIdle = () => {
    setIdle(false);
    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setIdle(true), IDLE_MS);
  };
  useEffect(() => {
    resetIdle();
    const events = ["mousemove", "keydown", "touchstart", "click"];
    events.forEach(e => window.addEventListener(e, resetIdle));
    return () => {
      events.forEach(e => window.removeEventListener(e, resetIdle));
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const punch = async (type: "time_in" | "time_out") => {
    if (!companyId.trim()) { toast.error("Enter your Company ID"); return; }
    setSubmitting(type === "time_in" ? "in" : "out");
    try {
      const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .select("company_id, full_name, is_approved")
        .eq("company_id", companyId.trim())
        .maybeSingle();
      if (pErr) throw pErr;
      if (!profile) { toast.error("Company ID not found."); return; }
      if (!profile.is_approved) { toast.error("Account not approved by HR."); return; }

      const { error } = await supabase.from("attendance").insert({
        company_id: profile.company_id,
        type,
        timestamp: new Date().toISOString(),
      });
      if (error) throw error;
      toast.success(`${type === "time_in" ? "Time In" : "Time Out"} recorded — ${profile.full_name}`);
      setCompanyId("");
      inputRef.current?.focus();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to record attendance");
    } finally {
      setSubmitting(null);
    }
  };

  const dateStr = now.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const timeStr = now.toLocaleTimeString();

  return (
    <div className="min-h-screen gradient-hero text-primary-foreground relative overflow-hidden">
      <Link to="/" className="absolute top-4 left-4 z-50 inline-flex items-center gap-2 text-sm bg-white/10 hover:bg-white/20 backdrop-blur rounded-full px-4 py-2 transition-smooth">
        <ArrowLeft className="h-4 w-4" /> Exit Kiosk
      </Link>

      {/* Idle ads overlay */}
      {idle && (
        <div className="absolute inset-0 z-40 bg-background/95 backdrop-blur-md flex flex-col animate-fade-in" onClick={resetIdle}>
          <div className="flex-1 flex items-center justify-center p-10">
            {ads.length > 0 ? (
              <AdSlide ad={ads[adIndex]} />
            ) : (
              <div className="text-center text-foreground max-w-2xl">
                <ShieldCheck className="h-20 w-20 mx-auto text-primary mb-6" />
                <h2 className="text-5xl font-extrabold mb-4">Safety First</h2>
                <p className="text-2xl text-muted-foreground">Always wear your PPE. Report hazards immediately. A safe workplace is everyone's responsibility.</p>
              </div>
            )}
          </div>
          <div className="text-center pb-8 text-muted-foreground animate-pulse-glow">Tap or move to continue</div>
        </div>
      )}

      <div className="container py-10 md:py-16 flex flex-col items-center">
        <div className="text-center mb-10">
          <div className="text-sm uppercase tracking-widest opacity-80">AB Nutribev Corp. — Attendance Kiosk</div>
          <div className="mt-4 flex items-center justify-center gap-3 text-6xl md:text-8xl font-extrabold tabular-nums">
            <Clock className="h-12 w-12 md:h-16 md:w-16 opacity-90" />
            <span>{timeStr}</span>
          </div>
          <div className="mt-2 text-xl opacity-90">{dateStr}</div>
        </div>

        <div className="w-full max-w-2xl rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-elegant p-8 md:p-10">
          <label className="block text-sm uppercase tracking-wider opacity-90 mb-3">Company ID</label>
          <Input
            ref={inputRef}
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            placeholder="Enter or scan ID"
            className="h-16 text-3xl text-center rounded-2xl bg-white text-foreground border-0 focus-visible:ring-4 focus-visible:ring-accent"
            autoFocus
          />
          <div className="grid grid-cols-2 gap-4 mt-6">
            <Button
              onClick={() => punch("time_in")}
              disabled={submitting !== null}
              className="h-20 rounded-2xl text-2xl font-bold bg-success hover:bg-success/90 text-white shadow-elegant"
            >
              {submitting === "in" ? <Loader2 className="h-7 w-7 animate-spin" /> : (<><LogInIcon className="h-7 w-7 mr-2" />Time In</>)}
            </Button>
            <Button
              onClick={() => punch("time_out")}
              disabled={submitting !== null}
              className="h-20 rounded-2xl text-2xl font-bold bg-destructive hover:bg-destructive/90 text-white shadow-elegant"
            >
              {submitting === "out" ? <Loader2 className="h-7 w-7 animate-spin" /> : (<><LogOutIcon className="h-7 w-7 mr-2" />Time Out</>)}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdSlide({ ad }: { ad: Announcement }) {
  return (
    <div key={ad.id} className="max-w-4xl text-center text-foreground animate-fade-in">
      {ad.image_url && (
        <img src={ad.image_url} alt={ad.title} className="rounded-2xl shadow-elegant max-h-[50vh] mx-auto mb-8 object-cover" />
      )}
      <div className="inline-flex items-center gap-2 text-primary mb-3"><Megaphone className="h-5 w-5" /><span className="uppercase text-sm tracking-widest">Announcement</span></div>
      <h2 className="text-5xl font-extrabold mb-4">{ad.title}</h2>
      {ad.body && <p className="text-2xl text-muted-foreground">{ad.body}</p>}
    </div>
  );
}
