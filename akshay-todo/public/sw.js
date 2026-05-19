// Bump version every deploy to force cache refresh
const CACHE = "akshay-todo-v3";

self.addEventListener("install", (e) => {
  // Pre-cache nothing on install — let pages load fresh from network
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  // Delete ALL old caches
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Always network-first for: API, HTML documents, SW itself
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname === "/sw.js" ||
    e.request.mode === "navigate" // HTML pages
  ) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Cache-first only for hashed static assets (/assets/*)
  if (url.pathname.startsWith("/assets/")) {
    e.respondWith(
      caches.open(CACHE).then((cache) =>
        cache.match(e.request).then(
          (cached) =>
            cached ||
            fetch(e.request).then((res) => {
              cache.put(e.request, res.clone());
              return res;
            })
        )
      )
    );
    return;
  }

  // Everything else: network with cache fallback
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
