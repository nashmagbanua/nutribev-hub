import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://qbeacrpoyfacgmbzxjcu.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiZWFjcnBveWZhY2dtYnp4amN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg2NTM5NTIsImV4cCI6MjA2NDIyOTk1Mn0.6kfxKLJxidW4BcqsMJte61AtzydrTW-1ZJIJytiUBt4";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

export type SystemRole = "employee" | "supervisor" | "nurse" | "safety_officer" | "hr_admin" | "manager";
export type JobPosition =
  | "mantech"
  | "opscrew"
  | "maintenance_tech"
  | "qa_inspector"
  | "forklift_operator"
  | "warehouseman"
  | "supervisor"
  | "department_head"
  | "plant_manager"
  | "hr_officer"
  | "admin_staff"
  | "nurse"
  | "safety_officer";
export type Department =
  | "production"
  | "process"
  | "utilities"
  | "fullgoods"
  | "qa"
  | "maintenance"
  | "hr_admin"
  | "safety";

export const SYSTEM_ROLES: { value: SystemRole; label: string }[] = [
  { value: "employee", label: "Employee" },
  { value: "supervisor", label: "Supervisor" },
  { value: "nurse", label: "Nurse" },
  { value: "safety_officer", label: "Safety Officer" },
  { value: "hr_admin", label: "HR / Admin" },
  { value: "manager", label: "Manager" },
];
export const JOB_POSITIONS: { value: JobPosition; label: string }[] = [
  { value: "mantech",          label: "Mantech" },
  { value: "opscrew",          label: "Opscrew" },
  { value: "maintenance_tech", label: "Maintenance Technician" },
  { value: "qa_inspector",     label: "QA Inspector" },
  { value: "forklift_operator",label: "Forklift Operator" },
  { value: "warehouseman",     label: "Warehouseman" },
  { value: "supervisor",       label: "Supervisor" },
  { value: "department_head",  label: "Department Head" },
  { value: "plant_manager",    label: "Plant Manager" },
  { value: "hr_officer",       label: "HR Officer" },
  { value: "admin_staff",      label: "Admin Staff" },
  { value: "nurse",            label: "Nurse" },
  { value: "safety_officer",   label: "Safety Officer" },
];
export const DEPARTMENTS: { value: Department; label: string }[] = [
  { value: "production", label: "Production" },
  { value: "process",    label: "Process" },
  { value: "utilities",  label: "Utilities" },
  { value: "fullgoods",  label: "Full Goods" },
  { value: "qa",         label: "QA" },
  { value: "maintenance",label: "Maintenance" },
  { value: "hr_admin",   label: "HR & Admin" },
  { value: "safety",     label: "Safety" },
];

export type UniformSizes = {
  tshirt:        string | null;
  longsleeve:    string | null;
  pants:         string | null;
  safety_boots:  string | null;
  safety_shoes:  string | null;
  last_updated:  string | null; // ISO timestamp
};

export const UNIFORM_CLOTHING_SIZES = ["XS","S","M","L","XL","2XL","3XL"];
export const UNIFORM_PANTS_SIZES    = ["26","27","28","29","30","31","32","33","34","36","38","40"];
export const UNIFORM_SHOE_SIZES     = ["36","37","38","39","40","41","42","43","44","45","46"];

export const UNIFORM_FIELDS: {
  key: keyof Omit<UniformSizes, "last_updated">;
  label: string;
  sizes: string[];
}[] = [
  { key: "tshirt",       label: "T-Shirt",       sizes: UNIFORM_CLOTHING_SIZES },
  { key: "longsleeve",   label: "Long Sleeve",    sizes: UNIFORM_CLOTHING_SIZES },
  { key: "pants",        label: "Pants (Waist)",  sizes: UNIFORM_PANTS_SIZES    },
  { key: "safety_boots", label: "Safety Boots",   sizes: UNIFORM_SHOE_SIZES     },
  { key: "safety_shoes", label: "Safety Shoes",   sizes: UNIFORM_SHOE_SIZES     },
];

export type Profile = {
  id: string;
  company_id: string;
  full_name: string;
  dob: string | null;
  role: string;                      // legacy
  position?: string | null;          // legacy
  system_role?: SystemRole | null;   // new
  job_position?: JobPosition | null; // new
  department?: Department | null;    // new
  email?: string | null;
  avatar_url: string | null;
  password?: string;
  is_approved: boolean;
  area_code?: string | null;
  uniform_sizes?: UniformSizes | null; // company uniform measurements
};

