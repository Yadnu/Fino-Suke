"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { getBudgetStatusColor } from "@/lib/utils";

type BudgetChartItem = {
  name: string;
  budget: number;
  spent: number;
  percent: number;
};

type BudgetBarChartProps = {
  data: BudgetChartItem[];
};

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface border border-border rounded-lg p-3 shadow-card">
      <p className="text-xs font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-xs text-muted">
          {p.name === "spent" ? "Spent" : "Budget"}:{" "}
          <span className="text-foreground font-medium">
            ${p.value.toFixed(2)}
          </span>
        </p>
      ))}
    </div>
  );
}

export function BudgetBarChart({ data }: BudgetBarChartProps) {
  if (!data.length) return null;

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
          barSize={12}
          barGap={4}
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
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "#2a2a32" }} />
          <Bar dataKey="budget" fill="#2a2a32" radius={[3, 3, 0, 0]} name="budget" />
          <Bar dataKey="spent" radius={[3, 3, 0, 0]} name="spent">
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={getBudgetStatusColor(entry.percent)}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
