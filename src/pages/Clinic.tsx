import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase, type ClinicRequest } from "@/lib/supabase";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Stethoscope, Plus } from "lucide-react";
import { format } from "date-fns";

export default function Clinic() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<ClinicRequest[]>([]);
  const [form, setForm] = useState({ medicine: "", pickup_time: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!profile) return;
    const { data } = await supabase.from("clinic_requests").select("*")
      .eq("company_id", profile.company_id).order("created_at", { ascending: false });
    setRows((data as ClinicRequest[]) ?? []);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [profile]);

  const submit = async () => {
    if (!profile) return;
    if (!form.medicine.trim()) { toast.error("Please enter a medicine."); return; }
    setSaving(true);
    const { error } = await supabase.from("clinic_requests").insert({
      company_id: profile.company_id,
      employee_name: profile.full_name,
      medicine: form.medicine.trim(),
      pickup_time: form.pickup_time || null,
      notes: form.notes.trim() || null,
      status: "pending",
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Request submitted.");
    setForm({ medicine: "", pickup_time: "", notes: "" });
    load();
  };

  if (!profile) return null;

  return (
    <div className="min-h-screen gradient-subtle">
      <AppHeader />
      <main className="container py-8 space-y-6 max-w-3xl">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Stethoscope className="h-7 w-7 text-primary" /> Clinic</h1>
          <p className="text-muted-foreground">Request medicine and track status.</p>
        </div>

        <div className="rounded-2xl bg-card border border-border shadow-soft p-6 space-y-4">
          <h2 className="font-bold">New Request</h2>
          <div className="space-y-1.5"><Label>Medicine *</Label><Input value={form.medicine} onChange={e => setForm({ ...form, medicine: e.target.value })} placeholder="e.g. Paracetamol 500mg" /></div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Preferred pickup time</Label><Input type="datetime-local" value={form.pickup_time} onChange={e => setForm({ ...form, pickup_time: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5"><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} /></div>
          <Button onClick={submit} disabled={saving} className="rounded-xl gradient-primary text-primary-foreground"><Plus className="h-4 w-4 mr-2" />{saving ? "Submitting…" : "Submit Request"}</Button>
        </div>

        <div className="rounded-2xl bg-card border border-border shadow-soft p-6">
          <h2 className="font-bold mb-4">My Requests</h2>
          <div className="space-y-3">
            {rows.length === 0 && <p className="text-muted-foreground text-sm">No requests yet.</p>}
            {rows.map(r => (
              <div key={r.id} className="rounded-xl border border-border p-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold">{r.medicine}</div>
                  <div className="text-xs text-muted-foreground">
                    Requested {format(new Date(r.created_at), "PPp")}
                    {r.pickup_time && ` · Pickup ${format(new Date(r.pickup_time), "PPp")}`}
                  </div>
                  {r.notes && <div className="text-sm mt-1">{r.notes}</div>}
                </div>
                <StatusBadge status={r.status} />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: ClinicRequest["status"] }) {
  const map: Record<ClinicRequest["status"], string> = {
    pending: "bg-muted text-muted-foreground",
    available: "bg-success/15 text-success border border-success/30",
    follow_up: "bg-warning/20 text-foreground border border-warning/40",
  };
  const label = status === "follow_up" ? "To Follow Up" : status === "available" ? "Available" : "Pending";
  return <Badge className={`rounded-lg ${map[status]} capitalize`}>{label}</Badge>;
}
