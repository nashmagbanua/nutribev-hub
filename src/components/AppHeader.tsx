import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeToggle } from "./ThemeToggle";
import { LogOut, LayoutDashboard, Users, Stethoscope, Smartphone } from "lucide-react";
import abnLogo from "@/assets/abn-logo.svg";

export function AppHeader() {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const isHR = profile && ["hr", "admin"].includes(profile.role?.toLowerCase());

  const handleLogout = () => { logout(); navigate("/"); };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/dashboard" className="flex items-center gap-2">
          <img src={abnLogo} alt="AB Nutribev Corp." className="h-9 w-9 rounded-xl bg-card shadow-soft p-0.5" />
          <span className="font-bold text-lg hidden sm:inline">AB Nutribev</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="gap-2">
            <LayoutDashboard className="h-4 w-4" /><span className="hidden sm:inline">Dashboard</span>
          </Button>
          {isHR && (
            <Button variant="ghost" size="sm" onClick={() => navigate("/hr")} className="gap-2">
              <Users className="h-4 w-4" /><span className="hidden sm:inline">HR Console</span>
            </Button>
          )}
          <ThemeToggle />
          <div className="flex items-center gap-3 pl-3 border-l border-border ml-1">
            <Avatar className="h-9 w-9">
              <AvatarImage src={profile?.avatar_url ?? undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                {profile?.full_name?.split(" ").map(n => n[0]).slice(0,2).join("")}
              </AvatarFallback>
            </Avatar>
            <div className="hidden md:block text-right leading-tight">
              <div className="text-sm font-semibold">{profile?.full_name}</div>
              <div className="text-xs text-muted-foreground">{profile?.role}</div>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Logout">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </nav>
      </div>
    </header>
  );
}
