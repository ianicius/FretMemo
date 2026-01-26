/* Minimal PWA service worker for the FretMemo tool.
   - Precaches core same-origin assets
   - Uses navigation fallback to the app shell
   - Runtime-caches Tailwind CDN + Google Fonts so the tool still renders offline */

const VERSION = "v1";
const STATIC_CACHE = `fretmemo-static-${VERSION}`;
const RUNTIME_CACHE = `fretmemo-runtime-${VERSION}`;

const PRECACHE_URLS = [
  "/index.html",
  "/styles.css",
  "/manifest.webmanifest",
  "/icon.svg",
  "/fretmemo-preview.jpg",
  "/blog.html",
  "/faq.html",
  "/rss.xml",
  "/llms.txt",
];

const RUNTIME_HOST_ALLOWLIST = new Set([
  "cdn.tailwindcss.com",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("fretmemo-") && ![STATIC_CACHE, RUNTIME_CACHE].includes(key))
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // App-shell for navigations (so "refresh" works offline).
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(async () => (await caches.match("/index.html")) || Response.error())
    );
    return;
  }

  // Same-origin assets: cache-first.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req)
          .then((res) => {
            const resClone = res.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(req, resClone)).catch(() => {});
            return res;
          })
          .catch(() => cached || Response.error());
      })
    );
    return;
  }

  // Selected cross-origin resources: stale-while-revalidate.
  if (RUNTIME_HOST_ALLOWLIST.has(url.hostname)) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then((cache) =>
        cache.match(req).then((cached) => {
          const fetchPromise = fetch(req)
            .then((res) => {
              cache.put(req, res.clone()).catch(() => {});
              return res;
            })
            .catch(() => cached);
          return cached || fetchPromise;
        })
      )
    );
  }
});
