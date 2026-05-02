import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase, type AttendanceRow } from "@/lib/supabase";
import { AppHeader } from "@/components/AppHeader";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Calendar as CalIcon, IdCard, User, Cake, Briefcase, Mail, KeyRound } from "lucide-react";
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
    <div className="min-h-screen gradient-subtle">
      <AppHeader />
      <main className="container py-8 space-y-6">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Profile card */}
          <section className="rounded-2xl bg-card border border-border shadow-soft p-6">
            <div className="flex items-center gap-4 mb-6">
              <Avatar className="h-16 w-16">
                <AvatarImage src={profile.avatar_url ?? undefined} />
                <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                  {profile.full_name?.split(" ").map(n => n[0]).slice(0,2).join("")}
                </AvatarFallback>
              </Avatar>
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
      </main>
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
