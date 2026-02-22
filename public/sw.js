/* public/sw.js */
const CORE_ASSETS = [
  "/",
  "/dashboard",
  "/offline",
  "/manifest.webmanifest",
  "/build.txt",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-512-maskable.png",
  "/icons/apple-touch-icon.png",
];

async function getBuildVersion() {
  try {
    const res = await fetch("/build.txt", { cache: "no-store" });
    const txt = await res.text();
    return (txt || "v1").trim();
  } catch {
    return "v1";
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const v = await getBuildVersion();
      const CACHE_NAME = `helixx-cache-${v}`;

      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(CORE_ASSETS);

      self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const v = await getBuildVersion();
      const keep = `helixx-cache-${v}`;

      const keys = await caches.keys();
      await Promise.all(keys.map((k) => (k !== keep ? caches.delete(k) : null)));

      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (url.origin !== self.location.origin) return;

  // Navigations (pages): network-first, fallback to offline
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        const v = await getBuildVersion();
        const CACHE_NAME = `helixx-cache-${v}`;
        const cache = await caches.open(CACHE_NAME);

        try {
          const fresh = await fetch(req);
          cache.put(req, fresh.clone());
          return fresh;
        } catch {
          return (await cache.match(req)) || (await cache.match("/offline")) || Response.error();
        }
      })()
    );
    return;
  }

  // Assets: cache-first (per build)
  event.respondWith(
    (async () => {
      const v = await getBuildVersion();
      const CACHE_NAME = `helixx-cache-${v}`;
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