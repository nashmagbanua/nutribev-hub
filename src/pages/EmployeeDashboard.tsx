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
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Profile card */}
          <section className="rounded-2xl bg-card border border-border shadow-soft p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="relative">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={profile.avatar_url ?? undefined} loading="lazy" />
                  <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                    {profile.full_name?.split(" ").map(n => n[0]).slice(0,2).join("")}
                  </AvatarFallback>
                </Avatar>
                <AvatarUpload companyId={profile.company_id} />
              </div>
              <div>
                <h2 className="font-bold text-xl">{profile.full_name}</h2>
                <p className="text-sm text-muted-foreground">{profile.role}</p>
              </div>
            </div>
            <div className="space-y-3 text-sm">
              <Row icon={<User className="h-4 w-4" />} label="Name" value={profile.full_name} />
              <Row icon={<IdCard className="h-4 w-4" />} label="Company ID" value={profile.company_id} />
              <Row icon={<Briefcase className="h-4 w-4" />} label="Role" value={profile.role} />
              <Row icon={<Mail className="h-4 w-4" />} label="Email" value={profile.email ?? "—"} />
              <Row icon={<Cake className="h-4 w-4" />} label="Date of Birth" value={profile.dob ? format(new Date(profile.dob), "PPP") : "—"} />
            </div>
            <div className="mt-4 flex gap-2">
              <ChangePasswordDialog companyId={profile.company_id} />
              <UpdateEmailDialog companyId={profile.company_id} current={profile.email ?? ""} />
            </div>
          </section>

          {/* Summary cards */}
          <section className="lg:col-span-2 grid sm:grid-cols-3 gap-4">
            <Stat label="Present" value={presentDays.length} className="bg-success/10 text-success" />
            <Stat label="Absent" value={absentDays.length} className="bg-destructive/10 text-destructive" />
            <Stat label="This Month" value={format(monthCursor, "MMMM yyyy")} small />
          </section>
        </div>

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

function MessagesPanel({ currentId }: { currentId: string }) {
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [people, setPeople] = useState<Profile[]>([]);
  const [to, setTo] = useState("");
  const [body, setBody] = useState("");
  const load = async () => {
    const [m, p] = await Promise.all([
      supabase.from("messages").select("*").or(`to_company_id.eq.${currentId},from_company_id.eq.${currentId}`).order("created_at", { ascending: false }).limit(200),
      supabase.from("profiles").select("id, company_id, full_name, role, avatar_url, dob, is_approved").eq("is_approved", true),
    ]);
    setMsgs((m.data as Message[]) ?? []);
    setPeople(((p.data as Profile[]) ?? []).filter(x => x.company_id !== currentId));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [currentId]);
  const nameOf = (cid: string) => people.find(p => p.company_id === cid)?.full_name ?? cid;
  const send = async () => {
    if (!to || !body.trim()) { toast.error("Choose recipient and write a message."); return; }
    const { error } = await supabase.from("messages").insert({ from_company_id: currentId, to_company_id: to, body: body.trim() });
    if (error) return toast.error(error.message);
    setBody(""); toast.success("Sent"); load();
  };
  const remove = async (id: string) => { await supabase.from("messages").delete().eq("id", id); load(); };
  const unread = msgs.filter(m => m.to_company_id === currentId && !m.read).length;
  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-card border border-border shadow-soft p-4 space-y-3">
        <div className="font-semibold flex items-center gap-2"><MessageSquare className="h-4 w-4 text-primary" /> New Message {unread > 0 && <Badge className="bg-primary text-primary-foreground rounded-full">{unread} unread</Badge>}</div>
        <div className="grid sm:grid-cols-2 gap-2">
          <Select value={to} onValueChange={setTo}>
            <SelectTrigger className="rounded-xl"><SelectValue placeholder="To…" /></SelectTrigger>
            <SelectContent>{people.map(p => <SelectItem key={p.id} value={p.company_id}>{p.full_name} ({p.company_id})</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Textarea rows={2} value={body} onChange={e => setBody(e.target.value)} placeholder="Type a message…" className="rounded-xl" />
        <Button onClick={send} className="rounded-xl gradient-primary text-primary-foreground"><Send className="h-4 w-4 mr-2" /> Send</Button>
      </div>
      <div className="space-y-2 max-h-[60vh] overflow-auto">
        {msgs.length === 0 && <p className="text-muted-foreground text-sm text-center py-4">No messages yet.</p>}
        {msgs.map(m => {
          const mine = m.from_company_id === currentId;
          return (
            <div key={m.id} className={`rounded-2xl p-3 max-w-[85%] ${mine ? "ml-auto bg-primary text-primary-foreground" : "bg-card border border-border"}`}>
              <div className="text-xs opacity-80 flex justify-between gap-3">
                <span>{mine ? `To ${nameOf(m.to_company_id)}` : `From ${nameOf(m.from_company_id)}`}</span>
                <span>{format(new Date(m.created_at), "PPp")}</span>
              </div>
              <p className="mt-1 text-sm whitespace-pre-wrap">{m.body}</p>
              <div className="mt-1 text-right">
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => remove(m.id)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
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