/** Effective role for permissions — prefers new system_role, falls back to legacy role. */
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

export type AttendanceRow = {
  id: string;
  company_id: string;
  timestamp: string;
  type: "time_in" | "time_out";
  shift?: "day" | "night" | null;
  source?: "kiosk" | "mobile_fallback" | null;
};

export type AnnouncementCategory = "general" | "safety" | "hr" | "holiday" | "operations";

export const ANNOUNCEMENT_CATEGORIES: { value: AnnouncementCategory; label: string; color: string }[] = [
  { value: "general",    label: "General",    color: "bg-muted text-muted-foreground" },
  { value: "safety",     label: "Safety",     color: "bg-destructive/15 text-destructive" },
  { value: "hr",         label: "HR",         color: "bg-primary/15 text-primary" },
  { value: "holiday",    label: "Holiday",    color: "bg-warning/20 text-foreground" },
  { value: "operations", label: "Operations", color: "bg-sky-500/15 text-sky-600" },
];

export type Announcement = {
  id: string;
  title: string;
  body: string | null;
  image_url: string | null;
  active: boolean;
  pinned: boolean | null;       // pinned announcements show first
  category: AnnouncementCategory | null;
  expires_at: string | null;    // auto-hide after this date
  created_at: string;
};

/**
 * working_days: 7-char string, index 0=Sun … 6=Sat, "1"=work day, "0"=off.
 * Default "1111110" = Mon–Sat work, Sun off.
 * Example "1111111" = all 7 days.  "1111100" = Mon–Fri only.
 */
export type KioskSettings = {
  id: string;
  canteen_status: "open" | "closed" | "holiday";
  clinic_status: "open" | "closed" | "holiday";
  late_threshold_day: string;
  late_threshold_night: string;
  geofence_radius_m: number;
  geofence_lat: number;
  geofence_lng: number;
  holiday_mode: "allow" | "disable";
  working_days: string | null;   // "1111110" Sun–Sat bitmask, null = Mon–Sat default
  kiosk_theme: "default" | "dark" | "high_contrast" | null;
  updated_at: string;
};

/** Returns true if the given Date is a configured working day (PH timezone). */
export function isWorkingDay(d: Date, workingDays?: string | null): boolean {
  const mask = workingDays ?? "1111110"; // default Mon–Sat
  const phDay = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Manila" })).getDay(); // 0=Sun
  return mask[phDay] === "1";
}

export type Visitor = {
  id: string;
  full_name: string;
  company: string | null;
  purpose: string | null;
  person_to_visit: string | null;
  time_in: string;
};

export type ClinicRequest = {
  id: string;
  company_id: string;
  employee_name: string;
  medicine: string;
  symptoms: string | null;   // what the employee is experiencing
  pickup_time: string | null;
  status: "pending" | "available" | "follow_up" | "picked_up";
  notes: string | null;
  created_at: string;
  picked_up_at?: string | null;
};

export type Holiday = {
  id: string;
  name: string;
  date: string;
  active: boolean;
};

export type AreaCode = {
  id: string;
  code: string;
  name: string;
  active: boolean;
};

export type Message = {
  id: string;
  from_company_id: string;
  to_company_id: string;
  body: string;
  read: boolean;
  created_at: string;
  status?: "sent" | "delivered" | "read";
  deleted_by_sender?: boolean;
  deleted_by_receiver?: boolean;
};

/** Race a promise against a timeout — protects mobile/iOS from hangs. */
export function withTimeout<T>(p: PromiseLike<T>, ms = 8000, label = "Request"): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    Promise.resolve(p).then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}

// ===== Constants =====
export const COMPANY_LAT = 14.258657284905194;
export const COMPANY_LNG = 121.11928280273479;
export const DEFAULT_RADIUS_M = 100;
export const ADMIN_SHORTCUT_CODE = "0002";
export const VISITOR_CODE = "12345";

/** Default area codes seeded by HR. */
export const DEFAULT_AREA_CODES: { code: string; name: string }[] = [
  { code: "1001", name: "QA" },
  { code: "1002", name: "HR & Admin" },
  { code: "1003", name: "Full Goods" },
  { code: "1004", name: "Process" },
  { code: "1005", name: "Production" },
  { code: "1006", name: "Utilities" },
  { code: "1007", name: "Maintenance" },
  { code: "1008", name: "Safety" },
];

