"use client";

import { useCallback, useEffect, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  DollarSign,
  PiggyBank,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  formatCurrency,
  formatPercent,
  getMonthKey,
  cn,
} from "@/lib/utils";
import { SkeletonCard } from "@/components/ui/SkeletonCard";

type CategoryBreakdownItem = {
  categoryId: string | null;
  category: { id: string; name: string; icon: string; color: string } | null;
  amount: number;
};

type AnalyticsSummary = {
  month: string;
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
  savingsRate: number;
  incomeTrend: number;
  expensesTrend: number;
  categoryBreakdown: CategoryBreakdownItem[];
};

function monthLabel(key: string) {
  const [year, mon] = key.split("-").map(Number);
  return new Date(year, mon - 1, 1).toLocaleString("default", {
    month: "long",
    year: "numeric",
  });
}

function prevMonth(key: string) {
  const [year, mon] = key.split("-").map(Number);
  const d = new Date(year, mon - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function nextMonth(key: string) {
  const [year, mon] = key.split("-").map(Number);
  const d = new Date(year, mon, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function CustomPieTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: { color: string } }>;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="bg-surface border border-border rounded-lg p-3 shadow-card text-xs">
      <p className="font-semibold text-foreground mb-1">{p.name}</p>
      <p className="text-muted">
        Spent:{" "}
        <span className="text-foreground font-medium">
          {formatCurrency(p.value)}
        </span>
      </p>
    </div>
  );
}

function CustomBarTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface border border-border rounded-lg p-3 shadow-card text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-muted">
          {p.name}:{" "}
          <span className="text-foreground font-medium">
            {formatCurrency(p.value)}
          </span>
        </p>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const [month, setMonth] = useState(getMonthKey());
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const currentMonthKey = getMonthKey();
  const isCurrentMonth = month === currentMonthKey;

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/analytics/summary?month=${month}`);
      const json = await res.json();
      setData(json);
    } finally {
      setIsLoading(false);
    }
  }, [month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const breakdown = data?.categoryBreakdown ?? [];
  const total = breakdown.reduce((s, c) => s + c.amount, 0);

  const pieData = breakdown.map((c) => ({
    name: c.category?.name ?? "Uncategorized",
    value: c.amount,
    color: c.category?.color ?? "#71717a",
    icon: c.category?.icon ?? "📦",
  }));

  const comparisonData = data
    ? [
        {
          name: "This Month",
          Income: data.totalIncome,
          Expenses: data.totalExpenses,
        },
      ]
    : [];

  const stats = data
    ? [
        {
          label: "Total Income",
          value: formatCurrency(data.totalIncome),
          trend: data.incomeTrend,
          icon: TrendingUp,
          iconColor: "text-success",
          iconBg: "bg-success/10",
        },
        {
          label: "Total Expenses",
          value: formatCurrency(data.totalExpenses),
          trend: data.expensesTrend,
          invertTrend: true,
          icon: TrendingDown,
          iconColor: "text-danger",
          iconBg: "bg-danger/10",
        },
        {
          label: "Net Savings",
          value: formatCurrency(Math.abs(data.netSavings)),
          subtext: data.netSavings < 0 ? "deficit" : "saved",
          icon: PiggyBank,
          iconColor: data.netSavings >= 0 ? "text-gold" : "text-danger",
          iconBg: data.netSavings >= 0 ? "bg-gold/10" : "bg-danger/10",
        },
        {
          label: "Savings Rate",
          value: formatPercent(Math.max(0, data.savingsRate)),
          subtext: "of income saved",
          icon: DollarSign,
          iconColor: "text-teal",
          iconBg: "bg-teal/10",
        },
      ]
    : [];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Analytics
          </h1>
          <p className="text-sm text-muted mt-1">
            Spending breakdown and trends
          </p>
        </div>

        {/* Month navigator */}
        <div className="flex items-center gap-2 bg-surface border border-border rounded-lg px-3 py-2">
          <button
            onClick={() => setMonth(prevMonth(month))}
            className="w-7 h-7 flex items-center justify-center rounded-md text-muted hover:text-foreground hover:bg-accent transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-foreground min-w-36 text-center">
            {monthLabel(month)}
          </span>
          <button
            onClick={() => setMonth(nextMonth(month))}
            disabled={isCurrentMonth}
            className="w-7 h-7 flex items-center justify-center rounded-md text-muted hover:text-foreground hover:bg-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stat cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s) => {
            const trendValue = s.invertTrend ? -(s.trend ?? 0) : (s.trend ?? 0);
            const isPositive = trendValue >= 0;
            return (
              <div
                key={s.label}
                className="bg-surface border border-border rounded-lg p-4 card-hover"
              >
                <div className="flex items-start justify-between mb-3">
                  <p className="text-xs text-muted font-medium">{s.label}</p>
                  <div
                    className={cn(
                      "w-7 h-7 rounded-md flex items-center justify-center",
                      s.iconBg
                    )}
                  >
                    <s.icon className={cn("w-3.5 h-3.5", s.iconColor)} />
                  </div>
                </div>
                <p className="font-display text-xl font-bold text-foreground">
                  {s.value}
                </p>
                {s.trend !== undefined ? (
                  <div className="flex items-center gap-1 mt-1.5">
                    {isPositive ? (
                      <ArrowUpRight className="w-3 h-3 text-success" />
                    ) : (
                      <ArrowDownRight className="w-3 h-3 text-danger" />
                    )}
                    <span
                      className={cn(
                        "text-xs font-medium",
                        isPositive ? "text-success" : "text-danger"
                      )}
                    >
                      {Math.abs(trendValue).toFixed(1)}% vs last month
                    </span>
                  </div>
                ) : (
                  <p className="text-xs text-muted mt-1.5">{s.subtext}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Charts row */}
      {!isLoading && data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Spending by category — donut */}
          <div className="bg-surface border border-border rounded-lg p-5">
            <h3 className="font-display text-base font-semibold text-foreground mb-4">
              Spending by Category
            </h3>
            {pieData.length === 0 ? (
              <div className="h-48 flex items-center justify-center">
                <p className="text-sm text-muted">No expenses this month</p>
              </div>
            ) : (
              <div className="flex gap-4 items-center">
                <div className="h-44 flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomPieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Legend */}
                <div className="space-y-2 min-w-0 flex-shrink-0 max-w-[48%]">
                  {pieData.slice(0, 6).map((item) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-xs text-muted truncate">
                        {item.icon} {item.name}
                      </span>
                      <span className="text-xs font-medium text-foreground ml-auto shrink-0">
                        {total > 0
                          ? formatPercent((item.value / total) * 100, 0)
                          : "—"}
                      </span>
                    </div>
                  ))}
                  {pieData.length > 6 && (
                    <p className="text-xs text-muted">
                      +{pieData.length - 6} more
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Income vs Expenses bar */}
          <div className="bg-surface border border-border rounded-lg p-5">
            <h3 className="font-display text-base font-semibold text-foreground mb-4">
              Income vs. Expenses
            </h3>
            {data.totalIncome === 0 && data.totalExpenses === 0 ? (
              <div className="h-48 flex items-center justify-center">
                <p className="text-sm text-muted">No data for this month</p>
              </div>
            ) : (
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={comparisonData}
                    margin={{ top: 4, right: 4, left: -10, bottom: 0 }}
                    barSize={36}
                    barGap={8}
                  >
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "#71717a", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#71717a", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                    />
                    <Tooltip content={<CustomBarTooltip />} cursor={{ fill: "#2a2a32" }} />
                    <Legend
                      wrapperStyle={{ fontSize: 11, color: "#71717a" }}
                    />
                    <Bar dataKey="Income" fill="#4ade80" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Expenses" fill="#f87171" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Category breakdown table */}
      {!isLoading && breakdown.length > 0 && (
        <div className="bg-surface border border-border rounded-lg p-5">
          <h3 className="font-display text-base font-semibold text-foreground mb-4">
            Category Breakdown
          </h3>
          <div className="space-y-0 divide-y divide-border">
            {breakdown.map((item, i) => {
              const pct = total > 0 ? (item.amount / total) * 100 : 0;
              const icon = item.category?.icon ?? "📦";
              const color = item.category?.color ?? "#71717a";
              const name = item.category?.name ?? "Uncategorized";
              return (
                <div
                  key={item.categoryId ?? i}
                  className="flex items-center gap-3 py-3"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
                    style={{ backgroundColor: `${color}20` }}
                  >
                    {icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-foreground">
                        {name}
                      </span>
                      <span className="text-sm font-semibold text-foreground">
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 progress-bar h-1.5">
                        <div
                          className="progress-bar-fill"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: color,
                          }}
                        />
                      </div>
                      <span className="text-xs text-muted w-10 text-right shrink-0">
                        {formatPercent(pct, 0)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Total */}
          <div className="flex items-center justify-between pt-4 mt-2 border-t border-border">
            <span className="text-sm font-semibold text-foreground">
              Total Expenses
            </span>
            <span className="text-sm font-bold text-danger">
              {formatCurrency(total)}
            </span>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !data?.categoryBreakdown.length && data && (
        <div className="bg-surface border border-border rounded-lg p-12 text-center">
          <p className="text-4xl mb-4">📊</p>
          <p className="text-base font-medium text-foreground mb-1">
            No data for {monthLabel(month)}
          </p>
          <p className="text-sm text-muted">
            Add transactions to see your spending analytics here
          </p>
        </div>
      )}
    </div>
  );
}
