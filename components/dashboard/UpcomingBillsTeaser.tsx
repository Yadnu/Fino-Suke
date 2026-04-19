import Link from "next/link";
import { Bell, ArrowRight } from "lucide-react";
import {
  formatCurrency,
  formatDate,
  billDaysUntilDue,
  cn,
} from "@/lib/utils";

export type DashboardBill = {
  id: string;
  name: string;
  amount: number;
  nextDueDate: string;
  category: { name: string; icon: string; color: string } | null;
};

type UpcomingBillsTeaserProps = {
  bills: DashboardBill[];
  currency: string;
};

function dueStatusLabel(nextDueDate: string): string {
  const days = billDaysUntilDue(nextDueDate);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days} days`;
}

export function UpcomingBillsTeaser({ bills, currency }: UpcomingBillsTeaserProps) {
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

      {bills.length === 0 ? (
        <div className="text-center py-6">
          <div className="w-10 h-10 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center mx-auto mb-3">
            <Bell className="w-5 h-5 text-gold" />
          </div>
          <p className="text-sm text-muted">
            No bills yet. Add recurring bills to see what is due next.
          </p>
          <Link
            href="/bills"
            className="text-xs text-teal hover:text-teal-hover mt-2 inline-block transition-colors"
          >
            Add a bill →
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {bills.map((bill) => {
            const days = billDaysUntilDue(bill.nextDueDate);
            const overdue = days < 0;
            const dueToday = days === 0;
            const icon = bill.category?.icon ?? "📄";
            const color = bill.category?.color ?? "#71717a";

            return (
              <li
                key={bill.id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                  overdue
                    ? "border-danger/35 bg-danger/[0.06]"
                    : dueToday
                      ? "border-gold/35 bg-gold/[0.06]"
                      : "border-border bg-background/40"
                )}
              >
                <div
                  className="w-9 h-9 rounded-md flex items-center justify-center text-base shrink-0"
                  style={{ backgroundColor: `${color}22` }}
                >
                  {icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">
                    {bill.name}
                  </p>
                  <p className="text-xs text-muted">
                    {dueStatusLabel(bill.nextDueDate)} ·{" "}
                    {formatDate(bill.nextDueDate, "MMM d")}
                  </p>
                </div>
                <span className="text-sm font-semibold text-foreground shrink-0 tabular-nums">
                  {formatCurrency(bill.amount, currency)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
