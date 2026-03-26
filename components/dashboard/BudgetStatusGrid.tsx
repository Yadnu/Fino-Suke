"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatCurrency, getBudgetStatusColor, clampPercent } from "@/lib/utils";
import type { Budget } from "@/lib/stores/budgetStore";

type BudgetStatusGridProps = {
  budgets: (Budget & { spent?: number })[];
  currency?: string;
};

export function BudgetStatusGrid({
  budgets,
  currency = "USD",
}: BudgetStatusGridProps) {
  const display = budgets.slice(0, 4);

  if (display.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-base font-semibold text-foreground">
            Budget Status
          </h3>
        </div>
        <div className="text-center py-8">
          <p className="text-sm text-muted mb-3">No budgets set for this month</p>
          <Link
            href="/budget"
            className="text-xs text-gold hover:text-gold-hover font-medium transition-colors"
          >
            Create your first budget →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-base font-semibold text-foreground">
          Budget Status
        </h3>
        <Link
          href="/budget"
          className="flex items-center gap-1 text-xs text-muted hover:text-gold transition-colors"
        >
          See all <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {display.map((budget) => {
          const spent = budget.spent ?? 0;
          const percent = clampPercent((spent / budget.amount) * 100);
          const statusColor = getBudgetStatusColor(percent);
          const icon = budget.category?.icon ?? "📦";

          return (
            <div
              key={budget.id}
              className="bg-background border border-border rounded-lg p-3 space-y-2.5"
            >
              <div className="flex items-center gap-2">
                <span className="text-base leading-none">{icon}</span>
                <p className="text-sm font-medium text-foreground truncate">
                  {budget.category?.name ?? budget.name}
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted">
                    {formatCurrency(spent, currency)} spent
                  </span>
                  <span
                    className="text-xs font-semibold"
                    style={{ color: statusColor }}
                  >
                    {percent.toFixed(0)}%
                  </span>
                </div>
                <div className="progress-bar h-1.5">
                  <div
                    className="progress-bar-fill"
                    style={{
                      width: `${percent}%`,
                      backgroundColor: statusColor,
                    }}
                  />
                </div>
              </div>

              <p className="text-xs text-muted">
                of {formatCurrency(budget.amount, currency)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
