import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase, formatPH, lastNameOf, type AttendanceRow, type Profile, type AreaCode } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CalendarCheck, Search, Download, Users, LogIn, LogOut, Sun, Moon } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function AttendanceList() {
  const [date, setDate] = useState<string>(() => phToday());
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [areaCodes, setAreaCodes] = useState<Record<string, string>>({}); // code -> name
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const startUtc = new Date(`${date}T00:00:00+08:00`).toISOString();
      const endUtc   = new Date(`${date}T23:59:59+08:00`).toISOString();
      const [a, p, ac] = await Promise.all([
        supabase.from("attendance").select("*").gte("timestamp", startUtc).lte("timestamp", endUtc).order("timestamp"),
        supabase.from("profiles").select("id, company_id, full_name, position, role, area_code"),
        supabase.from("area_codes").select("code, name").eq("active", true),
      ]);
      setRows((a.data as AttendanceRow[]) ?? []);
      const profileMap: Record<string, Profile> = {};
      ((p.data as Profile[]) ?? []).forEach(pr => { profileMap[pr.company_id] = pr; });
      setProfiles(profileMap);
      const areaMap: Record<string, string> = {};
      ((ac.data as AreaCode[]) ?? []).forEach(a => { areaMap[a.code] = a.name; });
      setAreaCodes(areaMap);
      setLoading(false);
    })();
  }, [date]);

  // Group rows: latest time_in and latest time_out per employee
  const grouped = useMemo(() => {
    const m: Record<string, { in?: AttendanceRow; out?: AttendanceRow }> = {};
    rows.forEach(r => {
      m[r.company_id] = m[r.company_id] ?? {};
      if (r.type === "time_in") {
        // Keep the EARLIEST time_in (first arrival)
        if (!m[r.company_id].in || r.timestamp < m[r.company_id].in!.timestamp)
          m[r.company_id].in = r;
      } else {
        // Keep the LATEST time_out (last departure)
        if (!m[r.company_id].out || r.timestamp > m[r.company_id].out!.timestamp)
          m[r.company_id].out = r;
      }
    });
    return Object.entries(m)
      .filter(([, p]) => !!p.in)
      .sort(([a], [b]) => {
        const an = profiles[a]?.full_name ?? a;
        const bn = profiles[b]?.full_name ?? b;
        return lastNameOf(an).localeCompare(lastNameOf(bn));
      });
  }, [rows, profiles]);

  // Search filter
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return grouped;
    return grouped.filter(([companyId, ]) => {
      const p = profiles[companyId];
      const areaName = areaCodes[p?.area_code ?? ""] ?? "";
      return (
        (p?.full_name ?? "").toLowerCase().includes(q) ||
        companyId.toLowerCase().includes(q) ||
        (p?.position ?? "").toLowerCase().includes(q) ||
        areaName.toLowerCase().includes(q)
      );
    });
  }, [grouped, search, profiles, areaCodes]);

  // Summary stats (always from full grouped, not filtered)
  const stats = useMemo(() => {
    const total   = grouped.length;
    const inside  = grouped.filter(([, p]) => !!p.in && !p.out).length;
    const out     = grouped.filter(([, p]) => !!p.out).length;
    const day     = grouped.filter(([, p]) => p.in?.shift === "day").length;
    const night   = grouped.filter(([, p]) => p.in?.shift === "night").length;
    return { total, inside, out, day, night };
  }, [grouped]);

  // CSV export of current filtered view
  const exportCSV = () => {
    const headers = ["Company ID", "Full Name", "Position", "Area", "Time In", "Time Out", "Shift", "Status"];
    const rowData = filtered.map(([companyId, pair]) => {
      const p = profiles[companyId];
      const areaName = areaCodes[p?.area_code ?? ""] ?? "—";
      const timeIn  = pair.in  ? formatPH(pair.in.timestamp,  { hour: "2-digit", minute: "2-digit", hour12: true }) : "—";
      const timeOut = pair.out ? formatPH(pair.out.timestamp, { hour: "2-digit", minute: "2-digit", hour12: true }) : "—";
      const shift   = pair.in?.shift ? `${pair.in.shift} shift` : "—";
      const status  = pair.out ? "Timed Out" : "Inside";
      return [companyId, p?.full_name ?? companyId, p?.position ?? "—", areaName, timeIn, timeOut, shift, status];
    });
    const csv = [headers, ...rowData].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `attendance-${date}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

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
        {/* Page title + date controls */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <CalendarCheck className="h-7 w-7 text-primary" /> Daily Attendance List
            </h1>
            <p className="text-muted-foreground">Philippine Time · Asia/Manila</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Input
              type="date" value={date}
              onChange={e => setDate(e.target.value)}
              className="rounded-xl max-w-[200px]"
            />
            <Button variant="outline" className="rounded-xl" onClick={() => setDate(phToday())}>Today</Button>
            <Button
              variant="outline" className="rounded-xl flex items-center gap-2"
              onClick={exportCSV} disabled={filtered.length === 0}
            >
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </div>
        </div>

        {/* Summary stats */}
        {!loading && grouped.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <StatCard icon={<Users  className="h-5 w-5 text-primary" />}    label="Total Present" value={stats.total}  color="bg-primary/10 border-primary/20" />
            <StatCard icon={<LogIn  className="h-5 w-5 text-emerald-500" />} label="Still Inside"  value={stats.inside} color="bg-emerald-500/10 border-emerald-500/20" />
            <StatCard icon={<LogOut className="h-5 w-5 text-muted-foreground" />} label="Timed Out" value={stats.out}  color="bg-muted/50 border-border" />
            <StatCard icon={<Sun    className="h-5 w-5 text-warning" />}     label="Day Shift"     value={stats.day}    color="bg-warning/10 border-warning/20" />
            <StatCard icon={<Moon   className="h-5 w-5 text-indigo-400" />}  label="Night Shift"   value={stats.night}  color="bg-indigo-500/10 border-indigo-400/20" />
          </div>
        )}

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, ID, position, area…"
            className="pl-9 rounded-xl"
          />
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-soft">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-4">Employee</th>
                <th className="p-4 hidden md:table-cell">Position</th>
                <th className="p-4 hidden sm:table-cell">Area</th>
                <th className="p-4">Time In</th>
                <th className="p-4">Time Out</th>
                <th className="p-4 hidden sm:table-cell">Shift</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">
                  {search ? "No employees match your search." : "No records for this date."}
                </td></tr>
              )}
              {filtered.map(([companyId, pair]) => {
                const p     = profiles[companyId];
                const shift = pair.in?.shift;
                const areaName = areaCodes[p?.area_code ?? ""] ?? null;
                const isInside = !!pair.in && !pair.out;
                return (
                  <tr key={companyId} className="border-t border-border hover:bg-muted/30">
                    <td className="p-4">
                      <div className="font-medium">{p?.full_name ?? companyId}</div>
                      <div className="text-xs text-muted-foreground font-mono">{companyId}</div>
                    </td>
                    <td className="p-4 text-muted-foreground hidden md:table-cell">{p?.position ?? "—"}</td>
                    <td className="p-4 hidden sm:table-cell">
                      {areaName
                        ? <Badge variant="outline" className="rounded-lg">{areaName}</Badge>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="p-4 font-mono text-xs">
                      {pair.in ? formatPH(pair.in.timestamp, { hour: "2-digit", minute: "2-digit", hour12: true }) : "—"}
                    </td>
                    <td className="p-4 font-mono text-xs">
                      {pair.out ? formatPH(pair.out.timestamp, { hour: "2-digit", minute: "2-digit", hour12: true }) : "—"}
                    </td>
                    <td className="p-4 hidden sm:table-cell">
                      {shift
                        ? <Badge variant="secondary" className="rounded-lg capitalize">{shift} shift</Badge>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="p-4">
                      {isInside
                        ? <Badge className="rounded-lg bg-emerald-500/15 text-emerald-600 border-emerald-500/30 border">Inside</Badge>
                        : <Badge variant="secondary" className="rounded-lg">Timed Out</Badge>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!loading && filtered.length > 0 && (
            <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
              Showing {filtered.length} of {grouped.length} employee{grouped.length !== 1 ? "s" : ""}
              {search && " — filtered by search"}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className={`rounded-2xl border p-4 flex items-center gap-3 ${color}`}>
      <div className="shrink-0">{icon}</div>
      <div>
        <div className="text-2xl font-extrabold tabular-nums leading-none">{value}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
      </div>
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
