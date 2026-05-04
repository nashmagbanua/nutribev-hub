import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ShieldCheck, Users, Sparkles, Award, Heart, Lightbulb, LogIn, UserPlus, ChevronRight } from "lucide-react";
import factoryBg from "@/assets/factory-bg.webp";
import abnLogo from "@/assets/abn-logo.svg";
import { Footer } from "@/components/Footer";

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* HERO */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${factoryBg})` }} aria-hidden />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/85 via-primary/75 to-accent/60" aria-hidden />
        <div className="relative z-10 container py-6 flex items-center justify-between">
          <div className="flex items-center gap-3 text-primary-foreground">
            <img src={abnLogo} alt="AB Nutribev Corp." className="h-12 w-12 drop-shadow-lg" />
            <div className="leading-tight">
              <div className="font-bold text-lg">AB Nutribev Corp.</div>
              <div className="text-xs opacity-90 uppercase tracking-widest">Beverage Manufacturing</div>
            </div>
          </div>
          <ThemeToggle />
        </div>
        <div className="relative z-10 container py-16 md:py-24 text-primary-foreground text-center">
          <img src={abnLogo} alt="" className="mx-auto h-24 w-24 md:h-32 md:w-32 drop-shadow-2xl mb-6" />
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight">AB Nutribev Corp.</h1>
          <p className="mt-4 text-lg md:text-xl opacity-95 max-w-2xl mx-auto">
            A world-class beverage company committed to safe, quality products and continuous improvement.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 justify-center">
            <Button asChild size="lg" className="rounded-2xl bg-white text-primary hover:bg-white/90 shadow-elegant">
              <Link to="/login"><LogIn className="h-4 w-4 mr-2" /> Employee Login</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-2xl bg-white/10 border-white/40 text-primary-foreground hover:bg-white/20">
              <Link to="/register"><UserPlus className="h-4 w-4 mr-2" /> Register Account</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Mission / Vision */}
        <section className="container py-14 grid md:grid-cols-2 gap-6">
          <Card icon={<Sparkles className="h-6 w-6" />} title="Our Mission">
            To provide consumers with quality products at affordable prices, supported by outstanding service and a culture of continuous improvement.
          </Card>
          <Card icon={<Award className="h-6 w-6" />} title="Our Vision">
            To be a world-class, fully diversified Beverage Company respected by consumers and business partners.
          </Card>
        </section>

        {/* Food Safety & Quality */}
        <section className="bg-muted/40 py-14">
          <div className="container">
            <div className="text-center mb-10">
              <h2 className="text-3xl md:text-4xl font-bold flex items-center gap-3 justify-center">
                <ShieldCheck className="h-8 w-8 text-primary" /> Food Safety &amp; Quality Policy
              </h2>
              <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
                AB Nutribev Corp is dedicated to excellence through ISO-compliant systems and continuous people development.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                "Manufacture safe and quality food products",
                "Provide quality service",
                "Optimize operational returns",
                "Comply with legal requirements",
                "Implement ISO systems",
                "Develop employee competencies",
              ].map((item) => (
                <div key={item} className="rounded-2xl bg-card border border-border p-5 shadow-soft flex items-start gap-3">
                  <ChevronRight className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <span className="text-sm font-medium">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Core Values */}
        <section className="container py-14">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold">Core Values</h2>
            <p className="text-muted-foreground mt-2">The principles that guide our work every day.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { icon: <Award className="h-6 w-6" />, label: "Leadership" },
              { icon: <Users className="h-6 w-6" />, label: "Teamwork" },
              { icon: <Lightbulb className="h-6 w-6" />, label: "Initiative" },
              { icon: <ShieldCheck className="h-6 w-6" />, label: "Integrity" },
              { icon: <Heart className="h-6 w-6" />, label: "Dedication" },
            ].map(v => (
              <div key={v.label} className="rounded-2xl bg-card border border-border p-6 shadow-soft text-center">
                <div className="mx-auto h-12 w-12 rounded-xl gradient-primary text-primary-foreground flex items-center justify-center mb-3">
                  {v.icon}
                </div>
                <div className="font-bold">{v.label}</div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-card border border-border shadow-soft p-7">
      <div className="flex items-center gap-3 mb-3">
        <div className="h-12 w-12 rounded-xl gradient-primary text-primary-foreground flex items-center justify-center">{icon}</div>
        <h3 className="text-2xl font-bold">{title}</h3>
      </div>
      <p className="text-muted-foreground leading-relaxed">{children}</p>
    </div>
  );
}
