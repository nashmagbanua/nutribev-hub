/**
 * src/lib/push.ts
 * ───────────────
 * Web Push subscription helpers for MYABN PWA.
 *
 * SETUP:
 *   1. Run: deno run --allow-net generate-vapid-keys.ts
 *   2. Paste public key into .env: VITE_VAPID_PUBLIC_KEY=BEl62iUY...
 *   3. Add VAPID_PRIVATE_KEY + VAPID_PUBLIC_KEY to Supabase Edge Function secrets
 */

import { supabase } from "@/lib/supabase";

// ── Read from .env (add this line to your .env file after generating keys) ───
// VITE_VAPID_PUBLIC_KEY=BEl62iUYgUivxIkv69yViEuiBIa40HI80...
export const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? "";

// ─── Register Service Worker ──────────────────────────────────────────────────
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    return reg;
  } catch (err) {
    console.error("SW registration failed:", err);
    return null;
  }
}

// ─── Convert VAPID base64url key → Uint8Array ─────────────────────────────────
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64     = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw     = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

// ─── Subscribe ────────────────────────────────────────────────────────────────
export async function subscribeToPush(companyId: string): Promise<boolean> {
  if (!VAPID_PUBLIC_KEY) {
    console.error("VITE_VAPID_PUBLIC_KEY not set in .env");
    return false;
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  const reg = await registerServiceWorker();
  if (!reg) return false;
  await navigator.serviceWorker.ready;

  try {
    const sub     = await reg.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    const subJson = sub.toJSON();
    if (!subJson.keys) return false;

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        company_id: companyId,
        endpoint:   sub.endpoint,
        p256dh:     subJson.keys.p256dh,
        auth:       subJson.keys.auth,
        user_agent: navigator.userAgent.slice(0, 200),
      },
      { onConflict: "endpoint" }
    );
    if (error) { console.error("Save subscription error:", error.message); return false; }
    return true;
  } catch (err) {
    console.error("subscribeToPush error:", err);
    return false;
  }
}

// ─── Unsubscribe ──────────────────────────────────────────────────────────────
export async function unsubscribeFromPush(companyId: string): Promise<boolean> {
  try {
    if (!("serviceWorker" in navigator)) return false;
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    if (!reg) return false;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return true;
    await supabase.from("push_subscriptions").delete()
      .eq("company_id", companyId).eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
    return true;
  } catch { return false; }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function getPushPermission(): NotificationPermission | "unsupported" {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export async function isSubscribed(): Promise<boolean> {
  try {
    if (!("serviceWorker" in navigator)) return false;
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    if (!reg) return false;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  } catch { return false; }
}

export function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function isAndroid(): boolean {
  return /android/i.test(navigator.userAgent);
}

export function isInStandaloneMode(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && (navigator as any).standalone === true)
  );
}
