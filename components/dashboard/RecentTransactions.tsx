"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatCurrency, formatDateShort, cn } from "@/lib/utils";
import type { Transaction } from "@/lib/stores/transactionStore";

type RecentTransactionsProps = {
  transactions: Transaction[];
  currency?: string;
};

export function RecentTransactions({
  transactions,
  currency = "USD",
}: RecentTransactionsProps) {
  if (transactions.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-base font-semibold text-foreground">
            Recent Transactions
          </h3>
        </div>
        <div className="text-center py-8">
          <p className="text-sm text-muted mb-3">No transactions yet</p>
          <Link
            href="/expenses"
            className="text-xs text-gold hover:text-gold-hover font-medium transition-colors"
          >
            Log your first expense →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-base font-semibold text-foreground">
          Recent Transactions
        </h3>
        <Link
          href="/expenses"
          className="flex items-center gap-1 text-xs text-muted hover:text-gold transition-colors"
        >
          See all <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="divide-y divide-border">
        {transactions.map((tx) => {
          const icon = tx.category?.icon ?? "📦";
          const color = tx.category?.color ?? "#71717a";
          const isExpense = tx.type === "expense";

          return (
            <div key={tx.id} className="flex items-center gap-3 py-3">
              {/* Category icon */}
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0"
                style={{ backgroundColor: `${color}20` }}
              >
                {icon}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {tx.category?.name ?? "Uncategorized"}
                </p>
                <p className="text-xs text-muted">
                  {formatDateShort(tx.date)}
                  {tx.notes && ` · ${tx.notes}`}
                </p>
              </div>

              {/* Amount */}
              <span
                className={cn(
                  "text-sm font-semibold shrink-0",
                  isExpense ? "text-danger" : "text-success"
                )}
              >
                {isExpense ? "−" : "+"}
                {formatCurrency(tx.amount, currency)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
