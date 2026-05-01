import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { ReactNode } from "react";

export function ProtectedRoute({ children, roles }: { children: ReactNode; roles?: string[] }) {
  const { profile, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  if (!profile) return <Navigate to="/login" replace />;
  if (roles && !roles.map(r => r.toLowerCase()).includes(profile.role?.toLowerCase())) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}
