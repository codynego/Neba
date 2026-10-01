const OFFLINE_CACHE = "getneba-offline-v3";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(OFFLINE_CACHE).then((cache) => cache.addAll(["/offline.html", "/brand/getneba-wordmark.svg", "/icons/getneba-192.png"])).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => (key.startsWith("neba-offline-") || key.startsWith("getneba-offline-")) && key !== OFFLINE_CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  // Authenticated pages, API responses and conversations are never cached.
  if (event.request.mode !== "navigate" || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).catch(async () => (await caches.match("/offline.html")) || new Response("You are offline. Reconnect to use GetNeba.", { status: 503, headers: { "Content-Type": "text/plain" } })));
});
self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = { body: event.data ? event.data.text() : "" }; }
  const path = typeof payload.path === "string" && payload.path.startsWith("/") ? payload.path : "/notifications";
  event.waitUntil(self.registration.showNotification(payload.title || "GetNeba", {
    body: payload.body || "You have a new update.",
    icon: "/icons/getneba-192.png",
    badge: "/icons/getneba-192.png",
    tag: `neba-${payload.notification_id || "update"}`,
    renotify: true,
    data: { path },
  }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.path || "/notifications", self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) return existing.navigate(target).then(() => existing.focus());
    return self.clients.openWindow(target);
  }));
});
