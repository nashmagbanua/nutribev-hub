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
  avatar_url: string | null;
  password?: string;
  is_approved: boolean;
};

export type AttendanceRow = {
  id: string;
  company_id: string;
  timestamp: string;
  type: "time_in" | "time_out";
};

export type Announcement = {
  id: string;
  title: string;
  body: string | null;
  image_url: string | null;
  active: boolean;
  created_at: string;
};