export function phDateKey(d: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(d);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function phMonthDay(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d + "T00:00:00") : d;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila", month: "2-digit", day: "2-digit"
  }).formatToParts(date);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? "";
  return `${get("month")}-${get("day")}`;
}

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Determines shift from time-in timestamp (PH time).
 *
 * Schedule:  Day Shift   = 06:00 – 18:00  (early arrivals from 03:00 still count as Day)
 *            Night Shift = 18:00 – 06:00
 *
 * The 03:00 lower bound catches employees who arrive early for the 06:00 Day shift.
 * Anyone arriving between 18:00–03:00 is on Night shift.
 */
export function shiftFromTimeIn(d: Date): "day" | "night" {
  const ph = new Date(d.getTime() + (8 * 60 + d.getTimezoneOffset()) * 60000);
  const h = ph.getHours();
  // 03:00 ≤ h < 18:00  →  Day shift  (includes early-arrival window 03:00–06:00)
  // 18:00 ≤ h < 24:00  →  Night shift
  // 00:00 ≤ h < 03:00  →  Night shift (late into the night)
  return h >= 3 && h < 18 ? "day" : "night";
}

export function nowInPH(): Date {
  const d = new Date();
  return new Date(d.getTime() + (8 * 60 + d.getTimezoneOffset()) * 60000);
}

export function formatPH(d: Date | string, opts?: Intl.DateTimeFormatOptions): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", ...opts }).format(date);
}

/** Returns last token of full_name as last name for sorting. */
export function lastNameOf(full: string): string {
  const parts = (full ?? "").trim().split(/\s+/);
  return (parts[parts.length - 1] ?? "").toLowerCase();
}

/** Random respectful greeting used by kiosk success messages. */
export function randomGreeting(action: "in" | "out"): string {
  if (action === "in") {
    const greets = [
      "Welcome back",
      "Good to see you",
      "Have a great shift",
      "Stay safe today",
      "Wishing you a productive day",
      "Mabuhay",
    ];
    return greets[Math.floor(Math.random() * greets.length)];
  }
  const greets = [
    "Great work today",
    "Drive safely on your way home",
    "Enjoy your rest",
    "Thank you for your hard work",
    "Maraming salamat",
    "See you tomorrow",
  ];
  return greets[Math.floor(Math.random() * greets.length)];
}

/**
 * Resize + compress an image client-side before upload.
 * - Max width 800, JPEG quality starts at 0.8 then steps down to fit target size.
 * - Returns a Blob (image/jpeg or image/webp) under ~target bytes.
 */
export async function compressImage(
  file: File,
  opts: { maxWidth?: number; targetBytes?: number; mime?: "image/jpeg" | "image/webp" } = {}
): Promise<Blob> {
  const maxWidth = opts.maxWidth ?? 800;
  const targetBytes = opts.targetBytes ?? 400 * 1024;
  const mime = opts.mime ?? "image/jpeg";

  const dataUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = dataUrl;
  });

  const ratio = img.width > maxWidth ? maxWidth / img.width : 1;
  const w = Math.round(img.width * ratio);
  const h = Math.round(img.height * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);

  let quality = 0.8;
  let blob: Blob | null = await new Promise(r => canvas.toBlob(b => r(b), mime, quality));
  while (blob && blob.size > targetBytes && quality > 0.4) {
    quality -= 0.1;
    blob = await new Promise(r => canvas.toBlob(b => r(b), mime, quality));
  }
  if (!blob) throw new Error("Compression failed");
  return blob;
}

/** Upload an image (compressed) to the 'uploads' bucket. Replaces the previous file at same path. */
export async function uploadImage(
  bucket: string,
  path: string,
  file: File,
  opts?: { maxWidth?: number; targetBytes?: number }
): Promise<string> {
  const blob = await compressImage(file, opts);
  if (blob.size > 500 * 1024) throw new Error("Image is still too large after compression.");
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, blob, { upsert: true, contentType: blob.type, cacheControl: "3600" });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  // Cache-bust so updated images appear immediately.
  return `${data.publicUrl}?t=${Date.now()}`;
}


export type PPEItem = {
  ppe_type: string;
  size: string | null;
  quantity: number;
  reason: string;
};

export type PPERequest = {
  id: string;
  company_id: string;
  employee_name: string;
  items: PPEItem[];
  urgency: "normal" | "urgent";
  notes: string | null;
  status: "pending" | "approved" | "issued" | "rejected";
  requested_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
};

/** Detect mobile UA — used to redirect kiosk to landing page on phones. */
export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /android|iphone|ipod|ipad|mobile/i.test(navigator.userAgent);
}
