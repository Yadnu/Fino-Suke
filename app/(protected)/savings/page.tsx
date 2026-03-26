"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Plus, Loader2, Target } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/Sheet";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { GoalCard } from "@/components/savings/GoalCard";
import { DepositSheet } from "@/components/savings/DepositSheet";
import { SavingsGoalForm } from "@/components/forms/SavingsGoalForm";
import { SkeletonCard } from "@/components/ui/SkeletonCard";
import {
  useSavingsStore,
  type SavingsGoal,
} from "@/lib/stores/savingsStore";
import { formatCurrency } from "@/lib/utils";

export default function SavingsPage() {
  const { goals, isLoading, setGoals, removeGoal, setLoading } =
    useSavingsStore();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [depositGoal, setDepositGoal] = useState<SavingsGoal | null>(null);
  const [depositOpen, setDepositOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchGoals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/savings");
      const data = await res.json();
      setGoals(data.goals ?? []);
    } finally {
      setLoading(false);
    }
  }, [setGoals, setLoading]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  async function handleDelete(id: string) {
    setDeletingId(id);
    removeGoal(id);
    try {
      const res = await fetch(`/api/savings/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Failed to delete goal");
        fetchGoals();
      } else {
        toast.success("Goal deleted");
      }
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  }

  const activeGoals = goals.filter((g) => !g.isCompleted);
  const completedGoals = goals.filter((g) => g.isCompleted);
  const totalSaved = goals.reduce((sum, g) => sum + g.currentAmount, 0);
  const totalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0);
  const overallPercent =
    totalTarget > 0
      ? Math.min(100, (totalSaved / totalTarget) * 100)
      : 0;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Savings Goals
          </h1>
          <p className="text-sm text-muted mt-1">
            {goals.length} goal{goals.length !== 1 ? "s" : ""} ·{" "}
            {completedGoals.length} completed
          </p>
        </div>
        <Sheet
          open={sheetOpen}
          onOpenChange={(v) => {
            setSheetOpen(v);
            if (!v) setEditingGoal(null);
          }}
        >
          <SheetTrigger asChild>
            <button className="flex items-center gap-2 bg-gold text-background font-semibold text-sm py-2 px-4 rounded-md hover:bg-gold-hover transition-colors">
              <Plus className="w-4 h-4" />
              New Goal
            </button>
          </SheetTrigger>
          <SheetContent
            title={editingGoal ? "Edit Goal" : "New Savings Goal"}
            description={
              editingGoal
                ? "Update your goal details"
                : "Define what you're saving towards"
            }
          >
            <SavingsGoalForm
              editingGoal={editingGoal}
              onSuccess={() => {
                setSheetOpen(false);
                setEditingGoal(null);
              }}
            />
          </SheetContent>
        </Sheet>
      </div>

      {/* Summary bar */}
      {goals.length > 0 && (
        <div className="bg-surface border border-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-gold" />
              <span className="text-sm font-medium text-foreground">
                Overall Progress
              </span>
            </div>
            <span className="text-sm font-semibold text-foreground">
              {overallPercent.toFixed(1)}%
            </span>
          </div>
          <div className="h-2 bg-accent rounded-pill overflow-hidden mb-3">
            <div
              className="h-full rounded-pill bg-gold transition-all duration-700"
              style={{ width: `${overallPercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">Total saved</span>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-foreground">
                {formatCurrency(totalSaved)}
              </span>
              <span className="text-muted">/ {formatCurrency(totalTarget)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : goals.length === 0 ? (
        <div className="bg-surface border border-border rounded-lg p-16 text-center">
          <p className="text-5xl mb-4">🎯</p>
          <p className="text-base font-semibold text-foreground mb-1">
            No savings goals yet
          </p>
          <p className="text-sm text-muted mb-5">
            Set your first goal and start building towards it
          </p>
          <Sheet
            open={sheetOpen}
            onOpenChange={(v) => {
              setSheetOpen(v);
              if (!v) setEditingGoal(null);
            }}
          >
            <SheetTrigger asChild>
              <button className="inline-flex items-center gap-2 bg-gold text-background font-semibold text-sm py-2 px-4 rounded-md hover:bg-gold-hover transition-colors">
                <Plus className="w-4 h-4" />
                Create First Goal
              </button>
            </SheetTrigger>
            <SheetContent
              title="New Savings Goal"
              description="Define what you're saving towards"
            >
              <SavingsGoalForm
                editingGoal={null}
                onSuccess={() => {
                  setSheetOpen(false);
                }}
              />
            </SheetContent>
          </Sheet>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active goals */}
          {activeGoals.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-muted uppercase tracking-wide mb-3 px-1">
                Active Goals
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {activeGoals.map((goal) => (
                  <Dialog
                    key={goal.id}
                    open={confirmDeleteId === goal.id}
                    onOpenChange={(v) =>
                      setConfirmDeleteId(v ? goal.id : null)
                    }
                  >
                    <GoalCard
                      goal={goal}
                      onEdit={() => {
                        setEditingGoal(goal);
                        setSheetOpen(true);
                      }}
                      onDelete={() => setConfirmDeleteId(goal.id)}
                      onDeposit={() => {
                        setDepositGoal(goal);
                        setDepositOpen(true);
                      }}
                    />
                    <DialogContent
                      title="Delete goal?"
                      description="All progress will be lost. This action cannot be undone."
                    >
                      <div className="flex gap-3 justify-end mt-2">
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-4 py-2 text-sm rounded-md border border-border text-muted hover:text-foreground transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleDelete(goal.id)}
                          disabled={deletingId === goal.id}
                          className="px-4 py-2 text-sm rounded-md bg-danger/15 border border-danger/30 text-danger hover:bg-danger/25 transition-colors disabled:opacity-60 flex items-center gap-2"
                        >
                          {deletingId === goal.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : null}
                          Delete
                        </button>
                      </div>
                    </DialogContent>
                  </Dialog>
                ))}
              </div>
            </div>
          )}

          {/* Completed goals */}
          {completedGoals.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-muted uppercase tracking-wide mb-3 px-1">
                Completed Goals
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {completedGoals.map((goal) => (
                  <Dialog
                    key={goal.id}
                    open={confirmDeleteId === goal.id}
                    onOpenChange={(v) =>
                      setConfirmDeleteId(v ? goal.id : null)
                    }
                  >
                    <GoalCard
                      goal={goal}
                      onEdit={() => {
                        setEditingGoal(goal);
                        setSheetOpen(true);
                      }}
                      onDelete={() => setConfirmDeleteId(goal.id)}
                      onDeposit={() => {
                        setDepositGoal(goal);
                        setDepositOpen(true);
                      }}
                    />
                    <DialogContent
                      title="Delete goal?"
                      description="This action cannot be undone."
                    >
                      <div className="flex gap-3 justify-end mt-2">
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-4 py-2 text-sm rounded-md border border-border text-muted hover:text-foreground transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleDelete(goal.id)}
                          disabled={deletingId === goal.id}
                          className="px-4 py-2 text-sm rounded-md bg-danger/15 border border-danger/30 text-danger hover:bg-danger/25 transition-colors disabled:opacity-60 flex items-center gap-2"
                        >
                          {deletingId === goal.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : null}
                          Delete
                        </button>
                      </div>
                    </DialogContent>
                  </Dialog>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Deposit sheet */}
      <DepositSheet
        goal={depositGoal}
        open={depositOpen}
        onOpenChange={(v) => {
          setDepositOpen(v);
          if (!v) setDepositGoal(null);
        }}
      />
    </div>
  );
}
