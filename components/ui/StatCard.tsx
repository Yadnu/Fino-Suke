import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

type StatCardProps = {
  label: string;
  value: string;
  subtext?: string;
  icon?: LucideIcon;
  iconColor?: string;
  trend?: { value: number; label: string };
  className?: string;
};

export function StatCard({
  label,
  value,
  subtext,
  icon: Icon,
  iconColor = "text-gold",
  trend,
  className,
}: StatCardProps) {
  const isPositive = trend && trend.value >= 0;

  return (
    <div
      className={cn(
        "bg-surface border border-border rounded-lg p-5 card-hover",
        className
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm text-muted font-medium">{label}</p>
        {Icon && (
          <div className="w-8 h-8 rounded-md bg-surface border border-border flex items-center justify-center">
            <Icon className={cn("w-4 h-4", iconColor)} />
          </div>
        )}
      </div>
      <p className="font-display text-2xl font-bold text-foreground">{value}</p>
      {(subtext || trend) && (
        <div className="flex items-center gap-2 mt-1.5">
          {trend && (
            <span
              className={cn(
                "text-xs font-semibold",
                isPositive ? "text-success" : "text-danger"
              )}
            >
              {isPositive ? "+" : ""}
              {trend.value.toFixed(1)}%
            </span>
          )}
          {subtext && <span className="text-xs text-muted">{subtext}</span>}
        </div>
      )}
    </div>
  );
}
