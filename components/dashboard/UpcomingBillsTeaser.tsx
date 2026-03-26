import Link from "next/link";
import { Bell, ArrowRight } from "lucide-react";

export function UpcomingBillsTeaser() {
  return (
    <div className="bg-surface border border-border rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-base font-semibold text-foreground">
          Upcoming Bills
        </h3>
        <Link
          href="/bills"
          className="flex items-center gap-1 text-xs text-muted hover:text-gold transition-colors"
        >
          Manage <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="text-center py-6">
        <div className="w-10 h-10 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center mx-auto mb-3">
          <Bell className="w-5 h-5 text-gold" />
        </div>
        <p className="text-sm text-muted">Bill reminders coming in Phase 2</p>
        <Link
          href="/bills"
          className="text-xs text-teal hover:text-teal-hover mt-2 inline-block transition-colors"
        >
          Set up bill reminders →
        </Link>
      </div>
    </div>
  );
}
