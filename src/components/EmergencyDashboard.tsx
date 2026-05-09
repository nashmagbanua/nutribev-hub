/**
 * EmergencyDashboard.tsx
 *
 * Fullscreen emergency evacuation overlay triggered by kiosk code "0001".
 * Shows only employees currently INSIDE (latest attendance record = time_in).
 * Auto-refreshes every 5 seconds via Supabase polling.
 *
 * Usage in Kiosk.tsx:
 *   import { EmergencyDashboard } from "@/components/EmergencyDashboard";
 *   <EmergencyDashboard open={showEmergency} onClose={() => setShowEmergency(false)} />
 */

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
  supabase,
  formatPH,
  lastNameOf,
  type AttendanceRow,
  type Profile,
} from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, AlertTriangle, Users, Search, ArrowUpDown } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type SortField = "name" | "area_code";
type SortDir = "asc" | "desc";

interface InsideEmployee {
  company_id: string;
  full_name: string;
  position: string | null;
  area_code: string | null;
  time_in: string;   // ISO timestamp of the time_in record
  shift: "day" | "night" | null;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Queries Supabase for every employee whose LATEST attendance record is a
 * time_in (meaning they are still inside).  Returns one row per employee.
 *
 * Strategy:
 *   1. Fetch all attendance rows ordered desc by timestamp.
 *   2. Keep the FIRST (latest) row per company_id.
 *   3. Keep only rows whose type === "time_in".
 *   4. Join against profiles to get names / positions / area_codes.
 */
async function fetchInsideEmployees(): Promise<InsideEmployee[]> {
  // Fetch all attendance records (latest first).
  // For very large datasets a DB function / RPC would be better, but this
  // mirrors the existing kiosk pattern and works well up to ~10 k rows.
  const { data: attRows, error: aErr } = await supabase
    .from("attendance")
    .select("company_id, type, timestamp, shift")
    .order("timestamp", { ascending: false });

  if (aErr) throw aErr;

  // Deduplicate — keep only the LATEST record per employee.
  const latestByEmployee = new Map<string, AttendanceRow>();
  for (const row of (attRows ?? []) as AttendanceRow[]) {
    if (!latestByEmployee.has(row.company_id)) {
      latestByEmployee.set(row.company_id, row);
    }
  }

  // Keep only those whose latest record is a time_in.
  const insideIds: string[] = [];
  const insideRows: AttendanceRow[] = [];
  latestByEmployee.forEach((row, id) => {
    if (row.type === "time_in") {
      insideIds.push(id);
      insideRows.push(row);
    }
  });

  if (insideIds.length === 0) return [];

  // Fetch profiles for those IDs.
  const { data: profileData, error: pErr } = await supabase
    .from("profiles")
    .select("company_id, full_name, position, area_code")
    .in("company_id", insideIds)
    .eq("is_approved", true);

  if (pErr) throw pErr;

  const profileMap = new Map<string, Profile>();
  for (const p of (profileData ?? []) as Profile[]) {
    profileMap.set(p.company_id, p);
  }

  return insideIds
    .map((id) => {
      const row = latestByEmployee.get(id)!;
      const profile = profileMap.get(id);
      return {
        company_id: id,
        full_name: profile?.full_name ?? id,
        position: profile?.position ?? null,
        area_code: profile?.area_code ?? null,
        time_in: row.timestamp,
        shift: (row.shift ?? null) as "day" | "night" | null,
      };
    })
    .filter((e) => !!e.full_name); // Exclude unapproved/deleted accounts
}

// ─── Component ────────────────────────────────────────────────────────────────

interface EmergencyDashboardProps {
  open: boolean;
  onClose: () => void;
}

export function EmergencyDashboard({ open, onClose }: EmergencyDashboardProps) {
  const [employees, setEmployees] = useState<InsideEmployee[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({
    field: "name",
    dir: "asc",
  });
  const searchRef = useRef<HTMLInputElement>(null);
  const intervalRef = useRef<number | null>(null);

  // ── Data fetching ────────────────────────────────────────────────────────────

  const refresh = useCallback(async () => {
    try {
      const data = await fetchInsideEmployees();
      setEmployees(data);
      setLastRefresh(new Date());
    } catch (err) {
      console.error("[EmergencyDashboard] fetch error", err);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      // Clear state + interval when hidden
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      return;
    }

    setLoading(true);
    refresh().finally(() => setLoading(false));

    // Auto-refresh every 5 s
    intervalRef.current = window.setInterval(refresh, 5000);

    // Focus search after mount
    setTimeout(() => searchRef.current?.focus(), 150);

    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [open, refresh]);

  // ── Sorting & Filtering ──────────────────────────────────────────────────────

  const toggleSort = (field: SortField) => {
    setSort((prev) =>
      prev.field === field
        ? { field, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { field, dir: "asc" }
    );
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = q
      ? employees.filter(
          (e) =>
            e.full_name.toLowerCase().includes(q) ||
            e.company_id.toLowerCase().includes(q) ||
            (e.area_code ?? "").toLowerCase().includes(q) ||
            (e.position ?? "").toLowerCase().includes(q)
        )
      : [...employees];

    list.sort((a, b) => {
      let cmp = 0;
      if (sort.field === "name") {
        cmp = lastNameOf(a.full_name).localeCompare(lastNameOf(b.full_name));
      } else {
        cmp = (a.area_code ?? "").localeCompare(b.area_code ?? "");
        if (cmp === 0)
          cmp = lastNameOf(a.full_name).localeCompare(lastNameOf(b.full_name));
      }
      return sort.dir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [employees, search, sort]);

  // ── Escape key closes the overlay ───────────────────────────────────────────

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  // ── Render ───────────────────────────────────────────────────────────────────

  const SortIcon = ({ field }: { field: SortField }) => (
    <ArrowUpDown
      className={`inline h-3 w-3 ml-1 transition-opacity ${
        sort.field === field ? "opacity-100 text-destructive" : "opacity-40"
      }`}
    />
  );

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-sm flex flex-col animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label="Emergency Evacuation Dashboard"
    >
      {/* ── Emergency Header ─────────────────────────────────────────────────── */}
      <div className="bg-destructive text-destructive-foreground px-4 py-3 md:py-4 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-2xl md:text-3xl animate-pulse select-none">🚨</span>
          <div>
            <h1 className="text-lg md:text-2xl font-extrabold tracking-tight leading-none">
              EMERGENCY EVACUATION MODE
            </h1>
            <p className="text-xs md:text-sm opacity-90 mt-0.5">
              Showing employees currently inside the facility
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {lastRefresh && (
            <span className="hidden md:inline text-xs opacity-75">
              Updated {formatPH(lastRefresh, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-full text-destructive-foreground hover:bg-destructive-foreground/20"
            aria-label="Close emergency dashboard"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* ── Stats Bar ────────────────────────────────────────────────────────── */}
      <div className="bg-zinc-900 border-b border-zinc-700 px-4 py-3 flex flex-wrap items-center gap-4 shrink-0">
        <div className="flex items-center gap-2 text-white">
          <div className="h-10 w-10 rounded-full bg-destructive/20 border border-destructive/40 flex items-center justify-center">
            <Users className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-extrabold tabular-nums text-destructive leading-none">
              {loading ? "—" : employees.length}
            </div>
            <div className="text-xs text-zinc-400 leading-none mt-0.5">
              Inside Now
            </div>
          </div>
        </div>

        <div className="h-8 w-px bg-zinc-700 hidden sm:block" />

        <div className="flex items-center gap-2">
          {/* Live pulse indicator */}
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
          </span>
          <span className="text-xs text-zinc-400">Auto-refreshes every 5 seconds</span>
        </div>

        {/* Search */}
        <div className="ml-auto relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none" />
          <Input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, ID, area…"
            className="pl-9 rounded-xl bg-zinc-800 border-zinc-600 text-white placeholder:text-zinc-500 focus:border-destructive focus:ring-destructive"
          />
        </div>
      </div>

      {/* ── Table ────────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead className="bg-zinc-900 text-zinc-400 sticky top-0 z-10 border-b border-zinc-700">
            <tr>
              <th className="p-3 text-left font-semibold text-xs uppercase tracking-wider w-[120px]">
                Company ID
              </th>
              <th
                className="p-3 text-left font-semibold text-xs uppercase tracking-wider cursor-pointer hover:text-white select-none"
                onClick={() => toggleSort("name")}
              >
                Full Name <SortIcon field="name" />
              </th>
              <th className="p-3 text-left font-semibold text-xs uppercase tracking-wider hidden md:table-cell">
                Position
              </th>
              <th
                className="p-3 text-left font-semibold text-xs uppercase tracking-wider cursor-pointer hover:text-white select-none"
                onClick={() => toggleSort("area_code")}
              >
                Area <SortIcon field="area_code" />
              </th>
              <th className="p-3 text-left font-semibold text-xs uppercase tracking-wider">
                Time In
              </th>
              <th className="p-3 text-left font-semibold text-xs uppercase tracking-wider hidden sm:table-cell">
                Shift
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="py-16 text-center text-zinc-500">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-destructive border-t-transparent animate-spin" />
                    Loading employee data…
                  </span>
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2 text-zinc-500">
                    <AlertTriangle className="h-8 w-8 opacity-50" />
                    <span>
                      {search
                        ? "No employees match your search."
                        : "No employees currently inside the facility."}
                    </span>
                  </div>
                </td>
              </tr>
            )}
            {!loading &&
              filtered.map((emp, idx) => (
                <tr
                  key={emp.company_id}
                  className={`border-b border-zinc-800 hover:bg-zinc-800/60 transition-colors ${
                    idx % 2 === 0 ? "bg-zinc-900/50" : "bg-zinc-950/50"
                  }`}
                >
                  <td className="p-3 font-mono text-xs text-zinc-400">
                    {emp.company_id}
                  </td>
                  <td className="p-3 font-semibold text-white">
                    {emp.full_name}
                  </td>
                  <td className="p-3 text-zinc-400 hidden md:table-cell">
                    {emp.position ?? "—"}
                  </td>
                  <td className="p-3">
                    {emp.area_code ? (
                      <Badge
                        variant="outline"
                        className="rounded-lg border-zinc-600 text-zinc-300 bg-zinc-800"
                      >
                        {emp.area_code}
                      </Badge>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="p-3 font-mono text-xs text-emerald-400">
                    {formatPH(emp.time_in, {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    })}
                  </td>
                  <td className="p-3 hidden sm:table-cell">
                    {emp.shift ? (
                      <Badge
                        variant="secondary"
                        className="rounded-lg capitalize bg-zinc-700 text-zinc-200"
                      >
                        {emp.shift} shift
                      </Badge>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <div className="bg-zinc-900 border-t border-zinc-700 px-4 py-2 shrink-0 flex items-center justify-between text-xs text-zinc-500">
        <span>
          {filtered.length} of {employees.length} employee
          {employees.length !== 1 ? "s" : ""} shown
        </span>
        <button
          onClick={onClose}
          className="text-zinc-400 hover:text-white transition-colors underline underline-offset-2"
        >
          Close (Esc)
        </button>
      </div>
    </div>
  );
}
