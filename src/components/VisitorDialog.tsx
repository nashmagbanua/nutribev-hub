import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { UserPlus, CheckCircle2 } from "lucide-react";

export function VisitorDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [form, setForm] = useState({ full_name: "", company: "", purpose: "", person_to_visit: "" });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const reset = () => { setForm({ full_name: "", company: "", purpose: "", person_to_visit: "" }); setSuccess(false); };

  const submit = async () => {
    if (!form.full_name.trim()) { toast.error("Full name is required"); return; }
    setSaving(true);
    const { error } = await supabase.from("visitors").insert({
      full_name: form.full_name.trim(),
      company: form.company.trim() || null,
      purpose: form.purpose.trim() || null,
      person_to_visit: form.person_to_visit.trim() || null,
      time_in: new Date().toISOString(),
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setSuccess(true);
    setTimeout(() => { onOpenChange(false); reset(); }, 2200);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="rounded-2xl">
        {success ? (
          <div className="py-10 text-center space-y-3">
            <CheckCircle2 className="h-16 w-16 text-success mx-auto" />
            <h3 className="text-2xl font-bold">Welcome!</h3>
            <p className="text-muted-foreground">Your visit has been recorded.</p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5 text-primary" /> Visitor Sign-In</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5"><Label>Full name *</Label><Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Company</Label><Input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Purpose</Label><Input value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })} placeholder="Meeting, delivery, etc." /></div>
              <div className="space-y-1.5"><Label>Person to visit</Label><Input value={form.person_to_visit} onChange={e => setForm({ ...form, person_to_visit: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancel</Button>
              <Button onClick={submit} disabled={saving} className="rounded-xl gradient-primary text-primary-foreground">{saving ? "Saving…" : "Submit"}</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
