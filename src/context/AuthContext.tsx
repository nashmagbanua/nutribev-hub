import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase, type Profile } from "@/lib/supabase";

// ─── All profile columns in one place — update here if schema changes ─────────
const PROFILE_SELECT = [
  "id", "company_id", "full_name", "dob", "role", "avatar_url",
  "is_approved", "email", "position", "area_code", "system_role",
  "job_position", "department", "uniform_sizes",
].join(", ");

type AuthContextType = {
  profile:        Profile | null;
  loading:        boolean;
  login:          (companyId: string, password: string) => Promise<{ error?: string; profile?: Profile }>;
  logout:         () => void;
  refreshProfile: () => Promise<void>; // re-fetches latest profile from Supabase
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

const STORAGE_KEY = "abnutribev_session";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Restore session from localStorage on mount ────────────────────────────
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try { setProfile(JSON.parse(raw)); } catch { /* ignore */ }
    }
    setLoading(false);
  }, []);

  // ── refreshProfile — re-fetches latest data for the current session ───────
  // Call this after any profile update (uniform sizes, email, avatar, etc.)
  // so the UI reflects the latest values without requiring a logout/login.
  const refreshProfile = useCallback(async () => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    try {
      const cached = JSON.parse(stored) as Profile;
      const { data, error } = await supabase
        .from("profiles")
        .select(PROFILE_SELECT)
        .eq("company_id", cached.company_id)
        .maybeSingle();
      if (error || !data) return;
      const fresh = data as Profile;
      setProfile(fresh);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    } catch { /* silently ignore network errors — stale data is fine */ }
  }, []);

  // ── login ─────────────────────────────────────────────────────────────────
  const login = async (companyId: string, password: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select(PROFILE_SELECT)
      .eq("company_id", companyId.trim())
      .eq("password", password)
      .maybeSingle();

    if (error)  return { error: error.message };
    if (!data)  return { error: "Invalid Company ID or password." };
    if (!data.is_approved) return { error: "Your account is pending HR approval." };

    const p = data as Profile;
    setProfile(p);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    return { profile: p };
  };

  // ── logout ────────────────────────────────────────────────────────────────
  const logout = () => {
    setProfile(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <AuthContext.Provider value={{ profile, loading, login, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
