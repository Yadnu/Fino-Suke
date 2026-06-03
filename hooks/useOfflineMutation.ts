"use client";

import { useCallback, useEffect, useState } from "react";
import { enqueue, getAll } from "@/lib/offlineQueue";

const SYNC_TAG = "finosuke-mutations";

async function tryRegisterSync(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    if ("sync" in reg) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (reg as any).sync.register(SYNC_TAG);
    }
  } catch {
    // Background Sync API not supported or SW not yet active; will retry on next visit.
  }
}

function normalizeHeaders(headers?: HeadersInit): Record<string, string> {
  if (!headers) return {};
  const result: Record<string, string> = {};
  new Headers(headers).forEach((v, k) => {
    result[k] = v;
  });
  return result;
}

/**
 * Wraps `fetch` for mutating requests (POST / PATCH / DELETE).
 *
 * When offline (or on a network `TypeError`), the request is persisted to
 * IndexedDB and a Background Sync tag is registered so the SW replays it once
 * connectivity is restored.  A synthetic `202 { queued: true }` response is
 * returned so callers can branch their UI accordingly.
 *
 * `pendingCount` reflects the current number of queued requests and updates
 * whenever the queue changes or the device comes back online.
 */
export function useOfflineMutation() {
  const [pendingCount, setPendingCount] = useState(0);

  const refreshCount = useCallback(async () => {
    if (typeof indexedDB === "undefined") return;
    const items = await getAll();
    setPendingCount(items.length);
  }, []);

  useEffect(() => {
    void refreshCount();

    const handleUpdate = () => { void refreshCount(); };
    // After the SW drains the queue on reconnect, wait a moment then re-check.
    const handleOnline = () => { setTimeout(() => { void refreshCount(); }, 2500); };

    window.addEventListener("finosuke:queue-update", handleUpdate);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("finosuke:queue-update", handleUpdate);
      window.removeEventListener("online", handleOnline);
    };
  }, [refreshCount]);

  const mutate = useCallback(
    async (url: string, options: RequestInit = {}): Promise<Response> => {
      if (navigator.onLine) {
        try {
          return await fetch(url, options);
        } catch (err) {
          // Only queue on network-level errors, not HTTP errors.
          if (!(err instanceof TypeError)) throw err;
        }
      }

      const body =
        typeof options.body === "string"
          ? options.body
          : options.body instanceof URLSearchParams
          ? options.body.toString()
          : "";

      await enqueue({
        url,
        method: options.method ?? "GET",
        body,
        headers: normalizeHeaders(options.headers),
      });

      await tryRegisterSync();
      window.dispatchEvent(new CustomEvent("finosuke:queue-update"));

      return new Response(JSON.stringify({ queued: true }), {
        status: 202,
        headers: { "Content-Type": "application/json" },
      });
    },
    []
  );

  return { mutate, pendingCount };
}
