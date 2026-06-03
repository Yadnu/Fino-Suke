"use client";

import { useEffect, useState } from "react";
import { WifiOff, RefreshCw } from "lucide-react";
import { getAll } from "@/lib/offlineQueue";

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    // Initialise from current state (navigator.onLine may be false on mount)
    setOffline(!navigator.onLine);

    async function refreshCount() {
      if (typeof indexedDB === "undefined") return;
      const items = await getAll();
      setPendingCount(items.length);
    }

    void refreshCount();

    const goOffline = () => setOffline(true);
    const goOnline = () => {
      setOffline(false);
      // After SW drains the queue on reconnect, re-check pending count.
      setTimeout(() => { void refreshCount(); }, 2500);
    };
    const handleQueueUpdate = () => { void refreshCount(); };

    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    window.addEventListener("finosuke:queue-update", handleQueueUpdate);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
      window.removeEventListener("finosuke:queue-update", handleQueueUpdate);
    };
  }, []);

  if (!offline && pendingCount === 0) return null;

  // Back online but SW hasn't drained the queue yet — show syncing state.
  if (!offline && pendingCount > 0) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed top-0 inset-x-0 z-[60] flex items-center justify-center gap-2 bg-teal-600/95 backdrop-blur-sm px-4 py-2 text-sm font-medium text-white shadow-md"
      >
        <RefreshCw className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
        <span>
          Syncing {pendingCount} pending change{pendingCount !== 1 ? "s" : ""}…
        </span>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 inset-x-0 z-[60] flex items-center justify-center gap-2 bg-amber-500/95 backdrop-blur-sm px-4 py-2 text-sm font-medium text-amber-950 shadow-md"
    >
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>
        You&apos;re offline
        {pendingCount > 0
          ? ` — ${pendingCount} pending change${pendingCount !== 1 ? "s" : ""} will sync when connected`
          : " — some features may be unavailable"}
      </span>
    </div>
  );
}
