import { useEffect, useState } from "react";
import type { Announcement, Profile } from "@/lib/supabase";
import { Cake, Megaphone, PartyPopper } from "lucide-react";
import abnLogo from "@/assets/abn-logo.svg";

type Slide =
  | { kind: "birthdays"; people: Profile[] }
  | { kind: "announcement"; item: Announcement }
  | { kind: "brand" };

export function IdleAds({
  birthdayPeople,
  announcements,
  onExit,
}: {
  birthdayPeople: Profile[];
  announcements: Announcement[];
  onExit: () => void;
}) {
  const slides: Slide[] = [
    { kind: "brand" },
    ...(birthdayPeople.length > 0 ? [{ kind: "birthdays", people: birthdayPeople } as Slide] : []),
    ...announcements.filter(a => a.active).map(a => ({ kind: "announcement", item: a } as Slide)),
  ];
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;
    const t = setInterval(() => setIdx(i => (i + 1) % slides.length), 7000);
    return () => clearInterval(t);
  }, [slides.length]);

  useEffect(() => {
    const wake = () => onExit();
    window.addEventListener("mousemove", wake);
    window.addEventListener("keydown", wake);
    window.addEventListener("touchstart", wake);
    return () => {
      window.removeEventListener("mousemove", wake);
      window.removeEventListener("keydown", wake);
      window.removeEventListener("touchstart", wake);
    };
  }, [onExit]);

  const slide = slides[idx];

  return (
    <div className="fixed inset-0 z-40 bg-gradient-to-br from-primary via-primary to-accent text-primary-foreground flex items-center justify-center p-8 animate-fade-in">
      <div className="absolute top-6 left-6 flex items-center gap-3">
        <img src={abnLogo} alt="" className="h-12 w-12 rounded-xl bg-white/95 p-1" />
        <div className="font-bold text-xl">AB Nutribev Corp.</div>
      </div>
      <div className="absolute bottom-6 right-6 text-sm opacity-80">Touch screen to begin</div>

      <div key={idx} className="max-w-5xl w-full animate-scale-in">
        {slide?.kind === "brand" && (
          <div className="text-center space-y-6">
            <img src={abnLogo} alt="" className="h-32 w-32 mx-auto rounded-3xl bg-white/95 p-3" />
            <h1 className="text-6xl font-extrabold tracking-tight">Welcome to AB Nutribev Corp.</h1>
            <p className="text-2xl opacity-90">Tap the screen to time in or out.</p>
          </div>
        )}

        {slide?.kind === "birthdays" && (
          <div className="text-center space-y-8">
            <div className="inline-flex items-center gap-3 bg-white/15 backdrop-blur rounded-full px-6 py-2">
              <PartyPopper className="h-6 w-6" />
              <span className="uppercase tracking-widest text-sm font-bold">Birthdays Today</span>
            </div>
            <h2 className="text-5xl font-extrabold">🎂 Happy Birthday!</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[60vh] overflow-hidden">
              {slide.people.slice(0, 9).map(p => (
                <div key={p.id} className="rounded-2xl bg-white/15 backdrop-blur border border-white/30 p-5 text-left">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                      <Cake className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold truncate">{p.full_name}</div>
                      <div className="text-sm opacity-90 truncate">{p.position ?? p.role}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {slide?.kind === "announcement" && (
          <div className="text-center space-y-6">
            <div className="inline-flex items-center gap-3 bg-white/15 backdrop-blur rounded-full px-6 py-2">
              <Megaphone className="h-5 w-5" />
              <span className="uppercase tracking-widest text-sm font-bold">Announcement</span>
            </div>
            <h2 className="text-5xl font-extrabold">{slide.item.title}</h2>
            {slide.item.image_url && (
              <img src={slide.item.image_url} alt="" className="max-h-[40vh] mx-auto rounded-2xl object-cover shadow-elegant" />
            )}
            {slide.item.body && <p className="text-xl opacity-95 max-w-3xl mx-auto">{slide.item.body}</p>}
          </div>
        )}
      </div>

      {/* dots */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
        {slides.map((_, i) => (
          <span key={i} className={`h-2 rounded-full transition-all ${i === idx ? "w-8 bg-white" : "w-2 bg-white/40"}`} />
        ))}
      </div>
    </div>
  );
}
