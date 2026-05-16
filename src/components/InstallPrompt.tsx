/**
 * src/components/InstallPrompt.tsx
 * ─────────────────────────────────
 * Smart PWA install banner.
 * - iOS:     shows Safari "Add to Home Screen" step-by-step guide
 * - Android: triggers native Chrome install prompt
 * - Shows once, dismissed state saved in localStorage
 *
 * Usage: <InstallPrompt /> inside App.tsx or index layout
 */

import { useEffect, useState } from "react";
import { isIOS, isInStandaloneMode } from "@/lib/push";
import { X, Share, PlusSquare, Smartphone } from "lucide-react";

const DISMISSED_KEY = "myabn_install_dismissed";

export function InstallPrompt() {
  const [show, setShow]             = useState(false);
  const [isIOSDevice, setIsIOS]     = useState(false);
  // deferredPrompt for Android Chrome native install
  const [deferredPrompt, setDeferred] = useState<any>(null);

  useEffect(() => {
    // Don't show if already installed or dismissed
    if (isInStandaloneMode()) return;
    if (localStorage.getItem(DISMISSED_KEY)) return;

    const ios = isIOS();
    setIsIOS(ios);

    if (ios) {
      // On iOS, always show our custom guide (no native event)
      setTimeout(() => setShow(true), 3000);
      return;
    }

    // Android/Desktop: listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e);
      setTimeout(() => setShow(true), 3000);
    };
    window.addEventListener("beforeinstallprompt", handler as any);
    return () => window.removeEventListener("beforeinstallprompt", handler as any);
  }, []);

  const dismiss = () => {
    setShow(false);
    localStorage.setItem(DISMISSED_KEY, "1");
  };

  const installAndroid = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === "accepted") {
      setShow(false);
    }
    setDeferred(null);
  };

  if (!show) return null;

  return (
    <div
      className="fixed bottom-20 md:bottom-6 left-4 right-4 z-50 max-w-sm mx-auto
                 rounded-2xl bg-card border border-border shadow-elegant
                 animate-in slide-in-from-bottom-4 duration-300"
      role="dialog"
      aria-label="Install MYABN App"
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Smartphone className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm leading-tight">Install MYABN App</p>
          <p className="text-xs text-muted-foreground">
            Get push notifications &amp; offline access
          </p>
        </div>
        <button
          onClick={dismiss}
          className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {isIOSDevice ? (
          /* iOS step-by-step guide */
          <div className="space-y-2.5">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              To install on iPhone / iPad:
            </p>
            <Step num={1} icon={<Share className="h-4 w-4 text-sky-500" />}>
              Tap the <strong>Share</strong> button{" "}
              <span className="inline-flex items-center gap-0.5 bg-muted px-1.5 py-0.5 rounded text-xs">
                <Share className="h-3 w-3" /> Share
              </span>{" "}
              at the bottom of Safari
            </Step>
            <Step num={2} icon={<PlusSquare className="h-4 w-4 text-sky-500" />}>
              Scroll down and tap{" "}
              <strong>"Add to Home Screen"</strong>
            </Step>
            <Step num={3} icon={<span className="text-base">✅</span>}>
              Tap <strong>Add</strong> — done! The app icon will appear on your Home Screen.
            </Step>
            <p className="text-[11px] text-muted-foreground leading-relaxed pt-1">
              Requires iOS 16.4 or later for push notifications.
            </p>
          </div>
        ) : (
          /* Android / Desktop */
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Install MYABN as an app for faster access and push notifications
              — even when offline.
            </p>
            <button
              onClick={installAndroid}
              className="w-full rounded-xl py-2.5 text-sm font-bold
                         bg-primary text-primary-foreground
                         hover:opacity-90 transition-opacity"
            >
              📲 Install App
            </button>
          </div>
        )}
      </div>

      {/* Footer dismiss */}
      <div className="px-4 pb-4 text-center">
        <button
          onClick={dismiss}
          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}

function Step({ num, icon, children }: { num: number; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold
                      flex items-center justify-center shrink-0 mt-0.5">
        {num}
      </div>
      <div className="flex items-start gap-2 text-sm leading-snug">
        <span className="shrink-0 mt-0.5">{icon}</span>
        <span>{children}</span>
      </div>
    </div>
  );
}
