/**
 * public/sw.js  —  MYABN Service Worker
 * ──────────────────────────────────────
 * Handles push notifications + basic offline cache.
 * Must live at public/sw.js (root of domain scope).
 */

const CACHE_NAME = "myabn-v1";
const LOGO_URL   = "https://qbeacrpoyfacgmbzxjcu.supabase.co/storage/v1/object/public/uploads/announcements/MYABN.png";
const APP_SHELL  = ["/", "/index.html", "/manifest.json"];

// ── Install ─────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((c) => c.addAll(APP_SHELL).catch(() => {}))
  );
  self.skipWaiting();
});

// ── Activate: remove old caches ─────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: network-first, fallback to cache ─────────────────────────────────
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.hostname.includes("supabase.co")) return;

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok && APP_SHELL.includes(url.pathname)) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});

// ── Push: display notification ──────────────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try   { payload = event.data.json(); }
  catch { payload = { title: "MYABN", body: event.data.text(), type: "general", url: "/dashboard" }; }

  const {
    title    = "MYABN Notification",
    body     = "",
    type     = "general",
    url      = "/dashboard",
    timeIn,
    timeOut,
    duration,
  } = payload;

  const richBody = (type === "attendance" && timeIn && timeOut)
    ? `🟢 In: ${timeIn}   🔴 Out: ${timeOut}   ⏱ ${duration || "—"}`
    : body;

  const actionsMap = {
    attendance:   [{ action: "view", title: "View Dashboard" }, { action: "dismiss", title: "Dismiss" }],
    clinic:       [{ action: "view", title: "View Clinic" },    { action: "dismiss", title: "Dismiss" }],
    ppe:          [{ action: "view", title: "View PPE" },        { action: "dismiss", title: "Dismiss" }],
    announcement: [{ action: "view", title: "Read More" },       { action: "dismiss", title: "Dismiss" }],
    general:      [{ action: "dismiss", title: "Dismiss" }],
  };

  event.waitUntil(
    self.registration.showNotification(title, {
      body:    richBody,
      icon:    LOGO_URL,
      badge:   LOGO_URL,
      tag:     `myabn-${type}-${Date.now()}`,
      vibrate: [200, 100, 200],
      data:    { url },
      actions: actionsMap[type] ?? actionsMap.general,
    })
  );
});

// ── Notification click ───────────────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;

  const targetUrl = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.includes(self.location.origin) && "focus" in w) {
          w.focus();
          w.navigate(targetUrl);
          return;
        }
      }
      if (clients.openWindow) clients.openWindow(targetUrl);
    })
  );
});

// ── Subscription change (browser rotates push keys) ─────────────────────────
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe({ userVisibleOnly: true })
      .then((sub) =>
        self.clients.matchAll().then((cls) =>
          cls.forEach((c) =>
            c.postMessage({ type: "PUSH_SUBSCRIPTION_CHANGED", subscription: sub.toJSON() })
          )
        )
      )
  );
});
