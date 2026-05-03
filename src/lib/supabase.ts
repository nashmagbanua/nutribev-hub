import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://qbeacrpoyfacgmbzxjcu.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiZWFjcnBveWZhY2dtYnp4amN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg2NTM5NTIsImV4cCI6MjA2NDIyOTk1Mn0.6kfxKLJxidW4BcqsMJte61AtzydrTW-1ZJIJytiUBt4";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

export type Profile = {
  id: string;
  company_id: string;
  full_name: string;
  dob: string | null;
  role: string;
  position?: string | null;
  email?: string | null;
  avatar_url: string | null;
  password?: string;
  is_approved: boolean;
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

export type KioskSettings = {
  id: string;
  canteen_status: "open" | "closed" | "holiday";
  clinic_status: "open" | "closed" | "holiday";
  late_threshold_day: string;
  late_threshold_night: string;
  geofence_radius_m: number;
  geofence_lat: number;
  geofence_lng: number;
  holiday_mode: "allow" | "disable"; // when a holiday matches, allow logs or disable kiosk
  updated_at: string;
};

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
  pickup_time: string | null;
  status: "pending" | "available" | "follow_up";
  notes: string | null;
  created_at: string;
};

export type Holiday = {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  active: boolean;
};

// ===== Constants =====
export const COMPANY_LAT = 14.258657284905194;
export const COMPANY_LNG = 121.11928280273479;
export const DEFAULT_RADIUS_M = 100;
export const ADMIN_SHORTCUT_CODE = "11223344";
export const VISITOR_CODE = "12345";

/** Returns YYYY-MM-DD in PH time. */
export function phDateKey(d: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(d);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Returns "MM-DD" in PH time, used to match birthdays regardless of year. */
export function phMonthDay(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d + "T00:00:00") : d;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila", month: "2-digit", day: "2-digit"
  }).formatToParts(date);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? "";
  return `${get("month")}-${get("day")}`;
}

// ===== Helpers =====
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Returns "day" or "night" based on PH local hour of a Date (UTC-stored). */
export function shiftFromTimeIn(d: Date): "day" | "night" {
  // Convert to PH (UTC+8)
  const ph = new Date(d.getTime() + (8 * 60 + d.getTimezoneOffset()) * 60000);
  const h = ph.getHours();
  // 5:00 AM – 5:59 PM => Day, else Night
  return h >= 5 && h < 18 ? "day" : "night";
}

export function nowInPH(): Date {
  const d = new Date();
  return new Date(d.getTime() + (8 * 60 + d.getTimezoneOffset()) * 60000);
}

export function formatPH(d: Date | string, opts?: Intl.DateTimeFormatOptions): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    ...opts,
  }).format(date);
}
