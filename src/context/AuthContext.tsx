import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase, type Profile } from "@/lib/supabase";

type AuthContextType = {
  profile: Profile | null;
  loading: boolean;
  login: (companyId: string, password: string) => Promise<{ error?: string; profile?: Profile }>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

const STORAGE_KEY = "abnutribev_session";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try { setProfile(JSON.parse(raw)); } catch { /* ignore */ }
    }
    setLoading(false);
  }, []);

  const login = async (companyId: string, password: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, company_id, full_name, dob, role, avatar_url, is_approved, email, position, area_code")
      .eq("company_id", companyId.trim())
      .eq("password", password)
      .maybeSingle();

    if (error) return { error: error.message };
    if (!data) return { error: "Invalid Company ID or password." };
    if (!data.is_approved) return { error: "Your account is pending HR approval." };

    const p = data as Profile;
    setProfile(p);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    return { profile: p };
  };

  const logout = () => {
    setProfile(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <AuthContext.Provider value={{ profile, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
