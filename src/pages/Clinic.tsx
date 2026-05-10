import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase, formatPH, type ClinicRequest, type KioskSettings } from "@/lib/supabase";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Stethoscope, Plus, Clock, CheckCircle2, AlertCircle,
  ClipboardList, X, Pill, ThumbsUp,
} from "lucide-react";

// ─── Common medicines quick-select ────────────────────────────────────────────
const QUICK_MEDICINES = [
  "Paracetamol 500mg",
  "Mefenamic Acid 500mg",
  "Biogesic",
  "Ibuprofen 200mg",
  "Antacid",
  "Antihistamine",
  "Loperamide",
  "Oral Rehydration Salt",
  "Vitamin C",
  "Omeprazole",
];

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<
  ClinicRequest["status"],
  { label: string; className: string; icon: React.ReactNode }
> = {
  pending:   { label: "Pending",      className: "bg-muted text-muted-foreground border border-border",          icon: <Clock        className="h-3 w-3" /> },
  available: { label: "Ready",        className: "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30", icon: <CheckCircle2 className="h-3 w-3" /> },
  follow_up: { label: "Follow Up",    className: "bg-warning/20 text-foreground border border-warning/40",       icon: <AlertCircle  className="h-3 w-3" /> },
  picked_up: { label: "Picked Up",    className: "bg-primary/15 text-primary border border-primary/30",          icon: <ThumbsUp     className="h-3 w-3" /> },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function phFmt(iso: string) {
  return formatPH(iso, { dateStyle: "medium", timeStyle: "short" } as any);
}

function phMinDatetime() {
  // Returns current PH time as a datetime-local min string
  const now = new Date();
  const ph  = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${ph.getFullYear()}-${pad(ph.getMonth() + 1)}-${pad(ph.getDate())}T${pad(ph.getHours())}:${pad(ph.getMinutes())}`;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function Clinic() {
  const { profile } = useAuth();
  const [rows, setRows]   = useState<ClinicRequest[]>([]);
  const [clinicStatus, setClinicStatus] = useState<KioskSettings["clinic_status"] | null>(null);
  const [form, setForm]   = useState({
    medicine:    "",
    symptoms:    "",
    notes:       "",
    pickup_time: "",
  });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!profile) return;
    const [req, cfg] = await Promise.all([
      supabase
        .from("clinic_requests")
        .select("*")
        .eq("company_id", profile.company_id)
        .order("created_at", { ascending: false }),
      supabase.from("kiosk_settings").select("clinic_status").limit(1).maybeSingle(),
    ]);
    setRows((req.data as ClinicRequest[]) ?? []);
    setClinicStatus((cfg.data as any)?.clinic_status ?? null);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [profile]);

  // ── Submit ────────────────────────────────────────────────────────────────
  const submit = async () => {
    if (!profile) return;
    if (!form.medicine.trim()) { toast.error("Please enter or select a medicine."); return; }
    if (!form.symptoms.trim()) { toast.error("Please describe your symptoms or reason."); return; }

    // Validate pickup time is not in the past
    if (form.pickup_time) {
      const picked = new Date(form.pickup_time);
      if (picked < new Date()) { toast.error("Pickup time cannot be in the past."); return; }
    }

    setSaving(true);
    const { error } = await supabase.from("clinic_requests").insert({
      company_id:    profile.company_id,
      employee_name: profile.full_name,
      medicine:      form.medicine.trim(),
      symptoms:      form.symptoms.trim(),
      notes:         form.notes.trim() || null,
      pickup_time:   form.pickup_time || null,
      status:        "pending",
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Request submitted — the nurse will prepare your medicine.");
    setForm({ medicine: "", symptoms: "", notes: "", pickup_time: "" });
    load();
  };

  // ── Cancel ────────────────────────────────────────────────────────────────
  const cancel = async (id: string) => {
    if (!confirm("Cancel this request?")) return;
    const { error } = await supabase.from("clinic_requests").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Request cancelled.");
    load();
  };

  if (!profile) return null;

  // Split into active vs history
  const active  = rows.filter(r => r.status !== "picked_up");
  const history = rows.filter(r => r.status === "picked_up");

  // Alert banner: any ready requests
  const readyReqs    = active.filter(r => r.status === "available");
  const followUpReqs = active.filter(r => r.status === "follow_up");

  // Summary counts
  const counts = {
    pending:   rows.filter(r => r.status === "pending").length,
    available: rows.filter(r => r.status === "available").length,
    picked_up: rows.filter(r => r.status === "picked_up").length,
  };

  return (
    <div className="min-h-screen gradient-subtle">
      <AppHeader />
      <main className="container py-8 space-y-6 max-w-3xl">

        {/* Page title */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Stethoscope className="h-7 w-7 text-primary" /> Clinic
          </h1>
          <p className="text-muted-foreground">Request medicine and track pickup status.</p>
        </div>

        {/* Clinic status pill */}
        {clinicStatus && (
          <div className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium border ${
            clinicStatus === "open"
              ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
              : clinicStatus === "holiday"
              ? "bg-warning/20 text-foreground border-warning/40"
              : "bg-destructive/15 text-destructive border-destructive/30"
          }`}>
            <span className={`h-2 w-2 rounded-full ${clinicStatus === "open" ? "bg-emerald-500" : clinicStatus === "holiday" ? "bg-warning" : "bg-destructive"}`} />
            Clinic is {clinicStatus === "open" ? "Open" : clinicStatus === "holiday" ? "Holiday" : "Closed"}
          </div>
        )}

        {/* Alert banners */}
        {readyReqs.length > 0 && (
          <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 px-5 py-4 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                {readyReqs.length === 1 ? "Your medicine is ready for pickup!" : `${readyReqs.length} medicines are ready for pickup!`}
              </p>
              <p className="text-sm text-emerald-600 dark:text-emerald-500 mt-0.5">
                {readyReqs.map(r => r.medicine).join(", ")}
              </p>
            </div>
          </div>
        )}
        {followUpReqs.length > 0 && (
          <div className="rounded-2xl bg-warning/10 border border-warning/30 px-5 py-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Follow-up needed</p>
              <p className="text-sm text-muted-foreground mt-0.5">Please visit the clinic regarding: {followUpReqs.map(r => r.medicine).join(", ")}</p>
            </div>
          </div>
        )}

        {/* Summary stats */}
        {rows.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <StatPill icon={<Clock className="h-4 w-4 text-muted-foreground" />}       label="Pending"   value={counts.pending}   />
            <StatPill icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}     label="Ready"     value={counts.available} color="text-emerald-600" />
            <StatPill icon={<ThumbsUp className="h-4 w-4 text-primary" />}             label="Picked Up" value={counts.picked_up} color="text-primary" />
          </div>
        )}

        {/* ── Request form ──────────────────────────────────────────────── */}
        <div className="rounded-2xl bg-card border border-border shadow-soft p-6 space-y-5">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" /> New Request
          </h2>

          {/* Medicine */}
          <div className="space-y-2">
            <Label>Medicine *</Label>
            <Input
              value={form.medicine}
              onChange={e => setForm({ ...form, medicine: e.target.value })}
              placeholder="e.g. Paracetamol 500mg, Mefenamic Acid…"
              className="rounded-xl"
            />
            {/* Quick-select chips */}
            <div className="flex flex-wrap gap-2 pt-1">
              {QUICK_MEDICINES.map(med => (
                <button
                  key={med}
                  type="button"
                  onClick={() => setForm({ ...form, medicine: med })}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    form.medicine === med
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/60 text-muted-foreground border-border hover:border-primary hover:text-foreground"
                  }`}
                >
                  <Pill className="h-3 w-3" />{med}
                </button>
              ))}
            </div>
          </div>

          {/* Symptoms / Reason — required */}
          <div className="space-y-1.5">
            <Label>Symptoms / Reason *</Label>
            <Textarea
              value={form.symptoms}
              onChange={e => setForm({ ...form, symptoms: e.target.value })}
              placeholder="Describe your symptoms or reason for requesting this medicine.&#10;e.g. Headache since this morning, mild fever, stomachache after meal…"
              rows={3}
              className="rounded-xl resize-none"
            />
          </div>

          {/* Pickup time + Additional notes */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Preferred Pickup Time</Label>
              <Input
                type="datetime-local"
                value={form.pickup_time}
                min={phMinDatetime()}
                onChange={e => setForm({ ...form, pickup_time: e.target.value })}
                className="rounded-xl"
              />
              <p className="text-xs text-muted-foreground">Leave blank if anytime is fine.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Additional Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="Any allergies, dosage preference, etc."
                rows={3}
                className="rounded-xl resize-none"
              />
            </div>
          </div>

          <Button
            onClick={submit}
            disabled={saving || clinicStatus === "closed"}
            className="rounded-xl gradient-primary text-primary-foreground w-full sm:w-auto"
          >
            <Plus className="h-4 w-4 mr-2" />
            {saving ? "Submitting…" : "Submit Request"}
          </Button>
          {clinicStatus === "closed" && (
            <p className="text-xs text-destructive">The clinic is currently closed. Requests cannot be submitted.</p>
          )}
        </div>

        {/* ── Active requests ───────────────────────────────────────────── */}
        <div className="rounded-2xl bg-card border border-border shadow-soft p-6">
          <h2 className="font-bold text-lg flex items-center gap-2 mb-4">
            <ClipboardList className="h-5 w-5 text-primary" /> Active Requests
          </h2>
          <div className="space-y-3">
            {active.length === 0 && (
              <div className="flex flex-col items-center py-8 text-muted-foreground gap-2">
                <Stethoscope className="h-10 w-10 opacity-30" />
                <p className="text-sm">No active requests.</p>
              </div>
            )}
            {active.map(r => (
              <RequestCard key={r.id} r={r} onCancel={r.status === "pending" ? () => cancel(r.id) : undefined} />
            ))}
          </div>
        </div>

        {/* ── History ───────────────────────────────────────────────────── */}
        {history.length > 0 && (
          <div className="rounded-2xl bg-card border border-border shadow-soft p-6">
            <h2 className="font-bold text-lg flex items-center gap-2 mb-4">
              <ThumbsUp className="h-5 w-5 text-primary" /> Pickup History
            </h2>
            <div className="space-y-3 opacity-75">
              {history.map(r => (
                <RequestCard key={r.id} r={r} />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ─── RequestCard ──────────────────────────────────────────────────────────────
function RequestCard({ r, onCancel }: { r: ClinicRequest; onCancel?: () => void }) {
  const cfg = STATUS_CONFIG[r.status];
  return (
    <div className={`rounded-xl border p-4 flex items-start justify-between gap-3 transition-colors ${
      r.status === "available" ? "border-emerald-500/40 bg-emerald-500/5" :
      r.status === "follow_up" ? "border-warning/40 bg-warning/5" :
      "border-border"
    }`}>
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold">{r.medicine}</span>
          <Badge className={`rounded-lg text-xs flex items-center gap-1 ${cfg.className}`}>
            {cfg.icon}{cfg.label}
          </Badge>
        </div>

        {/* Symptoms */}
        {(r as any).symptoms && (
          <p className="text-sm text-foreground/80">
            <span className="font-medium text-xs text-muted-foreground uppercase tracking-wide mr-1">Symptoms:</span>
            {(r as any).symptoms}
          </p>
        )}

        {/* Notes */}
        {r.notes && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-xs uppercase tracking-wide mr-1">Notes:</span>
            {r.notes}
          </p>
        )}

        <div className="text-xs text-muted-foreground space-y-0.5 pt-1">
          <div>Requested: {phFmt(r.created_at)}</div>
          {r.pickup_time && <div>Preferred pickup: {phFmt(r.pickup_time)}</div>}
          {r.picked_up_at && <div>Picked up: {phFmt(r.picked_up_at)}</div>}
        </div>
      </div>

      {/* Cancel button — only for pending */}
      {onCancel && (
        <button
          onClick={onCancel}
          className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          title="Cancel request"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

// ─── StatPill ─────────────────────────────────────────────────────────────────
function StatPill({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3 shadow-soft">
      {icon}
      <div>
        <div className={`text-2xl font-extrabold tabular-nums leading-none ${color ?? "text-foreground"}`}>{value}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
      </div>
    </div>
  );
}
