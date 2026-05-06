import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase, uploadImage, type AttendanceRow } from "@/lib/supabase";
import { AppHeader } from "@/components/AppHeader";
import { Footer } from "@/components/Footer";
import { ChatMessenger } from "@/components/ChatMessenger";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Calendar as CalIcon, IdCard, User, Cake, Briefcase, Mail, KeyRound, Camera, MessageSquare } from "lucide-react";
import {
  startOfMonth, endOfMonth, eachDayOfInterval, format, isSameDay, isWeekend, isAfter, startOfDay,
} from "date-fns";

export default function EmployeeDashboard() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [monthCursor, setMonthCursor] = useState(new Date());

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const start = startOfMonth(monthCursor).toISOString();
      const end = endOfMonth(monthCursor).toISOString();
      const { data } = await supabase
        .from("attendance")
        .select("*")
        .eq("company_id", profile.company_id)
        .gte("timestamp", start)
        .lte("timestamp", end)
        .order("timestamp");
      setRows((data as AttendanceRow[]) ?? []);
    })();
  }, [profile, monthCursor]);

  const days = useMemo(() => eachDayOfInterval({ start: startOfMonth(monthCursor), end: endOfMonth(monthCursor) }), [monthCursor]);
  const today = startOfDay(new Date());

  const { presentDays, absentDays } = useMemo(() => {
    const present = new Set<string>();
    rows.forEach(r => present.add(format(new Date(r.timestamp), "yyyy-MM-dd")));
    const presentArr = days.filter(d => present.has(format(d, "yyyy-MM-dd")));
    const absentArr = days.filter(d => {
      if (isWeekend(d)) return false;
      if (isAfter(d, today)) return false;
      return !present.has(format(d, "yyyy-MM-dd"));
    });
    return { presentDays: presentArr, absentDays: absentArr };
  }, [rows, days, today]);

  if (!profile) return null;

  return (
    <div className="min-h-screen gradient-subtle flex flex-col">
      <AppHeader />
      <main className="container py-6 md:py-8 space-y-6 flex-1">
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="rounded-2xl">
            <TabsTrigger value="overview" className="rounded-xl">Overview</TabsTrigger>
            <TabsTrigger value="messages" className="rounded-xl"><MessageSquare className="h-4 w-4 mr-1" /> Messages</TabsTrigger>
          </TabsList>
          <TabsContent value="messages"><ChatMessenger currentId={profile.company_id} /></TabsContent>
          <TabsContent value="overview" className="space-y-6">
        <section className="grid sm:grid-cols-3 gap-4">
          <Stat label="Present" value={presentDays.length} className="bg-success/10 text-success" />
          <Stat label="Absent" value={absentDays.length} className="bg-destructive/10 text-destructive" />
          <Stat label="This Month" value={format(monthCursor, "MMMM yyyy")} small />
        </section>

        {/* Calendar */}
        <section className="rounded-2xl bg-card border border-border shadow-soft p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <CalIcon className="h-5 w-5 text-primary" />
              <h3 className="font-bold text-lg">Attendance — {format(monthCursor, "MMMM yyyy")}</h3>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))} className="px-3 py-1 rounded-lg border border-border hover:bg-muted text-sm">‹ Prev</button>
              <button onClick={() => setMonthCursor(new Date())} className="px-3 py-1 rounded-lg border border-border hover:bg-muted text-sm">Today</button>
              <button onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))} className="px-3 py-1 rounded-lg border border-border hover:bg-muted text-sm">Next ›</button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-2 text-center text-xs uppercase text-muted-foreground mb-2">
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => <div key={d}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: startOfMonth(monthCursor).getDay() }).map((_, i) => <div key={`pad-${i}`} />)}
            {days.map(d => {
              const isPresent = presentDays.some(p => isSameDay(p, d));
              const isAbsent = absentDays.some(a => isSameDay(a, d));
              const isToday = isSameDay(d, today);
              return (
                <div key={d.toISOString()}
                  className={`aspect-square rounded-xl flex items-center justify-center text-sm font-medium border transition-smooth
                    ${isPresent ? "bg-success/15 text-success border-success/30" :
                      isAbsent ? "bg-destructive/10 text-destructive border-destructive/30" :
                      "bg-muted/40 text-muted-foreground border-transparent"}
                    ${isToday ? "ring-2 ring-primary" : ""}`}
                >
                  {format(d, "d")}
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-4 mt-6 text-xs text-muted-foreground">
            <Legend color="bg-success/40" label="Present" />
            <Legend color="bg-destructive/40" label="Absent" />
            <Legend color="ring-2 ring-primary" label="Today" outline />
          </div>
        </section>
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
}

function AvatarUpload({ companyId }: { companyId: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const onPick = async (file: File | null) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("File too large (max 5MB before compression)."); return; }
    setBusy(true);
    try {
      const url = await uploadImage("uploads", `avatars/${companyId}.jpg`, file, { maxWidth: 400, targetBytes: 200 * 1024 });
      const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("company_id", companyId);
      if (error) throw error;
      toast.success("Profile picture updated. Refresh to see changes.");
    } catch (e: any) { toast.error(e.message ?? "Upload failed"); }
    finally { setBusy(false); }
  };
  return (
    <>
      <input ref={ref} type="file" accept="image/*" capture="user" className="hidden" onChange={e => onPick(e.target.files?.[0] ?? null)} />
      <Button size="icon" className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full gradient-primary text-primary-foreground shadow-soft" disabled={busy} onClick={() => ref.current?.click()}>
        <Camera className="h-4 w-4" />
      </Button>
    </>
  );
}


function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40">
      <div className="text-primary">{icon}</div>
      <div className="flex-1 flex justify-between gap-3 min-w-0">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium truncate">{value}</span>
      </div>
    </div>
  );
}
function Stat({ label, value, className = "", small = false }: { label: string; value: any; className?: string; small?: boolean }) {
  return (
    <div className={`rounded-2xl bg-card border border-border shadow-soft p-6 ${className}`}>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className={small ? "text-xl font-bold mt-2" : "text-4xl font-extrabold mt-2"}>{value}</div>
    </div>
  );
}
function Legend({ color, label, outline }: { color: string; label: string; outline?: boolean }) {
  return <div className="flex items-center gap-2"><div className={`h-4 w-4 rounded ${outline ? "" : color} ${outline ? color : ""}`} />{label}</div>;
}

