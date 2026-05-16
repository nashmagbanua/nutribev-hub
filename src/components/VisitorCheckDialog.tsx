/**
 * VisitorCheckDialog.tsx
 * ──────────────────────
 * Triggered by kiosk code "1111".
 * Guard types a visitor's pass code to look up their record,
 * confirm their identity, and optionally record time-out.
 */

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input }  from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge }  from "@/components/ui/badge";
import { supabase, formatPH, type Visitor } from "@/lib/supabase";
import { toast } from "sonner";
import {
  Search, Ticket, User, Users, Building2, Target,
  UserCheck, Clock, LogOut, CheckCircle2, XCircle,
} from "lucide-react";

export function VisitorCheckDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [query, setQuery]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [visitor, setVisitor]   = useState<Visitor | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  const reset = () => {
    setQuery(""); setVisitor(null); setNotFound(false); setTimedOut(false);
  };

  const handleClose = (v: boolean) => {
    onOpenChange(v);
    if (!v) reset();
  };

  // Look up visitor by pass code
  const search = async () => {
    const code = query.trim().toUpperCase();
    if (!code) return;
    setLoading(true); setVisitor(null); setNotFound(false);

    const { data, error } = await supabase
      .from("visitors")
      .select("*")
      .eq("pass_code", code)
      .order("time_in", { ascending: false })
      .limit(1)
      .maybeSingle();

    setLoading(false);
    if (error) { toast.error(error.message); return; }
    if (!data)  { setNotFound(true); return; }
    setVisitor(data as Visitor);
  };

  // Record time-out for the visitor
  const recordTimeOut = async () => {
    if (!visitor) return;
    setSigningOut(true);
    const { error } = await supabase
      .from("visitors")
      .update({ time_out: new Date().toISOString() })
      .eq("id", visitor.id);
    setSigningOut(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Visitor time-out recorded ✓");
    setTimedOut(true);
    setVisitor({ ...visitor, time_out: new Date().toISOString() });
    setTimeout(() => { handleClose(false); }, 3000);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="rounded-2xl max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5 text-primary" /> Visitor Pass Lookup
          </DialogTitle>
        </DialogHeader>

        {/* ── Search input ─────────────────────────────────────────────── */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Ticket className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="Enter pass code e.g. V-2847"
              className="rounded-xl pl-9 font-mono tracking-widest text-base"
              maxLength={6}
              autoFocus
            />
          </div>
          <Button
            onClick={search}
            disabled={loading || !query.trim()}
            className="rounded-xl gradient-primary text-primary-foreground"
          >
            {loading ? (
              <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* ── Not found ────────────────────────────────────────────────── */}
        {notFound && (
          <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-4 flex items-center gap-3">
            <XCircle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="font-semibold text-sm">Pass code not found</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Check the code and try again, or ask the visitor to show their pass.
              </p>
            </div>
          </div>
        )}

        {/* ── Visitor record ────────────────────────────────────────────── */}
        {visitor && (
          <div className="space-y-4">

            {/* Pass code badge */}
            <div className="flex items-center justify-between">
              <div className="text-3xl font-extrabold font-mono tracking-widest text-primary">
                {visitor.pass_code}
              </div>
              <Badge
                className={`rounded-xl px-3 py-1 text-sm font-bold ${
                  visitor.visitor_type === "group"
                    ? "bg-violet-500/15 text-violet-600 border border-violet-500/30"
                    : "bg-sky-500/15 text-sky-600 border border-sky-500/30"
                }`}
              >
                {visitor.visitor_type === "group"
                  ? <><Users className="h-3.5 w-3.5 mr-1.5" /> Group · {visitor.group_count} people</>
                  : <><User  className="h-3.5 w-3.5 mr-1.5" /> Solo Visitor</>}
              </Badge>
            </div>

            {/* Details card */}
            <div className="rounded-xl bg-muted/40 border border-border divide-y divide-border">
              <DetailRow icon={<UserCheck   className="h-4 w-4 text-primary" />} label="Name"          value={visitor.full_name} />
              <DetailRow icon={<Building2   className="h-4 w-4 text-muted-foreground" />} label="Company"   value={visitor.company ?? "—"} />
              <DetailRow icon={<Target      className="h-4 w-4 text-muted-foreground" />} label="Purpose"   value={visitor.purpose ?? "—"} />
              <DetailRow icon={<User        className="h-4 w-4 text-muted-foreground" />} label="To Visit"  value={visitor.person_to_visit ?? "—"} />
              <DetailRow icon={<Clock       className="h-4 w-4 text-emerald-500" />}      label="Time In"   value={formatPH(visitor.time_in, { timeStyle: "short", dateStyle: "short" } as any)} />
              {visitor.time_out && (
                <DetailRow icon={<LogOut    className="h-4 w-4 text-muted-foreground" />} label="Time Out"  value={formatPH(visitor.time_out, { timeStyle: "short", dateStyle: "short" } as any)} />
              )}
            </div>

            {/* Time-out action */}
            {timedOut ? (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                <div>
                  <p className="font-semibold text-sm text-emerald-700 dark:text-emerald-400">
                    Time-out recorded!
                  </p>
                  <p className="text-xs text-muted-foreground">Closing in a moment…</p>
                </div>
              </div>
            ) : visitor.time_out ? (
              <div className="rounded-xl bg-muted/50 border border-border p-3 text-center text-sm text-muted-foreground">
                This visitor has already timed out.
              </div>
            ) : (
              <Button
                onClick={recordTimeOut}
                disabled={signingOut}
                className="w-full rounded-xl h-11 font-bold"
                variant="outline"
              >
                {signingOut ? (
                  "Recording…"
                ) : (
                  <span className="flex items-center gap-2">
                    <LogOut className="h-4 w-4" /> Record Time-Out
                  </span>
                )}
              </Button>
            )}
          </div>
        )}

        <div className="text-center">
          <button
            onClick={() => handleClose(false)}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <span className="shrink-0">{icon}</span>
      <span className="text-xs text-muted-foreground w-16 shrink-0">{label}</span>
      <span className="text-sm font-medium truncate">{value}</span>
    </div>
  );
}
