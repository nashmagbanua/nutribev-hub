import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { effectiveRole } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Loader2, LogIn, Eye, EyeOff, HelpCircle, X } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import abnLogo from "@/assets/abn-logo.svg";

const REMEMBER_KEY = "abn_remembered_id";

// ── Role → route map using the authoritative effectiveRole helper ─────────────
function destForRole(profile: any): string {
  const role = effectiveRole(profile);
  if (role === "hr_admin" || role === "manager") return "/hr";
  return "/dashboard";
}

export default function Login() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [companyId, setCompanyId]     = useState("");
  const [password, setPassword]       = useState("");
  const [showPw, setShowPw]           = useState(false);
  const [rememberMe, setRememberMe]   = useState(false);
  const [loading, setLoading]         = useState(false);
  const [showForgot, setShowForgot]   = useState(false);

  // "Last signed in as" card
  const [rememberedId, setRememberedId] = useState<string | null>(null);
  const [usingRemembered, setUsingRemembered] = useState(false);

  const passwordRef = useRef<HTMLInputElement>(null);
  const { login }   = useAuth();
  const navigate    = useNavigate();

  // ── On mount: restore remembered ID ────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem(REMEMBER_KEY);
    if (saved) {
      setRememberedId(saved);
      setRememberMe(true);
      // Pre-fill company ID so the form still works normally
      setCompanyId(saved);
      setUsingRemembered(true);
    }
  }, []);

  // ── Dismiss remembered session ─────────────────────────────────────────────
  const clearRemembered = () => {
    localStorage.removeItem(REMEMBER_KEY);
    setRememberedId(null);
    setUsingRemembered(false);
    setCompanyId("");
    setRememberMe(false);
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = companyId.trim().toUpperCase();  // #7 — auto-format
    if (!id || !password) {
      toast.error("Please enter both Company ID and password.");
      return;
    }
    setLoading(true);
    const { error, profile } = await login(id, password);
    setLoading(false);
    if (error) {
      toast.error(error);
      setPassword("");
      return;
    }

    // Persist or clear remembered ID
    if (rememberMe) {
      localStorage.setItem(REMEMBER_KEY, id);
    } else {
      localStorage.removeItem(REMEMBER_KEY);
    }

    navigate(destForRole(profile), { replace: true });
  };

  // ── Company ID field keyDown: Enter → focus password ──────────────────────
  const onIdKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      passwordRef.current?.focus();
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen gradient-subtle flex flex-col">
      <header className="container flex h-16 items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-smooth">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md space-y-4">

          {/* Logo + title */}
          <div className="text-center mb-8">
            <img src={abnLogo} alt="AB Nutribev Corp." className="mx-auto h-16 w-16 rounded-2xl bg-card shadow-elegant p-1 mb-4" />
            <h1 className="text-3xl font-bold">Employee Portal</h1>
            <p className="text-muted-foreground mt-2">Sign in with your company credentials</p>
          </div>

          {/* ── Remember Me welcome-back card ─────────────────────────────── */}
          {usingRemembered && rememberedId && (
            <div className="rounded-2xl bg-primary/10 border border-primary/25 px-5 py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <LogIn className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm leading-snug">Welcome back!</p>
                  <p className="text-xs text-muted-foreground truncate">
                    Signing in as <span className="font-mono font-medium text-foreground">{rememberedId}</span>
                    {" · "}just enter your password.
                  </p>
                </div>
              </div>
              <button
                onClick={clearRemembered}
                className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Sign in as someone else"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* ── Login form ────────────────────────────────────────────────── */}
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl bg-card border border-border shadow-elegant p-8 space-y-5"
          >
            {/* Company ID — hidden when using remembered session */}
            {!usingRemembered && (
              <div className="space-y-2">
                <Label htmlFor="company_id">Company ID</Label>
                <Input
                  id="company_id"
                  value={companyId}
                  onChange={e => setCompanyId(e.target.value)}
                  onKeyDown={onIdKeyDown}
                  placeholder="e.g. ABN-001"
                  autoFocus={!usingRemembered}
                  autoComplete="username"
                  className="rounded-xl h-11"
                />
              </div>
            )}

            {/* Password with show/hide toggle */}
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  ref={passwordRef}
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoFocus={usingRemembered}
                  autoComplete="current-password"
                  className="rounded-xl h-11 pr-11"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me + Forgot row */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                <span className="text-sm text-muted-foreground">Remember my Company ID</span>
              </label>
              <button
                type="button"
                onClick={() => setShowForgot(true)}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors flex items-center gap-1"
              >
                <HelpCircle className="h-3 w-3" /> Forgot password?
              </button>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl gradient-primary text-primary-foreground hover:opacity-90 shadow-soft"
            >
              {loading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <><LogIn className="h-4 w-4 mr-2" /> Sign In</>}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              No account?{" "}
              <Link to="/register" className="text-primary font-medium underline">Register here</Link>
              {" · "}Pending? Contact HR.
            </p>
          </form>
        </div>
      </main>

      {/* ── Forgot Password modal ─────────────────────────────────────────── */}
      {showForgot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          onClick={() => setShowForgot(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-card border border-border shadow-elegant p-6 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-primary" />
                <h2 className="font-bold text-lg">Forgot Password?</h2>
              </div>
              <button
                onClick={() => setShowForgot(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              Password resets are handled by HR. Please contact your HR officer with your <strong>Company ID</strong> and they will reset your password for you.
            </p>

            <div className="rounded-xl bg-muted/60 border border-border p-4 space-y-1 text-sm">
              <p className="font-semibold">Contact HR</p>
              <p className="text-muted-foreground">Visit the HR office or use the messaging feature inside the portal after logging in from another device.</p>
            </div>

            <Button
              className="w-full rounded-xl gradient-primary text-primary-foreground"
              onClick={() => setShowForgot(false)}
            >
              Got it
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
