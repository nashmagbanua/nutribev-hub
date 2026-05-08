import { createClient } from "@supabase/supabase-js";
const SUPABASE_URL = "https://qbeacrpoyfacgmbzxjcu.supabase.co";
const SUPABASE_ANON_KEY =
"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiZWFjcnBveWZhY2dtYnp4a
mN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg2NTM5NTIsImV4cCI6MjA2NDIyOTk1Mn0.6kfxKLJxidW4BcqsMJte61At
zydrTW-1ZJIJytiUBt4";
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
auth: { persistSession: false },
});
export type SystemRole = "employee" | "supervisor" | "nurse" | "safety_officer" | "hr_admin" |
"manager";
export type JobPosition = "mantech" | "opscrew" | "maintenance" | "qa" | "fullgoods";
export type Department = "production" | "process" | "utilities" | "fullgoods" | "qa";
export const SYSTEM_ROLES: { value: SystemRole; label: string }[] = [
{ value: "employee", label: "Employee" },
{ value: "supervisor", label: "Supervisor" },
{ value: "nurse", label: "Nurse" },
{ value: "safety_officer", label: "Safety Officer" },
{ value: "hr_admin", label: "HR / Admin" },
{ value: "manager", label: "Manager" },
];
export const JOB_POSITIONS: { value: JobPosition; label: string }[] = [
{ value: "mantech", label: "Mantech" },
{ value: "opscrew", label: "Opscrew" },
{ value: "maintenance", label: "Maintenance" },
{ value: "qa", label: "QA" },
{ value: "fullgoods", label: "Full Goods" },
];
export const DEPARTMENTS: { value: Department; label: string }[] = [
{ value: "production", label: "Production" },
{ value: "process", label: "Process" },
{ value: "utilities", label: "Utilities" },
{ value: "fullgoods", label: "Full Goods" },
{ value: "qa", label: "QA" },

];
export type Profile = {
id: string;
company_id: string;
full_name: string;
dob: string | null;
role: string;
position?: string | null;
system_role?: SystemRole | null;
job_position?: JobPosition | null;
department?: Department | null;
email?: string | null;
avatar_url: string | null;
is_approved: boolean;
area_code?: string | null;
};
export function effectiveRole(p?: Profile | null): SystemRole {
  if (!p) return "employee";

  if (p.system_role) return p.system_role;

  const r = (p.role ?? "").toLowerCase();

  if (r === "hr" || r === "admin" || r === "hr_admin") {
    return "hr_admin";
  }

  if (r === "supervisor") {
    return "supervisor";
  }

  if (r === "nurse") {
    return "nurse";
  }

  if (r === "safety_officer" || r === "safety") {
    return "safety_officer";
  }

  if (r === "manager") {
    return "manager";
  }

  return "employee";
}
export function formatPH(d: Date | string, opts?: Intl.DateTimeFormatOptions): string {
const date = typeof d === "string" ? new Date(d) : d;
return new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", ...opts }).format(date);
}
export type AttendanceRow = {
  id: string;
  company_id: string;
  timestamp: string;
  type: "time_in" | "time_out";
  shift?: "day" | "night" | null;
  source?: "kiosk" | "mobile_fallback" | null;
};
// ... iba pang utility functions (haversine, etc.) ay mananatili
/** Returns YYYY-MM-DD in Asia/Manila timezone */
export function phDateKey(d: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const get = (t: string) =>
    parts.find((p) => p.type === t)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * Operational date for attendance grouping.
 * Night shift logs between 12AM–11:59AM belong to previous workday.
 */
export function operationalDateKey(
  timestamp: string | Date,
  shift?: "day" | "night" | null
): string {
  const date =
    typeof timestamp === "string"
      ? new Date(timestamp)
      : timestamp;

  const phHour = parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila",
      hour: "numeric",
      hour12: false,
    }).format(date),
    10
  );

  // Pang-gabi adjustment
  if (shift === "night" && phHour < 12) {
    const prev = new Date(date);
    prev.setDate(prev.getDate() - 1);
    return phDateKey(prev);
  }

  return phDateKey(date);
}

/**
 * Detect shift from PH time.
 * Day shift = 5AM–5:59PM
 * Night shift = 6PM–4:59AM
 */
export function shiftFromTimeIn(
  d: Date
): "day" | "night" {
  const phHour = parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila",
      hour: "numeric",
      hour12: false,
    }).format(d),
    10
  );

  return phHour >= 5 && phHour < 18
    ? "day"
    : "night";
}
