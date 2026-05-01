import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ArrowRight, Monitor, ShieldCheck, Sparkles, Target, Users } from "lucide-react";
import factoryHero from "@/assets/factory-hero.jpg";

const values = [
  { label: "Leadership" }, { label: "Teamwork" }, { label: "Initiative" },
  { label: "Integrity" }, { label: "Dedication" },
];

const policies = [
  "Manufacture safe and quality food products",
  "Provide quality service",
  "Optimize operations",
  "Comply with laws",
  "Implement ISO systems",
  "Develop employees",
];

export default function Landing() {
  return (
    <div className="min-h-screen gradient-subtle">
      <header className="border-b border-border bg-card/70 backdrop-blur sticky top-0 z-40">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl gradient-primary shadow-soft flex items-center justify-center text-primary-foreground font-bold">AB</div>
            <span className="font-bold text-lg">AB Nutribev Corp.</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button asChild variant="outline" className="rounded-2xl"><Link to="/kiosk"><Monitor className="h-4 w-4 mr-2" />Kiosk Mode</Link></Button>
            <Button asChild className="rounded-2xl gradient-primary text-primary-foreground hover:opacity-90 shadow-soft">
              <Link to="/login">Employee Login <ArrowRight className="h-4 w-4 ml-2" /></Link>
            </Button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="container grid lg:grid-cols-2 gap-10 items-center py-16 lg:py-24">
        <div className="space-y-6 animate-fade-in">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
            <Sparkles className="h-4 w-4" /> Beverage Manufacturing Excellence
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight">
            AB Nutribev <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Corp.</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl">
            A leading beverage manufacturing company producing <span className="font-semibold text-foreground">Vitamilk</span> and <span className="font-semibold text-foreground">Pascual</span> products — committed to quality, safety and continuous improvement.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="rounded-2xl gradient-primary text-primary-foreground shadow-elegant hover:opacity-90">
              <Link to="/login">Employee Login <ArrowRight className="h-4 w-4 ml-2" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-2xl">
              <Link to="/kiosk">Open Kiosk</Link>
            </Button>
          </div>
        </div>
        <div className="relative animate-slide-in">
          <div className="absolute -inset-4 gradient-primary opacity-20 blur-3xl rounded-3xl" />
          <img
            src={factoryHero}
            alt="AB Nutribev beverage manufacturing factory"
            width={1280} height={960}
            className="relative rounded-2xl shadow-elegant w-full h-auto object-cover"
          />
        </div>
      </section>

      {/* MISSION / VISION */}
      <section className="container grid md:grid-cols-2 gap-6 pb-16">
        <Card icon={<Target className="h-6 w-6" />} title="Our Mission">
          To provide consumers with quality products at affordable prices, supported by outstanding service and continuous improvement.
        </Card>
        <Card icon={<Sparkles className="h-6 w-6" />} title="Our Vision">
          To be a world-class, fully diversified Beverage Company.
        </Card>
      </section>

      {/* CORE VALUES */}
      <section className="container pb-16">
        <h2 className="text-3xl font-bold text-center mb-2">Core Values</h2>
        <p className="text-center text-muted-foreground mb-8">The principles that guide every bottle we produce.</p>
        <div className="flex flex-wrap justify-center gap-3">
          {values.map(v => (
            <div key={v.label} className="px-6 py-3 rounded-2xl bg-card border border-border shadow-soft font-semibold hover:shadow-elegant transition-smooth hover:-translate-y-0.5">
              {v.label}
            </div>
          ))}
        </div>
      </section>

      {/* FOOD SAFETY */}
      <section className="container pb-20">
        <div className="rounded-2xl gradient-hero p-8 md:p-12 shadow-elegant text-primary-foreground">
          <div className="flex items-center gap-3 mb-6">
            <ShieldCheck className="h-8 w-8" />
            <h2 className="text-3xl font-bold">Food Safety Policy</h2>
          </div>
          <ul className="grid md:grid-cols-2 gap-4">
            {policies.map(p => (
              <li key={p} className="flex items-start gap-3 bg-white/10 backdrop-blur rounded-xl p-4">
                <div className="h-2 w-2 rounded-full bg-accent mt-2 shrink-0" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} AB Nutribev Corp. All rights reserved.
      </footer>
    </div>
  );
}

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-card border border-border shadow-soft p-8 hover:shadow-elegant transition-smooth">
      <div className="h-12 w-12 rounded-xl gradient-primary text-primary-foreground flex items-center justify-center mb-4 shadow-soft">{icon}</div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-muted-foreground">{children}</p>
    </div>
  );
}
