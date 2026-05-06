import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeToggle } from "./ThemeToggle";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogOut, LayoutDashboard, Users, Stethoscope, Smartphone, KeyRound, User as UserIcon } from "lucide-react";
import { useState } from "react";
import { supabase, effectiveRole } from "@/lib/supabase";
import { toast } from "sonner";
import abnLogo from "@/assets/abn-logo.svg";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }>; mdOnly?: boolean };

export function AppHeader() {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const role = effectiveRole(profile);
  const isHR = role === "hr_admin" || role === "manager";

  const items: NavItem[] = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/clinic", label: "Clinic", icon: Stethoscope },
    { to: "/mobile-punch", label: "Mobile Punch", icon: Smartphone, mdOnly: true },
    ...(isHR ? [{ to: "/hr", label: "HR Console", icon: Users }] : []),
  ];

  const handleLogout = () => { logout(); navigate("/"); };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between gap-2">
        <Link to="/dashboard" className="flex items-center gap-2 shrink-0">
          <img src={abnLogo} alt="AB Nutribev Corp." className="h-9 w-9 rounded-xl bg-card shadow-soft p-0.5" />
          <span className="font-bold text-lg hidden sm:inline">AB Nutribev</span>
        </Link>

        <nav className="flex items-center gap-1">
          {items.map(it => {
            const active = location.pathname === it.to;
            const Icon = it.icon;
            return (
              <Link
                key={it.to}
                to={it.to}
                className={cn(
                  "inline-flex items-center gap-2 px-3 h-9 rounded-lg text-sm font-medium transition-all duration-200",
                  active
                    ? "bg-primary/10 text-primary shadow-soft"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className={cn("h-4 w-4", active && "stroke-[2.5]")} />
                <span className={cn("hidden sm:inline", it.mdOnly && "hidden md:inline")}>{it.label}</span>
              </Link>
            );
          })}

          <ThemeToggle />
          <ProfileMenu onLogout={handleLogout} />
        </nav>
      </div>
    </header>
  );
}

function ProfileMenu({ onLogout }: { onLogout: () => void }) {
  const { profile } = useAuth();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  if (!profile) return null;
  const initials = profile.full_name?.split(" ").map(n => n[0]).slice(0, 2).join("");
  const role = effectiveRole(profile);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="ml-1 rounded-full ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="Account menu"
          >
            <Avatar className="h-9 w-9">
              <AvatarImage src={profile.avatar_url ?? undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials}</AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 rounded-xl">
          <DropdownMenuLabel className="flex items-center gap-3 py-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={profile.avatar_url ?? undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{profile.full_name}</div>
              <div className="text-xs text-muted-foreground capitalize truncate">{role.replace("_", " ")}</div>
              <div className="text-xs text-muted-foreground truncate">{profile.email ?? "—"}</div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setPwOpen(true); }}>
            <KeyRound className="h-4 w-4 mr-2" /> Change password
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => { e.preventDefault(); setConfirmOpen(true); }}
            className="text-destructive focus:text-destructive"
          >
            <LogOut className="h-4 w-4 mr-2" /> Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out?</AlertDialogTitle>
            <AlertDialogDescription>You'll need to sign in again to access your dashboard.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onLogout}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sign out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ChangePasswordDialog open={pwOpen} onOpenChange={setPwOpen} companyId={profile.company_id} />
    </>
  );
}

function ChangePasswordDialog({
  open, onOpenChange, companyId,
}: { open: boolean; onOpenChange: (o: boolean) => void; companyId: string }) {
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (newPw.length < 6) { toast.error("New password must be at least 6 characters."); return; }
    if (newPw !== confirm) { toast.error("Passwords do not match."); return; }
    setSaving(true);
    const { data, error } = await supabase.from("profiles").select("id").eq("company_id", companyId).eq("password", oldPw).maybeSingle();
    if (error || !data) { toast.error("Current password incorrect."); setSaving(false); return; }
    const { error: uErr } = await supabase.from("profiles").update({ password: newPw }).eq("id", data.id);
    setSaving(false);
    if (uErr) { toast.error(uErr.message); return; }
    toast.success("Password updated.");
    onOpenChange(false); setOldPw(""); setNewPw(""); setConfirm("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl">
        <DialogHeader><DialogTitle>Change password</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Current password</Label><Input type="password" value={oldPw} onChange={e => setOldPw(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>New password</Label><Input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Confirm new password</Label><Input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancel</Button>
          <Button onClick={submit} disabled={saving} className="rounded-xl gradient-primary text-primary-foreground">{saving ? "Saving…" : "Update"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
