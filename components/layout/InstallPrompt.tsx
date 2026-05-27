"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "finosuke-install-dismissed";

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Don't show if already dismissed recently or already installed
    if (
      localStorage.getItem(DISMISSED_KEY) ||
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    ) {
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Small delay so the app feels loaded before the prompt appears
      setTimeout(() => setVisible(true), 3000);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setVisible(false);
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setVisible(false);
    // Suppress for 30 days
    localStorage.setItem(DISMISSED_KEY, String(Date.now() + 30 * 86400_000));
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Install Finosuke"
      className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm"
    >
      <div className="relative flex items-center gap-3 rounded-2xl border border-[#2a2a32] bg-[#1a1a1f]/95 backdrop-blur-md px-4 py-3 shadow-2xl shadow-black/60">
        {/* Icon */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f5c842]/10">
          <Download className="h-5 w-5 text-[#f5c842]" />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#f4f4f5] leading-tight">
            Install Finosuke
          </p>
          <p className="text-xs text-[#71717a] mt-0.5 leading-snug">
            Add to your home screen for quick access
          </p>
        </div>

        {/* Install button */}
        <button
          onClick={handleInstall}
          className="shrink-0 rounded-lg bg-[#f5c842] px-3 py-1.5 text-xs font-semibold text-[#0f0f11] transition-opacity hover:opacity-90 active:scale-95"
        >
          Install
        </button>

        {/* Dismiss */}
        <button
          onClick={handleDismiss}
          aria-label="Dismiss install prompt"
          className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#2a2a32] text-[#71717a] transition-colors hover:text-[#f4f4f5]"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
