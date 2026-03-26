"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import { Loader2, TrendingUp } from "lucide-react";
import { depositSchema, type DepositInput } from "@/lib/validations";
import { useSavingsStore, type SavingsGoal } from "@/lib/stores/savingsStore";
import { formatCurrency, clampPercent } from "@/lib/utils";
import { Sheet, SheetContent } from "@/components/ui/Sheet";

type DepositSheetProps = {
  goal: SavingsGoal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DepositSheet({ goal, open, onOpenChange }: DepositSheetProps) {
  const { updateGoal } = useSavingsStore();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<DepositInput>({
    resolver: zodResolver(depositSchema),
    defaultValues: { amount: undefined },
  });

  const depositAmount = watch("amount");
  const newTotal = goal ? goal.currentAmount + (Number(depositAmount) || 0) : 0;
  const newPercent = goal
    ? clampPercent(goal.targetAmount > 0 ? (newTotal / goal.targetAmount) * 100 : 0)
    : 0;

  async function onSubmit(data: DepositInput) {
    if (!goal) return;
    try {
      const res = await fetch(`/api/savings/${goal.id}/deposit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: data.amount }),
      });
      const result = await res.json();

      if (!res.ok) {
        toast.error(result.error ?? "Failed to add funds");
        return;
      }

      updateGoal(goal.id, result);
      toast.success(
        result.isCompleted
          ? "🎉 Goal completed! Congratulations!"
          : `Added ${formatCurrency(data.amount)} to ${goal.name}`
      );
      reset();
      onOpenChange(false);
    } catch {
      toast.error("Something went wrong");
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <SheetContent
        title="Add Funds"
        description={goal ? `Contributing to "${goal.name}"` : undefined}
      >
        {goal && (
          <div className="space-y-5">
            {/* Goal preview */}
            <div className="bg-background rounded-lg p-4 space-y-3 border border-border">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{goal.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{goal.name}</p>
                  <p className="text-xs text-muted">
                    {formatCurrency(goal.currentAmount)} of {formatCurrency(goal.targetAmount)}
                  </p>
                </div>
              </div>

              {/* Preview bar */}
              <div className="space-y-1">
                <div className="h-2 bg-accent rounded-pill overflow-hidden relative">
                  <div
                    className="h-full rounded-pill"
                    style={{
                      width: `${clampPercent((goal.currentAmount / goal.targetAmount) * 100)}%`,
                      backgroundColor: goal.color,
                      opacity: 0.5,
                    }}
                  />
                  {depositAmount && Number(depositAmount) > 0 && (
                    <div
                      className="absolute top-0 h-full rounded-pill transition-all duration-300"
                      style={{
                        left: `${clampPercent((goal.currentAmount / goal.targetAmount) * 100)}%`,
                        width: `${Math.min(
                          newPercent - clampPercent((goal.currentAmount / goal.targetAmount) * 100),
                          100 - clampPercent((goal.currentAmount / goal.targetAmount) * 100)
                        )}%`,
                        backgroundColor: "#4ade80",
                      }}
                    />
                  )}
                </div>
                {depositAmount && Number(depositAmount) > 0 && (
                  <p className="text-xs text-success flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    {newPercent.toFixed(1)}% after deposit
                    {newTotal >= goal.targetAmount && " — Goal reached! 🎉"}
                  </p>
                )}
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Amount to add
                </label>
                <input
                  {...register("amount", { valueAsNumber: true })}
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  className="input-field text-lg"
                  autoFocus
                />
                {errors.amount && (
                  <p className="mt-1 text-xs text-danger">{errors.amount.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 bg-gold text-background font-semibold py-2.5 px-4 rounded-md hover:bg-gold-hover transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {isSubmitting ? "Adding…" : "Add Funds"}
              </button>
            </form>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
