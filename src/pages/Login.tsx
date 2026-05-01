import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Loader2, LogIn } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function Login() {
  const [companyId, setCompanyId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId.trim() || !password) {
      toast.error("Please enter both Company ID and password.");
      return;
    }
    setLoading(true);
    const { error } = await login(companyId, password);
    setLoading(false);
    if (error) { toast.error(error); return; }
    toast.success("Welcome back!");
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen gradient-subtle flex flex-col">
      <header className="container flex h-16 items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-smooth">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex h-14 w-14 rounded-2xl gradient-primary shadow-elegant items-center justify-center text-primary-foreground font-bold text-xl mb-4">AB</div>
            <h1 className="text-3xl font-bold">Employee Portal</h1>
            <p className="text-muted-foreground mt-2">Sign in with your company credentials</p>
          </div>
          <form onSubmit={handleSubmit} className="rounded-2xl bg-card border border-border shadow-elegant p-8 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="company_id">Company ID</Label>
              <Input id="company_id" value={companyId} onChange={(e) => setCompanyId(e.target.value)} placeholder="e.g. ABN-001" autoFocus className="rounded-xl h-11" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="rounded-xl h-11" />
            </div>
            <Button type="submit" disabled={loading} className="w-full h-11 rounded-xl gradient-primary text-primary-foreground hover:opacity-90 shadow-soft">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><LogIn className="h-4 w-4 mr-2" /> Sign In</>)}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Account pending? Contact HR for approval.
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}
