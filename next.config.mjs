import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",

  // Workbox auto-registers the SW; PushRegistrar.tsx subscribes push on top.
  register: true,

  // Cache pages the user navigates to via <Link> so they're available offline.
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,

  // Reload the app automatically when connectivity is restored.
  reloadOnOnline: true,

  // Disable in dev — SW caching interferes with hot reload and fast refresh.
  // Run `next build && next start` to test offline behaviour.
  disable: process.env.NODE_ENV === "development",

  // Push notification handlers live in worker/index.ts and are merged into
  // the generated SW by the build plugin.
  customWorkerSrc: "worker",

  // Serve public/offline.html as the offline fallback for all document requests.
  fallbacks: {
    document: "/offline.html",
  },

  // Exclude generated SW assets from being precached themselves.
  publicExcludes: ["!sw.js", "!workbox-*.js"],

  workboxOptions: {
    // Don't log Workbox internals in the browser console.
    disableDevLogs: true,

    runtimeCaching: [
      // ── Auth (Clerk) ────────────────────────────────────────────────────────
      // Never cache auth endpoints or sign-in/up pages — always hit the network
      // so session state is never served stale.
      {
        urlPattern: ({ url }) =>
          url.pathname.startsWith("/api/auth") ||
          url.pathname.startsWith("/auth") ||
          url.pathname.startsWith("/sign-in") ||
          url.pathname.startsWith("/sign-up"),
        handler: "NetworkOnly",
      },

      // ── API data routes ─────────────────────────────────────────────────────
      // NetworkFirst: always try the server for fresh financial data; serve the
      // last cached JSON response if the device is offline.
      {
        urlPattern: ({ url }) =>
          [
            "/api/analytics/",
            "/api/transactions",
            "/api/networth/",
            "/api/settings",
            "/api/bills",
            "/api/budgets",
            "/api/savings",
          ].some((prefix) => url.pathname.startsWith(prefix)),
        handler: "NetworkFirst",
        options: {
          cacheName: "finosuke-api-data",
          networkTimeoutSeconds: 10,
          expiration: {
            maxEntries: 64,
            maxAgeSeconds: 24 * 60 * 60,
          },
          cacheableResponse: { statuses: [0, 200] },
        },
      },

      // ── All other API routes ────────────────────────────────────────────────
      // Mutations, push subscribe/unsubscribe, export, etc. — never cache.
      {
        urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
        handler: "NetworkOnly",
      },

      // ── Next.js image optimisation ──────────────────────────────────────────
      // Optimised images are content-addressed; cache-first is safe.
      {
        urlPattern: /\/_next\/image/,
        handler: "CacheFirst",
        options: {
          cacheName: "finosuke-images",
          expiration: {
            maxEntries: 128,
            maxAgeSeconds: 30 * 24 * 60 * 60,
          },
          cacheableResponse: { statuses: [0, 200] },
        },
      },

      // ── Public static assets ────────────────────────────────────────────────
      // Icons, fonts, and images in public/ are content-stable; cache forever.
      {
        urlPattern: /\.(png|jpg|jpeg|svg|webp|ico|woff2?)$/i,
        handler: "CacheFirst",
        options: {
          cacheName: "finosuke-static",
          expiration: {
            maxEntries: 128,
            maxAgeSeconds: 365 * 24 * 60 * 60,
          },
          cacheableResponse: { statuses: [0, 200] },
        },
      },

      // ── Page navigations ────────────────────────────────────────────────────
      // NetworkFirst with a 10 s timeout; falls back to the cached shell so
      // the app still loads on a slow connection or completely offline.
      {
        urlPattern: ({ request }) => request.mode === "navigate",
        handler: "NetworkFirst",
        options: {
          cacheName: "finosuke-pages",
          networkTimeoutSeconds: 10,
          expiration: {
            maxEntries: 64,
            maxAgeSeconds: 24 * 60 * 60,
          },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
    ],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost:3000",
        ...(process.env.VERCEL_URL ? [process.env.VERCEL_URL] : []),
        ...(process.env.NEXT_PUBLIC_APP_URL
          ? [process.env.NEXT_PUBLIC_APP_URL.replace(/^https?:\/\//, "")]
          : []),
      ],
    },
  },
};

export default withPWA(nextConfig);
