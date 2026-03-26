"use client";

import { useEffect, useRef } from "react";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Registers the app service worker and syncs the browser push subscription to the API.
 * No-ops when VAPID or Push API is unavailable.
 */
export function PushRegistrar() {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (
      typeof window === "undefined" ||
      !vapidPublic ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });
        if (cancelled) return;

        const permission = await Notification.requestPermission();
        if (permission !== "granted" || cancelled) return;

        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          const key = urlBase64ToUint8Array(vapidPublic);
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: key.buffer.slice(
              key.byteOffset,
              key.byteOffset + key.byteLength
            ) as ArrayBuffer,
          });
        }
        if (!sub || cancelled) return;

        const json = sub.toJSON();
        if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;

        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: json.endpoint,
            keys: {
              p256dh: json.keys.p256dh,
              auth: json.keys.auth,
            },
          }),
        });
      } catch {
        // ignore — push is optional
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
