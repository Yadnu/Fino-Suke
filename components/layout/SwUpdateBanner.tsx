"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

export function SwUpdateBanner() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const checkForWaiting = (reg: ServiceWorkerRegistration) => {
      if (reg.waiting) {
        setWaiting(reg.waiting);
        return;
      }
      reg.addEventListener("updatefound", () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            setWaiting(installing);
          }
        });
      });
    };

    navigator.serviceWorker.ready.then(checkForWaiting);

    // Also catch the case where the page was loaded while a SW update was already waiting
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg) checkForWaiting(reg);
    });
  }, []);

  const handleUpdate = () => {
    if (!waiting) return;
    waiting.postMessage({ type: "SKIP_WAITING" });
    waiting.addEventListener("statechange", () => {
      if (waiting.state === "activated") window.location.reload();
    });
    // Fallback reload after 1 s in case the event doesn't fire
    setTimeout(() => window.location.reload(), 1000);
  };

  if (!waiting) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 inset-x-0 z-[60] flex items-center justify-center gap-3 bg-teal-500/95 backdrop-blur-sm px-4 py-2 text-sm font-medium text-teal-950 shadow-md"
    >
      <RefreshCw className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>A new version of Finosuke is ready.</span>
      <button
        onClick={handleUpdate}
        className="ml-1 rounded-md bg-teal-950/10 px-3 py-0.5 text-xs font-semibold hover:bg-teal-950/20 transition-colors"
      >
        Reload now
      </button>
    </div>
  );
}
