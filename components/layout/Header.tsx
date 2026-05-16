"use client";

import { useUser, UserButton } from "@clerk/nextjs";
import { format } from "date-fns";
import { Activity, Bell } from "lucide-react";
import { getGreeting } from "@/lib/utils";

type HeaderProps = {
  /** Kept for API compatibility; UI is hidden — see health score wrapper below. */
  healthScore?: number;
};

const clerkUserButtonAppearance = {
  variables: {
    colorBackground: "#1a1a1f",
    colorText: "#f4f4f5",
    colorTextSecondary: "#71717a",
    colorPrimary: "#f5c842",
    colorNeutral: "#2a2a32",
    fontSize: "14px",
    borderRadius: "8px",
  },
  elements: {
    userButtonPopoverCard:
      "bg-surface border border-border shadow-card-hover rounded-lg",
    userButtonPopoverActionButton:
      "text-foreground hover:bg-accent rounded-md transition-colors",
    userButtonPopoverActionButtonText: "text-sm",
    userButtonPopoverFooter: "hidden",
    userPreviewMainIdentifier: "text-foreground font-medium text-sm",
    userPreviewSecondaryIdentifier: "text-muted text-xs",
    userButtonTrigger:
      "rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    userButtonAvatarBox:
      "w-9 h-9 shrink-0 rounded-md border border-border bg-accent/40 shadow-sm [&_img]:object-cover",
  },
};

export function Header({ healthScore = 78 }: HeaderProps) {
  const { user } = useUser();
  const firstName = user?.firstName ?? user?.fullName?.split(" ")[0] ?? "there";
  const greeting = getGreeting();
  const today = format(new Date(), "EEEE, MMMM d");

  return (
    <header className="h-16 flex items-center justify-between px-6 border-b border-border bg-surface/80 backdrop-blur-sm">
      {/* Left: greeting */}
      <div>
        <h2 className="font-display text-base font-semibold text-foreground leading-tight">
          {greeting}, <span className="text-gold">{firstName}</span> 👋
        </h2>
        <p className="text-xs text-muted mt-0.5">{today}</p>
      </div>

      {/* Right: health score (hidden in UI) + notifications + user button */}
      <div className="flex items-center gap-3">
        {/* Financial Health Score — markup retained; hidden per product request */}
        <div
          className="hidden"
          aria-hidden="true"
        >
          <div className="flex items-center gap-2 bg-teal/10 border border-teal/20 rounded-pill px-3 py-1.5">
            <Activity className="w-3.5 h-3.5 text-teal" />
            <span className="text-xs font-semibold text-teal hidden sm:inline">
              Health Score
            </span>
            <span className="text-xs font-bold text-foreground">
              {healthScore}
              <span className="text-muted font-normal">/100</span>
            </span>
          </div>
        </div>

        {/* Bill reminders use browser push when enabled; no in-app inbox yet */}
        <button
          type="button"
          className="w-9 h-9 rounded-md border border-border flex items-center justify-center text-muted hover:text-foreground hover:border-border/80 transition-colors"
          aria-label="Notifications (in-app inbox not available yet)"
          title="No in-app inbox yet. Bill reminders can use browser notifications when your device supports them."
          disabled
        >
          <Bell className="w-4 h-4 opacity-60" />
        </button>

        {/* Clerk UserButton — profile image / initials + account menu */}
        <div className="flex shrink-0 items-center">
          <UserButton
            appearance={clerkUserButtonAppearance}
            showName={false}
            userProfileMode="navigation"
            userProfileUrl="/settings"
          />
        </div>
      </div>
    </header>
  );
}
