import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatCurrency, clampPercent, cn } from "@/lib/utils";

export type DashboardSavingsGoal = {
  id: string;
  name: string;
  icon: string;
  color: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string | null;
};

type SavingsGoalsTeaserProps = {
  goals: DashboardSavingsGoal[];
  currency: string;
};

function goalPercent(goal: DashboardSavingsGoal): number {
  return clampPercent(
    goal.targetAmount > 0
      ? (goal.currentAmount / goal.targetAmount) * 100
      : 0
  );
}

export function SavingsGoalsTeaser({ goals, currency }: SavingsGoalsTeaserProps) {
  return (
    <div className="bg-surface border border-border rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-base font-semibold text-foreground">
          Savings Goals
        </h3>
        <Link
          href="/savings"
          className="flex items-center gap-1 text-xs text-muted hover:text-gold transition-colors"
        >
          View all <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {goals.length === 0 ? (
        <div className="text-center py-6">
          <div className="text-4xl mb-3">🎯</div>
          <p className="text-sm text-muted">
            No active goals yet. Create one to track progress toward a target.
          </p>
          <Link
            href="/savings"
            className="text-xs text-gold hover:text-gold-hover mt-2 inline-block transition-colors"
          >
            Plan your first goal →
          </Link>
        </div>
      ) : (
        <ul className="space-y-4">
          {goals.map((goal) => {
            const pct = goalPercent(goal);
            return (
              <li key={goal.id} className="space-y-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="text-lg shrink-0 w-8 h-8 rounded-md flex items-center justify-center"
                    style={{ backgroundColor: `${goal.color}25` }}
                  >
                    {goal.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {goal.name}
                    </p>
                    <p className="text-xs text-muted">
                      {formatCurrency(goal.currentAmount, currency)} of{" "}
                      {formatCurrency(goal.targetAmount, currency)} · {pct}%
                    </p>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-border overflow-hidden ml-10">
                  <div
                    className={cn("h-full rounded-full transition-all")}
                    style={{
                      width: `${pct}%`,
                      backgroundColor: goal.color,
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
