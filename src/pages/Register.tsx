import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  supabase, DEFAULT_AREA_CODES,
  SYSTEM_ROLES, JOB_POSITIONS, DEPARTMENTS,
  type SystemRole, type JobPosition, type Department,
} from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ThemeToggle } from "@/components/ThemeToggle";
import { toast } from "sonner";
import { ArrowLeft, Loader2, UserPlus } from "lucide-react";

export default function Register() {
  const [form, setForm] = useState({
    company_id: "",
    full_name: "",
    email: "",
    dob: "",
    password: "",
    confirm: "",
    area_name: "",
    system_role: "" as SystemRole | "",
    job_position: "" as JobPosition | "",
    department: "" as Department | "",
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.company_id || !form.full_name || !form.password) {
      toast.error("Company ID, full name and password are required."); return;
    }
    if (!form.area_name) { toast.error("Please select your Area."); return; }
    if (!form.system_role) { toast.error("Please select your Role."); return; }
    if (!form.job_position) { toast.error("Please select your Position."); return; }
    if (!form.department) { toast.error("Please select your Department."); return; }
    if (form.password.length < 6) { toast.error("Password must be at least 6 characters."); return; }
    if (form.password !== form.confirm) { toast.error("Passwords do not match."); return; }
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) { toast.error("Invalid email."); return; }

    const areaCode = DEFAULT_AREA_CODES.find(a => a.name === form.area_name)?.code ?? null;
    // area_name is now the human-readable name from DEFAULT_AREA_CODES (e.g. "HR & Admin")

    setLoading(true);
    try {
      const { data: existing } = await supabase
        .from("profiles").select("id").eq("company_id", form.company_id.trim()).maybeSingle();
      if (existing) { toast.error("That Company ID is already registered."); setLoading(false); return; }

      const { error } = await supabase.from("profiles").insert({
        company_id: form.company_id.trim(),
        full_name: form.full_name.trim(),
        email: form.email.trim() || null,
        position: form.job_position,            // legacy mirror (human-readable slug)
        job_position: form.job_position,
        department: form.department,
        dob: form.dob || null,
        password: form.password,
        avatar_url: "",
        role: ({"hr_admin":"HR","manager":"Manager","supervisor":"Supervisor","nurse":"Nurse","safety_officer":"Safety Officer"} as Record<string,string>)[form.system_role] ?? "Employee", // legacy mirror
        system_role: form.system_role,
        is_approved: false,
        area_code: areaCode,
      });
      if (error) throw error;
      toast.success("Account created — pending HR approval.");
      navigate("/login");
    } catch (err: any) {
      toast.error(err.message ?? "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen gradient-subtle flex flex-col">
      <header className="container flex h-16 items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to kiosk
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg">
          <div className="text-center mb-6">
            <div className="inline-flex h-14 w-14 rounded-2xl gradient-primary shadow-elegant items-center justify-center text-primary-foreground mb-4">
              <UserPlus className="h-6 w-6" />
            </div>
            <h1 className="text-3xl font-bold">Create your account</h1>
            <p className="text-muted-foreground mt-1">HR will review and approve your registration.</p>
          </div>
          <form onSubmit={submit} className="rounded-2xl bg-card border border-border shadow-elegant p-6 md:p-8 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Company ID *"><Input value={form.company_id} onChange={e => setForm({ ...form, company_id: e.target.value })} placeholder="ABN-001" /></Field>
              <Field label="Full Name *"><Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></Field>
              <Field label="Email"><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Field>
              <Field label="Date of Birth"><Input type="date" value={form.dob} onChange={e => setForm({ ...form, dob: e.target.value })} /></Field>

              <Field label="Role *">
                <Select value={form.system_role} onValueChange={v => setForm({ ...form, system_role: v as SystemRole })}>
                  <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                  <SelectContent>
                    {SYSTEM_ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Position *">
                <Select value={form.job_position} onValueChange={v => setForm({ ...form, job_position: v as JobPosition })}>
                  <SelectTrigger><SelectValue placeholder="Select position" /></SelectTrigger>
                  <SelectContent>
                    {JOB_POSITIONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Department *">
                <Select value={form.department} onValueChange={v => setForm({ ...form, department: v as Department })}>
                  <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Area *">
                <Select value={form.area_name} onValueChange={v => setForm({ ...form, area_name: v })}>
                  <SelectTrigger><SelectValue placeholder="Select area" /></SelectTrigger>
                  <SelectContent>
                    {DEFAULT_AREA_CODES.map(a => <SelectItem key={a.code} value={a.name}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Password *"><Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></Field>
              <Field label="Confirm Password *"><Input type="password" value={form.confirm} onChange={e => setForm({ ...form, confirm: e.target.value })} /></Field>
            </div>
            <Button disabled={loading} className="w-full h-11 rounded-xl gradient-primary text-primary-foreground hover:opacity-90 shadow-soft">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already registered? <Link to="/login" className="text-primary font-medium underline">Sign in</Link>
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
