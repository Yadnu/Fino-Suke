/* eslint-disable no-restricted-globals */

// Bump SHELL_VERSION when you change precache URLs or SW logic.
// Bump STATIC_VERSION when you do a major deploy that should flush old JS/CSS.
const SHELL_VERSION = "v2";
const STATIC_VERSION = "v1";

const SHELL_CACHE = `finosuke-shell-${SHELL_VERSION}`;
const STATIC_CACHE = `finosuke-static-${STATIC_VERSION}`;

// All known caches owned by this SW — anything else gets deleted on activate.
const KNOWN_CACHES = new Set([SHELL_CACHE, STATIC_CACHE]);

// Static routes to pre-cache on install
const PRECACHE_URLS = ["/offline.html"];

// ── Install: pre-cache the offline fallback ───────────────────────────────────
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      cache
        .addAll(
          PRECACHE_URLS.map((url) => new Request(url, { credentials: "same-origin" }))
        )
        .catch(() => {
          // Gracefully ignore pre-cache failures (e.g. auth-gated routes)
        })
    )
  );
});

// ── Activate: remove outdated caches and claim all clients ────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !KNOWN_CACHES.has(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Cache-first: return cached value immediately; fall back to network and store. */
function cacheFirst(request, cacheName) {
  return caches.match(request).then(
    (cached) =>
      cached ||
      fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches
            .open(cacheName)
            .then((cache) => cache.put(request, clone))
            .catch(() => {});
        }
        return response;
      })
  );
}

/** Network-first: try network and cache result; on failure serve cache or offline fallback. */
function networkFirst(request, cacheName) {
  return fetch(request)
    .then((response) => {
      if (response.ok) {
        const clone = response.clone();
        caches
          .open(cacheName)
          .then((cache) => cache.put(request, clone))
          .catch(() => {});
      }
      return response;
    })
    .catch(async () => {
      const cached = await caches.match(request);
      return cached || caches.match("/offline.html") || Response.error();
    });
}

// ── Fetch: route traffic by URL pattern ──────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only intercept same-origin GET requests
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  const p = url.pathname;

  // ── 1. Auth routes → always network only (never cache credentials)
  if (p.startsWith("/api/auth/") || p.startsWith("/auth/")) return;

  // ── 2. API routes → network only (dynamic data; let SWR/React Query handle stale)
  if (p.startsWith("/api/")) return;

  // ── 3. Next.js immutable static assets (content-hashed) → cache-first
  //    These never change for a given hash, so it's safe to serve forever from cache.
  if (p.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // ── 4. Next.js image optimisation → cache-first (images are effectively immutable)
  if (p.startsWith("/_next/image")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // ── 5. Next.js data routes → network-first (JSON payloads for RSC/pages)
  if (p.startsWith("/_next/data/")) {
    event.respondWith(networkFirst(request, SHELL_CACHE));
    return;
  }

  // ── 6. Other /_next/ internal routes → pass through (HMR, webpack, etc.)
  if (p.startsWith("/_next/")) return;

  // ── 7. Public static assets (icons, fonts, images) → cache-first
  if (
    p.startsWith("/icon") ||
    p.startsWith("/apple-touch") ||
    p.match(/\.(png|jpg|jpeg|svg|webp|ico|woff2?)$/)
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // ── 8. Navigation requests → network-first with offline fallback
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, SHELL_CACHE));
    return;
  }
});

// ── Push notifications ─────────────────────────────────────────────────────────
self.addEventListener("push", function (event) {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = data.title || "Finosuke";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: data.url || "/dashboard" },
    tag: data.tag || "finosuke-default",
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const url = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (clientList) {
        for (const client of clientList) {
          if (client.url && "focus" in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      })
  );
});
