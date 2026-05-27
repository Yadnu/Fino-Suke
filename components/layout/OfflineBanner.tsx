"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    // Initialise from current state (navigator.onLine may be false on mount)
    setOffline(!navigator.onLine);

    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);

    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 inset-x-0 z-[60] flex items-center justify-center gap-2 bg-amber-500/95 backdrop-blur-sm px-4 py-2 text-sm font-medium text-amber-950 shadow-md"
    >
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>You&apos;re offline — some features may be unavailable</span>
    </div>
  );
}
