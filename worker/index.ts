// Custom service worker code merged into the Workbox-generated SW by
// @ducanh2912/next-pwa at build time.  Handles push notifications,
// notification click navigation, and background sync — everything Workbox doesn't cover.

import { dequeue, getAll } from "../lib/offlineQueue";

declare const self: ServiceWorkerGlobalScope;

// SyncEvent is not yet in the TypeScript dom lib — declare it locally.
interface SyncEvent extends ExtendableEvent {
  readonly tag: string;
  readonly lastChance: boolean;
}

// ── Push notifications ────────────────────────────────────────────────────────

self.addEventListener("push", (event) => {
  let data: {
    title?: string;
    body?: string;
    icon?: string;
    url?: string;
    tag?: string;
  } = {};

  try {
    data = event.data ? (event.data.json() as typeof data) : {};
  } catch {
    data = {};
  }

  const title = data.title ?? "Finosuke";
  const options: NotificationOptions = {
    body: data.body ?? "",
    icon: data.icon ?? "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: data.url ?? "/dashboard" },
    tag: data.tag ?? "finosuke-default",
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── SW update ─────────────────────────────────────────────────────────────────
// When SwUpdateBanner posts SKIP_WAITING, activate the new SW immediately.

self.addEventListener("message", (event) => {
  if ((event.data as { type?: string } | null)?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// ── Background sync ───────────────────────────────────────────────────────────
// Drains the IndexedDB offline queue when connectivity is restored.

self.addEventListener("sync", (event) => {
  if ((event as SyncEvent).tag !== "finosuke-mutations") return;

  event.waitUntil(
    (async () => {
      const pending = await getAll();
      for (const req of pending) {
        try {
          const response = await fetch(req.url, {
            method: req.method,
            body: req.body,
            headers: req.headers,
          });
          if (response.ok) {
            await dequeue();
          }
        } catch {
          // Leave the request in the queue; the next sync will retry.
        }
      }
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url: string =
    (event.notification.data as { url?: string } | undefined)?.url ??
    "/dashboard";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url && "focus" in client) {
            return (client as WindowClient).focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      })
  );
});
