const OFFLINE_CACHE = "getneba-offline-v2";

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
