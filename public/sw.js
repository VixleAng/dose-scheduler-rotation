/* public/sw.js */
const CACHE_NAME = "helixx-cache-v1";

// Keep this list small + safe (pages + icons)
const CORE_ASSETS = [
  "/",
  "/dashboard",
  "/offline",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-512-maskable.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(CORE_ASSETS);
      self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // Navigations (pages): network-first, fallback to cache/offline
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, fresh.clone());
          return fresh;
        } catch {
          const cache = await caches.open(CACHE_NAME);
          return (await cache.match(req)) || (await cache.match("/offline")) || Response.error();
        }
      })()
    );
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      if (cached) return cached;

      try {
        const fresh = await fetch(req);
        cache.put(req, fresh.clone());
        return fresh;
      } catch {
        return cached || Response.error();
      }
    })()
  );
});