function ChangePasswordDialog({ companyId }: { companyId: string }) {
  const [open, setOpen] = useState(false);
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (newPw.length < 6) { toast.error("New password must be at least 6 characters."); return; }
    if (newPw !== confirm) { toast.error("Passwords do not match."); return; }
    setSaving(true);
    const { data, error } = await supabase.from("profiles").select("id").eq("company_id", companyId).eq("password", oldPw).maybeSingle();
    if (error || !data) { toast.error("Current password incorrect."); setSaving(false); return; }
    const { error: uErr } = await supabase.from("profiles").update({ password: newPw }).eq("id", data.id);
    setSaving(false);
    if (uErr) { toast.error(uErr.message); return; }
    toast.success("Password updated.");
    setOpen(false); setOldPw(""); setNewPw(""); setConfirm("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-xl flex-1"><KeyRound className="h-4 w-4 mr-2" />Change Password</Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl">
        <DialogHeader><DialogTitle>Change Password</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Current password</Label><Input type="password" value={oldPw} onChange={e => setOldPw(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>New password</Label><Input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Confirm new password</Label><Input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl">Cancel</Button>
          <Button onClick={submit} disabled={saving} className="rounded-xl gradient-primary text-primary-foreground">{saving ? "Saving…" : "Update"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UpdateEmailDialog({ companyId, current }: { companyId: string; current: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(current);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (email && !/^\S+@\S+\.\S+$/.test(email)) { toast.error("Invalid email."); return; }
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ email: email || null }).eq("company_id", companyId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Email updated. Please log in again to refresh.");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-xl flex-1"><Mail className="h-4 w-4 mr-2" />Email</Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl">
        <DialogHeader><DialogTitle>Link Email Address</DialogTitle></DialogHeader>
        <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl">Cancel</Button>
          <Button onClick={submit} disabled={saving} className="rounded-xl gradient-primary text-primary-foreground">{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
