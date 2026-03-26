"use client";

import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { Activity, Bell } from "lucide-react";
import { getGreeting } from "@/lib/utils";

type HeaderProps = {
  healthScore?: number;
};

export function Header({ healthScore = 78 }: HeaderProps) {
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(" ")[0] ?? "there";
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

      {/* Right: health score + notifications */}
      <div className="flex items-center gap-3">
        {/* Financial Health Score */}
        <div className="flex items-center gap-2 bg-teal/10 border border-teal/20 rounded-pill px-3 py-1.5">
          <Activity className="w-3.5 h-3.5 text-teal" />
          <span className="text-xs font-semibold text-teal">
            Health Score
          </span>
          <span className="text-xs font-bold text-foreground">
            {healthScore}
            <span className="text-muted font-normal">/100</span>
          </span>
        </div>

        {/* Notifications */}
        <button className="relative w-9 h-9 rounded-md border border-border flex items-center justify-center text-muted hover:text-foreground hover:border-border/80 transition-colors">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-gold rounded-full" />
        </button>
      </div>
    </header>
  );
}
