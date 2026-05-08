import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase, formatPH, lastNameOf, phDateKey, type AttendanceRow, type Profile } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CalendarCheck, Loader2 } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function AttendanceList() {
  const [date, setDate] = useState<string>(() => phToday());
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [y, m, d] = date.split('-').map(Number);
        if (isNaN(y)) throw new Error("Invalid date selected");

        // Kunin ang records: Start of day hanggang +34 hours (para sa Night Shift)
        const start = new Date(Date.UTC(y, m - 1, d, -8, 0, 0)); // Offset for PH
        const end = new Date(start.getTime() + (34 * 60 * 60 * 1000));

        const [a, p] = await Promise.all([
          supabase.from("attendance")
            .select("*")
            .gte("timestamp", start.toISOString())
            .lte("timestamp", end.toISOString())
            .order("timestamp", { ascending: true }),
          supabase.from("profiles").select("id, company_id, full_name, position, role"),
        ]);

        setRows((a.data as AttendanceRow[]) ?? []);
        const map: Record<string, Profile> = {};
        ((p.data as Profile[]) ?? []).forEach(pr => { map[pr.company_id] = pr; });
        setProfiles(map);
      } catch (err) {
        console.error("Fetch error:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [date]);

  const grouped = useMemo(() => {
    const m: Record<string, { in?: AttendanceRow; out?: AttendanceRow }> = {};

    rows.forEach(r => {
      // SAFETY CHECK: Siguraduhin na valid ang timestamp bago i-process
      if (!r.timestamp || isNaN(Date.parse(r.timestamp))) return;

      try {
        if (!m[r.company_id]) m[r.company_id] = {};

        // Hanapin ang Time In para sa piniling araw
        if (r.type === "time_in") {
          if (phDateKey(r.timestamp) === date) {
            m[r.company_id].in = r;
          }
        } 
        
        // Hanapin ang Time Out na valid partner (within 16 hours)
        else if (r.type === "time_out") {
          const myIn = m[r.company_id].in;
          if (myIn) {
            const diff = (new Date(r.timestamp).getTime() - new Date(myIn.timestamp).getTime()) / (1000 * 60 * 60);
            if (diff > 0 && diff < 16) {
              m[r.company_id].out = r;
            }
          }
        }
      } catch (e) {
        console.warn("Skipping invalid row:", r);
      }
    });

    return Object.entries(m)
      .filter(([, pair]) => !!pair.in)
      .sort(([a], [b]) => {
        const an = profiles[a]?.full_name ?? a;
        const bn = profiles[b]?.full_name ?? b;
        return lastNameOf(an).localeCompare(lastNameOf(bn));
      });
  }, [rows, profiles, date]);

  return (
    <div className="min-h-screen gradient-subtle">
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-30">
        <div className="container flex items-center justify-between h-16">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to kiosk
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <main className="container py-8 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <CalendarCheck className="h-7 w-7 text-primary" /> Daily Attendance List
            </h1>
            <p className="text-muted-foreground">Philippine Time · Asia/Manila</p>
          </div>
          <div className="flex items-center gap-2">
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="rounded-xl max-w-[200px]" />
            <Button variant="outline" className="rounded-xl" onClick={() => setDate(phToday())}>Today</Button>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50">
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
                {loading && (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /> Loading records...
                    </td>
                  </tr>
                )}
                {!loading && grouped.length === 0 && (
                  <tr><td colSpan={6} className="p-12 text-center text-muted-foreground">No records for {date}.</td></tr>
                )}
                {grouped.map(([companyId, pair]) => {
                  const p = profiles[companyId];
                  return (
                    <tr key={companyId} className="border-t border-border hover:bg-muted/30">
                      <td className="p-4 font-medium">{p?.full_name ?? companyId}</td>
                      <td className="p-4 text-muted-foreground">{p?.position ?? "—"}</td>
                      <td className="p-4">{date}</td>
                      <td className="p-4 font-mono">{pair.in ? formatPH(pair.in.timestamp, { hour: '2-digit', minute: '2-digit', hour12: true }) : "—"}</td>
                      <td className="p-4 font-mono">
                        {pair.out ? (
                          formatPH(pair.out.timestamp, { hour: '2-digit', minute: '2-digit', hour12: true })
                        ) : (
                          <Badge variant="outline" className="font-normal opacity-70">Active</Badge>
                        )}
                      </td>
                      <td className="p-4">
                        {pair.in?.shift && (
                          <Badge variant={pair.in.shift === 'night' ? 'default' : 'secondary'} className="capitalize">
                            {pair.in.shift}
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

function phToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}
