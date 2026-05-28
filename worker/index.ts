// Custom service worker code merged into the Workbox-generated SW by
// @ducanh2912/next-pwa at build time.  Handles push notifications and
// notification click navigation — everything Workbox doesn't cover.

declare const self: ServiceWorkerGlobalScope;

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
