"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import { formatCurrency, formatCompactCurrency } from "@/lib/utils";
import type { NetWorthHistoryItem } from "@/lib/networth";

function CustomTooltip({
  active,
  payload,
  label,
  currency,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  currency?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface border border-border rounded-lg p-3 shadow-card text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-muted">
          {p.name}:{" "}
          <span className="font-medium" style={{ color: p.color }}>
            {formatCurrency(p.value, currency)}
          </span>
        </p>
      ))}
    </div>
  );
}

type Props = {
  history: NetWorthHistoryItem[];
  currency?: string;
};

export function NetWorthTrendChart({ history, currency = "USD" }: Props) {
  if (history.length < 2) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-muted">
        Add accounts and return next month to see your trend.
      </div>
    );
  }

  const data = history.map((h) => ({
    month: h.month,
    Assets: h.totalAssets,
    Liabilities: h.totalLiabilities,
    "Net Worth": h.netWorth,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: "#71717a" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#71717a" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => formatCompactCurrency(v, currency)}
          width={64}
        />
        <Tooltip content={<CustomTooltip currency={currency} />} />
        <Legend
          wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }}
          formatter={(value) => <span style={{ color: "#a1a1aa" }}>{value}</span>}
        />
        <Line
          type="monotone"
          dataKey="Assets"
          stroke="#4ade80"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="Liabilities"
          stroke="#f87171"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="Net Worth"
          stroke="#f5c842"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
