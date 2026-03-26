"use client";

import { Pencil, Trash2, Plus } from "lucide-react";
import { formatCurrency, formatDate, clampPercent, cn } from "@/lib/utils";
import type { SavingsGoal } from "@/lib/stores/savingsStore";

const RADIUS = 40;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const STROKE_WIDTH = 6;
const SIZE = (RADIUS + STROKE_WIDTH) * 2;

type GoalCardProps = {
  goal: SavingsGoal;
  onEdit: () => void;
  onDelete: () => void;
  onDeposit: () => void;
};

export function GoalCard({ goal, onEdit, onDelete, onDeposit }: GoalCardProps) {
  const percent = clampPercent(
    goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0
  );
  const dashOffset = CIRCUMFERENCE * (1 - percent / 100);

  const daysRemaining = goal.targetDate
    ? Math.ceil(
        (new Date(goal.targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
    : null;

  return (
    <div
      className={cn(
        "group relative bg-surface border border-border rounded-lg p-5 flex flex-col gap-4 transition-all duration-200",
        "hover:border-border/80 hover:shadow-card-hover",
        goal.isCompleted && "border-success/30 bg-success/5"
      )}
    >
      {goal.isCompleted && (
        <div className="absolute top-3 right-3 text-xs font-semibold px-2 py-0.5 rounded-pill bg-success/15 text-success border border-success/20">
          Completed 🎉
        </div>
      )}

      {/* Actions — visible on hover */}
      {!goal.isCompleted && (
        <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="w-7 h-7 rounded-md flex items-center justify-center text-muted hover:text-foreground hover:bg-accent transition-colors"
            title="Edit goal"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="w-7 h-7 rounded-md flex items-center justify-center text-muted hover:text-danger hover:bg-danger/10 transition-colors"
            title="Delete goal"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top: ring + info */}
      <div className="flex items-center gap-4">
        {/* SVG Ring */}
        <div className="relative shrink-0">
          <svg
            width={SIZE}
            height={SIZE}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            className="-rotate-90"
          >
            {/* Track */}
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke="currentColor"
              strokeWidth={STROKE_WIDTH}
              className="text-accent"
            />
            {/* Progress */}
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={goal.isCompleted ? "#4ade80" : goal.color}
              strokeWidth={STROKE_WIDTH}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              style={{ transition: "stroke-dashoffset 0.6s ease" }}
            />
          </svg>
          {/* Icon in center */}
          <div className="absolute inset-0 flex items-center justify-center text-xl">
            {goal.icon}
          </div>
        </div>

        {/* Goal info */}
        <div className="flex-1 min-w-0">
          <p className="font-display font-bold text-foreground truncate pr-16">
            {goal.name}
          </p>
          {goal.description && (
            <p className="text-xs text-muted mt-0.5 line-clamp-1">
              {goal.description}
            </p>
          )}

          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-sm font-semibold text-foreground">
              {formatCurrency(goal.currentAmount)}
            </span>
            <span className="text-xs text-muted">
              / {formatCurrency(goal.targetAmount)}
            </span>
          </div>
        </div>
      </div>

      {/* Progress bar + percent */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted">
          <span>{percent.toFixed(1)}% complete</span>
          {daysRemaining !== null && !goal.isCompleted && (
            <span className={cn(daysRemaining < 0 && "text-danger")}>
              {daysRemaining < 0
                ? `${Math.abs(daysRemaining)}d overdue`
                : daysRemaining === 0
                ? "Due today"
                : `${daysRemaining}d left`}
            </span>
          )}
          {goal.targetDate && (
            <span className="text-muted/60">
              {formatDate(goal.targetDate, "MMM d, yyyy")}
            </span>
          )}
        </div>

        <div className="h-1.5 bg-accent rounded-pill overflow-hidden">
          <div
            className="h-full rounded-pill transition-all duration-700"
            style={{
              width: `${percent}%`,
              backgroundColor: goal.isCompleted ? "#4ade80" : goal.color,
            }}
          />
        </div>
      </div>

      {/* Add funds */}
      {!goal.isCompleted && (
        <button
          onClick={onDeposit}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-md text-xs font-semibold border border-border text-muted hover:border-gold/40 hover:text-gold hover:bg-gold/5 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Funds
        </button>
      )}
    </div>
  );
}
