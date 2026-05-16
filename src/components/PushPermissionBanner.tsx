/**
 * src/components/PushPermissionBanner.tsx
 * ────────────────────────────────────────
 * Notification opt-in banner shown in EmployeeDashboard after login.
 * - One tap to enable push notifications
 * - Detects current permission state
 * - Shows "Notifications enabled" confirmation
 * - Handles "denied" state gracefully with instructions
 *
 * Usage:
 *   <PushPermissionBanner companyId={profile.company_id} />
 *   Place near top of the Home tab in EmployeeDashboard
 */

import { useEffect, useState } from "react";
import {
  subscribeToPush,
  unsubscribeFromPush,
  getPushPermission,
  isSubscribed,
  isIOS,
  isInStandaloneMode,
} from "@/lib/push";
import { Bell, BellOff, BellRing, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const BANNER_DISMISSED_KEY = "myabn_push_banner_dismissed";

interface Props {
  companyId: string;
}

type BannerState =
  | "idle"          // checking
  | "prompt"        // show opt-in banner
  | "loading"       // subscribing in progress
  | "enabled"       // successfully subscribed
  | "denied"        // user blocked notifications
  | "unsupported"   // browser doesn't support it
  | "hidden";       // dismissed by user

export function PushPermissionBanner({ companyId }: Props) {
  const [state, setState] = useState<BannerState>("idle");

  useEffect(() => {
    const check = async () => {
      const permission = getPushPermission();

      if (permission === "unsupported") { setState("unsupported"); return; }
      if (permission === "denied")      { setState("denied"); return; }

      // Already subscribed
      if (await isSubscribed()) { setState("enabled"); return; }

      // Check if user dismissed before
      if (localStorage.getItem(BANNER_DISMISSED_KEY)) { setState("hidden"); return; }

      // iOS requirement: must be in standalone mode for push
      if (isIOS() && !isInStandaloneMode()) { setState("hidden"); return; }

      // Ready to prompt
      setState("prompt");
    };
    check();
  }, [companyId]);

  const enable = async () => {
    setState("loading");
    const ok = await subscribeToPush(companyId);
    setState(ok ? "enabled" : "denied");
  };

  const dismiss = () => {
    localStorage.setItem(BANNER_DISMISSED_KEY, "1");
    setState("hidden");
  };

  const disable = async () => {
    await unsubscribeFromPush(companyId);
    setState("prompt");
  };

  // ── Render states ───────────────────────────────────────────────────────────

  if (state === "hidden" || state === "idle" || state === "unsupported") return null;

  // Already enabled — compact green pill
  if (state === "enabled") {
    return (
      <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/25
                       px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BellRing className="h-4 w-4 text-emerald-500 shrink-0" />
          <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
            Push notifications enabled
          </span>
        </div>
        <button
          onClick={disable}
          className="text-xs text-muted-foreground hover:text-destructive transition-colors"
          title="Turn off notifications"
        >
          Turn off
        </button>
      </div>
    );
  }

  // Denied — show instructions
  if (state === "denied") {
    return (
      <div className="rounded-xl bg-warning/10 border border-warning/30
                       px-4 py-3 flex items-start gap-3">
        <BellOff className="h-5 w-5 text-warning shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Notifications blocked</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            To enable: tap the 🔒 lock icon in your browser address bar
            → Site settings → Notifications → Allow.
          </p>
        </div>
        <button onClick={dismiss} className="shrink-0 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // Prompt — main opt-in banner
  return (
    <div className="rounded-2xl bg-card border border-primary/25 shadow-soft
                     overflow-hidden animate-in slide-in-from-top-2 duration-300">
      {/* Accent top bar */}
      <div className="h-1 w-full bg-gradient-to-r from-primary to-accent" />

      <div className="p-4 flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Bell className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm leading-snug">
            Enable Shift Notifications
          </p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Get your attendance summary, clinic updates, and announcements
            directly on your phone — no email needed.
          </p>

          {/* What you'll get */}
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {[
              "📋 Shift summary",
              "💊 Clinic ready",
              "🦺 PPE approved",
              "📢 Announcements",
            ].map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-muted px-2 py-0.5 text-[11px]
                           text-muted-foreground font-medium"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 mt-3">
            <Button
              size="sm"
              onClick={enable}
              disabled={state === "loading"}
              className="rounded-xl gradient-primary text-primary-foreground h-8 text-xs"
            >
              {state === "loading" ? (
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  Enabling…
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Bell className="h-3.5 w-3.5" /> Enable Notifications
                </span>
              )}
            </Button>
            <button
              onClick={dismiss}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              Not now
            </button>
          </div>
        </div>

        <button
          onClick={dismiss}
          className="shrink-0 rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
