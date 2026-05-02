import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase, formatPH, type AttendanceRow, type Profile } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CalendarCheck } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function AttendanceList() {
  const [date, setDate] = useState<string>(() => phToday());
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const startUtc = new Date(`${date}T00:00:00+08:00`).toISOString();
      const endUtc = new Date(`${date}T23:59:59+08:00`).toISOString();
      const [a, p] = await Promise.all([
        supabase.from("attendance").select("*").gte("timestamp", startUtc).lte("timestamp", endUtc).order("timestamp"),
        supabase.from("profiles").select("id, company_id, full_name, position, role"),
      ]);
      setRows((a.data as AttendanceRow[]) ?? []);
      const map: Record<string, Profile> = {};
      ((p.data as Profile[]) ?? []).forEach(pr => { map[pr.company_id] = pr; });
      setProfiles(map);
      setLoading(false);
    })();
  }, [date]);

  const grouped = useMemo(() => {
    const m: Record<string, { in?: AttendanceRow; out?: AttendanceRow }> = {};
    rows.forEach(r => {
      m[r.company_id] = m[r.company_id] ?? {};
      if (r.type === "time_in") m[r.company_id].in = r;
      else m[r.company_id].out = r;
    });
    return Object.entries(m);
  }, [rows]);

  return (
    <div className="min-h-screen gradient-subtle">
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-30">
        <div className="container flex items-center justify-between h-16">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to kiosk
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="container py-8 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2"><CalendarCheck className="h-7 w-7 text-primary" /> Daily Attendance List</h1>
            <p className="text-muted-foreground">Philippine Time · Asia/Manila</p>
          </div>
          <div className="flex items-center gap-2">
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="rounded-xl max-w-[200px]" />
            <Button variant="outline" className="rounded-xl" onClick={() => setDate(phToday())}>Today</Button>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-soft">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-4">Employee</th>
                <th className="p-4">Position</th>
                <th className="p-4">Date</th>
                <th className="p-4">Time In</th>
                <th className="p-4">Time Out</th>
                <th className="p-4">Shift</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Loading…</td></tr>}
              {!loading && grouped.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No records.</td></tr>}
              {grouped.map(([companyId, pair]) => {
                const p = profiles[companyId];
                const shift = pair.in?.shift;
                return (
                  <tr key={companyId} className="border-t border-border hover:bg-muted/30">
                    <td className="p-4 font-medium">{p?.full_name ?? companyId}</td>
                    <td className="p-4 text-muted-foreground">{p?.position ?? "—"}</td>
                    <td className="p-4">{date}</td>
                    <td className="p-4">{pair.in ? formatPH(pair.in.timestamp, { hour: "2-digit", minute: "2-digit", hour12: true }) : "—"}</td>
                    <td className="p-4">{pair.out ? formatPH(pair.out.timestamp, { hour: "2-digit", minute: "2-digit", hour12: true }) : "—"}</td>
                    <td className="p-4">
                      {shift ? <Badge variant="secondary" className="rounded-lg capitalize">{shift} shift</Badge> : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

function phToday(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find(p => p.type === "year")!.value;
  const m = parts.find(p => p.type === "month")!.value;
  const d = parts.find(p => p.type === "day")!.value;
  return `${y}-${m}-${d}`;
}
