/**
 * VisitorDialog.tsx
 * ─────────────────
 * Kiosk visitor sign-in dialog.
 * Triggered by kiosk code "12345".
 *
 * Features:
 *   - Solo visitor   — individual sign-in, generates pass code
 *   - Group visitor  — one rep signs in, enter group count, one shared pass code
 *   - Pass code displayed on success screen (e.g. V-2847)
 *   - Guard can look up pass by typing "1111" on kiosk (VisitorCheckDialog)
 */

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input }   from "@/components/ui/input";
import { Label }   from "@/components/ui/label";
import { Button }  from "@/components/ui/button";
import { Badge }   from "@/components/ui/badge";
import { supabase, formatPH, generatePassCode } from "@/lib/supabase";
import { toast }   from "sonner";
import {
  UserPlus, Users, User, CheckCircle2, Ticket, ChevronRight,
} from "lucide-react";

type VisitorType = "solo" | "group";

interface FormState {
  full_name:       string;
  company:         string;
  purpose:         string;
  person_to_visit: string;
  visitor_type:    VisitorType;
  group_count:     number;
}

const BLANK: FormState = {
  full_name:       "",
  company:         "",
  purpose:         "",
  person_to_visit: "",
  visitor_type:    "solo",
  group_count:     2,
};

const PURPOSES = [
  "Business Meeting",
  "Delivery / Pickup",
  "Job Interview",
  "Government / Audit",
  "Maintenance / Repair",
  "Personal Visit",
  "Other",
];

export function VisitorDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [form, setForm]         = useState<FormState>(BLANK);
  const [saving, setSaving]     = useState(false);
  const [passCode, setPassCode] = useState<string | null>(null);  // shown on success

  const reset = () => { setForm(BLANK); setPassCode(null); };

  const submit = async () => {
    if (!form.full_name.trim()) { toast.error("Full name is required."); return; }
    if (form.visitor_type === "group" && form.group_count < 2) {
      toast.error("Group must have at least 2 people."); return;
    }

    setSaving(true);
    const code = generatePassCode();

    const { error } = await supabase.from("visitors").insert({
      full_name:       form.full_name.trim(),
      company:         form.company.trim() || null,
      purpose:         form.purpose.trim() || null,
      person_to_visit: form.person_to_visit.trim() || null,
      visitor_type:    form.visitor_type,
      group_count:     form.visitor_type === "group" ? form.group_count : 1,
      pass_code:       code,
      time_in:         new Date().toISOString(),
      time_out:        null,
    });

    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setPassCode(code);

    // Auto-close after 8s
    setTimeout(() => { onOpenChange(false); reset(); }, 8000);
  };

  const handleClose = (v: boolean) => {
    onOpenChange(v);
    if (!v) reset();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="rounded-2xl max-w-md"
        aria-describedby={undefined}
      >
        {/* ── Success screen ──────────────────────────────────────────── */}
        {passCode ? (
          <SuccessScreen
            passCode={passCode}
            name={form.full_name}
            visitorType={form.visitor_type}
            groupCount={form.group_count}
          />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" /> Visitor Sign-In
              </DialogTitle>
            </DialogHeader>

            {/* ── Visitor type toggle ──────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-2">
              {(["solo", "group"] as VisitorType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm({ ...form, visitor_type: t })}
                  className={`flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition-colors ${
                    form.visitor_type === t
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {t === "solo"
                    ? <><User  className="h-4 w-4" /> Solo Visitor</>
                    : <><Users className="h-4 w-4" /> Group Visit</>}
                </button>
              ))}
            </div>

            {/* ── Group count ──────────────────────────────────────────── */}
            {form.visitor_type === "group" && (
              <div className="rounded-xl bg-muted/50 border border-border p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Users className="h-4 w-4 text-primary" />
                  Group Visitor — Representative Sign-In
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Only the group representative fills out this form.
                  One shared pass code will be issued for the entire group.
                </p>
                <div className="space-y-1.5">
                  <Label>Total people in group *</Label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, group_count: Math.max(2, f.group_count - 1) }))}
                      className="h-9 w-9 rounded-xl border border-border flex items-center justify-center text-lg font-bold hover:bg-muted transition-colors"
                    >−</button>
                    <span className="text-2xl font-extrabold tabular-nums w-10 text-center">
                      {form.group_count}
                    </span>
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, group_count: Math.min(99, f.group_count + 1) }))}
                      className="h-9 w-9 rounded-xl border border-border flex items-center justify-center text-lg font-bold hover:bg-muted transition-colors"
                    >+</button>
                    <span className="text-sm text-muted-foreground">people</span>
                  </div>
                </div>
              </div>
            )}

            {/* ── Form fields ──────────────────────────────────────────── */}
            <div className="space-y-3">
              <Field label={form.visitor_type === "group" ? "Representative Full Name *" : "Full Name *"}>
                <Input
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="Juan dela Cruz"
                  className="rounded-xl"
                />
              </Field>

              <Field label="Company / Organization">
                <Input
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  placeholder="ABC Corp., Government, etc."
                  className="rounded-xl"
                />
              </Field>

              <Field label="Purpose of Visit">
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {PURPOSES.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setForm({ ...form, purpose: p })}
                      className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                        form.purpose === p
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <Input
                  value={form.purpose}
                  onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                  placeholder="Or type custom purpose…"
                  className="rounded-xl"
                />
              </Field>

              <Field label="Person to Visit">
                <Input
                  value={form.person_to_visit}
                  onChange={(e) => setForm({ ...form, person_to_visit: e.target.value })}
                  placeholder="Employee name or department"
                  className="rounded-xl"
                />
              </Field>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => handleClose(false)}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                onClick={submit}
                disabled={saving}
                className="rounded-xl gradient-primary text-primary-foreground"
              >
                {saving ? "Saving…" : (
                  <span className="flex items-center gap-1.5">
                    Get Pass Code <ChevronRight className="h-4 w-4" />
                  </span>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Success screen with pass code ────────────────────────────────────────────
function SuccessScreen({
  passCode,
  name,
  visitorType,
  groupCount,
}: {
  passCode:    string;
  name:        string;
  visitorType: VisitorType;
  groupCount:  number;
}) {
  return (
    <div className="py-6 text-center space-y-5">
      <CheckCircle2 className="h-14 w-14 text-emerald-500 mx-auto" />

      <div>
        <h3 className="text-2xl font-extrabold">Welcome!</h3>
        <p className="text-muted-foreground mt-1">
          {visitorType === "group"
            ? `Group of ${groupCount} — ${name} (rep)`
            : name}
        </p>
      </div>

      {/* Pass code card */}
      <div className="rounded-2xl bg-primary/5 border-2 border-primary/30 p-5 space-y-2 mx-4">
        <div className="flex items-center justify-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
          <Ticket className="h-3.5 w-3.5" />
          Your Visitor Pass Code
        </div>
        <div className="text-5xl font-extrabold tracking-widest text-primary font-mono">
          {passCode}
        </div>
        {visitorType === "group" && (
          <Badge variant="secondary" className="rounded-full">
            <Users className="h-3 w-3 mr-1" />
            Group · {groupCount} people
          </Badge>
        )}
      </div>

      <div className="rounded-xl bg-muted/50 px-4 py-3 mx-4 text-sm text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">Keep this code with you.</p>
        <p className="text-xs">
          Show this code to the guard when you leave.
          It will be used to record your time out.
        </p>
      </div>

      <p className="text-xs text-muted-foreground">
        This screen will close in a few seconds…
      </p>
    </div>
  );
}

// ─── Small helper ─────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
