"use client";

import { TrendingUp, TrendingDown, DollarSign, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";

type MonthlySnapshotProps = {
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
  savingsRate: number;
  incomeTrend: number;
  expensesTrend: number;
  currency?: string;
};

export function MonthlySnapshot({
  totalIncome,
  totalExpenses,
  netSavings,
  savingsRate,
  incomeTrend,
  expensesTrend,
  currency = "USD",
}: MonthlySnapshotProps) {
  const stats = [
    {
      label: "Total Income",
      value: formatCurrency(totalIncome, currency),
      trend: incomeTrend,
      icon: TrendingUp,
      iconBg: "bg-success/10",
      iconColor: "text-success",
    },
    {
      label: "Total Expenses",
      value: formatCurrency(totalExpenses, currency),
      trend: -expensesTrend,
      icon: TrendingDown,
      iconBg: "bg-danger/10",
      iconColor: "text-danger",
    },
    {
      label: "Net Savings",
      value: formatCurrency(Math.abs(netSavings), currency),
      subtext: netSavings < 0 ? "deficit" : "saved",
      icon: DollarSign,
      iconBg: netSavings >= 0 ? "bg-gold/10" : "bg-danger/10",
      iconColor: netSavings >= 0 ? "text-gold" : "text-danger",
      isNegative: netSavings < 0,
    },
  ];

  return (
    <div className="bg-surface border border-border rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-base font-semibold text-foreground">
          Monthly Snapshot
        </h3>
        <span className="text-xs text-muted bg-accent px-2 py-1 rounded-pill">
          This month
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted">{stat.label}</p>
              <div className={cn("w-7 h-7 rounded-md flex items-center justify-center", stat.iconBg)}>
                <stat.icon className={cn("w-3.5 h-3.5", stat.iconColor)} />
              </div>
            </div>
            <p
              className={cn(
                "font-display text-xl font-bold",
                stat.isNegative ? "text-danger" : "text-foreground"
              )}
            >
              {stat.value}
            </p>
            <div className="flex items-center gap-1">
              {stat.trend !== undefined ? (
                <>
                  {stat.trend >= 0 ? (
                    <ArrowUpRight className="w-3 h-3 text-success" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3 text-danger" />
                  )}
                  <span
                    className={cn(
                      "text-xs font-medium",
                      stat.trend >= 0 ? "text-success" : "text-danger"
                    )}
                  >
                    {Math.abs(stat.trend).toFixed(1)}% vs last month
                  </span>
                </>
              ) : (
                <span className="text-xs text-muted">{stat.subtext}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Savings rate bar */}
      <div className="mt-5 pt-4 border-t border-border">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-muted">Savings Rate</span>
          <span className="text-xs font-semibold text-gold">
            {Math.max(0, savingsRate).toFixed(1)}%
          </span>
        </div>
        <div className="progress-bar h-1.5">
          <div
            className="progress-bar-fill bg-gold"
            style={{ width: `${Math.min(100, Math.max(0, savingsRate))}%` }}
          />
        </div>
      </div>
    </div>
  );
}
