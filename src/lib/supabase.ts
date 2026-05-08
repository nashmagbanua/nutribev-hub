import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://qbeacrpoyfacgmbzxjcu.supabase.co";

// SIGURADUHIN NA ISANG MAHABANG LINYA LANG ITO (WALANG ENTER SA GITNA)
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiZWFjcnBveWZhY2dtYnp4amN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg2NTM5NTIsImV4cCI6MjA2NDIyOTk1Mn0.6kfxKLJxidW4BcqsMJte61AtzydrTW-1ZJIJytiUBt4";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

// ===== Types =====
export type SystemRole = "employee" | "supervisor" | "nurse" | "safety_officer" | "hr_admin" | "manager";
export type JobPosition = "mantech" | "opscrew" | "maintenance" | "qa" | "fullgoods";
export type Department = "production" | "process" | "utilities" | "fullgoods" | "qa";

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

export type AttendanceRow = {
  id: string;
  company_id: string;
  timestamp: string;
  type: "time_in" | "time_out";
  shift?: "day" | "night" | null;
  source?: "kiosk" | "mobile_fallback" | null;
};

export type Announcement = {
  id: string;
  title: string;
  body: string | null;
  image_url: string | null;
  active: boolean;
  created_at: string;
};

export type AreaCode = {
  id: string;
  code: string;
  name: string;
  active: boolean;
};

// ===== Constants for UI Selects =====
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

export const DEFAULT_AREA_CODES = [
  { code: "1001", name: "QA" },
  { code: "1002", name: "HR/Admin" },
  { code: "1003", name: "Full Goods" },
  { code: "1004", name: "Process" },
  { code: "1005", name: "Production" },
  { code: "1006", name: "Utilities" },
  { code: "1007", name: "Maintenance" },
];

export const ADMIN_SHORTCUT_CODE = "11223344";
export const VISITOR_CODE = "12345";

// ===== Helper Functions =====

export function effectiveRole(p?: Profile | null): SystemRole {
  if (!p) return "employee";
  if (p.system_role) return p.system_role;
  const r = (p.role ?? "").toLowerCase();
  if (r === "hr" || r === "admin" || r === "hr_admin") return "hr_admin";
  if (r === "supervisor") return "supervisor";
  if (r === "nurse") return "nurse";
  if (r === "safety_officer" || r === "safety") return "safety_officer";
  if (r === "manager") return "manager";
  return "employee";
}

export function formatPH(d: Date | string, opts?: Intl.DateTimeFormatOptions): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", ...opts }).format(date);
}

export function phDateKey(d: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(d);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function phMonthDay(d: Date | string): string {
  const date = typeof d === "string" ? (d.includes('T') ? new Date(d) : new Date(d + "T00:00:00")) : d;
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila", month: "long", day: "numeric"
  }).format(date);
}

export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /android|iphone|ipod|ipad|mobile/i.test(navigator.userAgent);
}

export function lastNameOf(full: string): string {
  const parts = (full ?? "").trim().split(/\s+/);
  return (parts[parts.length - 1] ?? "").toLowerCase();
}

export function randomGreeting(action: "in" | "out" = "in"): string {
  const greets = action === "in" 
    ? ["Welcome back", "Good to see you", "Have a great shift", "Mabuhay"]
    : ["Great work today", "Drive safely", "Enjoy your rest", "Maraming salamat"];
  return greets[Math.floor(Math.random() * greets.length)];
}

// ===== Image Handling =====

export async function compressImage(file: File, opts: any = {}): Promise<Blob> {
  const maxWidth = opts.maxWidth ?? 800;
  const quality = 0.7;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ratio = img.width > maxWidth ? maxWidth / img.width : 1;
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => blob ? resolve(blob) : reject("Blob error"), "image/jpeg", quality);
      };
    };
  });
}

export async function uploadImage(bucket: string, path: string, file: File): Promise<string> {
  const blob = await compressImage(file);
  const { error } = await supabase.storage.from(bucket).upload(path, blob, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}
