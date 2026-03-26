"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/Sheet";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/Dialog";
import { BudgetForm } from "@/components/forms/BudgetForm";
import { BudgetBarChart } from "@/components/charts/BudgetBarChart";
import { SkeletonBudgetCard } from "@/components/ui/SkeletonCard";
import { useBudgetStore, type Budget } from "@/lib/stores/budgetStore";
import {
  formatCurrency,
  getMonthKey,
  getBudgetStatusColor,
  getBudgetStatusLabel,
  clampPercent,
  cn,
} from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";

export default function BudgetPage() {
  const { budgets, isLoading, setBudgets, removeBudget, setLoading } =
    useBudgetStore();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const currentMonth = getMonthKey();

  const fetchBudgets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/budgets?month=${currentMonth}`);
      const data = await res.json();
      setBudgets(data.budgets ?? []);
    } finally {
      setLoading(false);
    }
  }, [currentMonth, setBudgets, setLoading]);

  useEffect(() => {
    fetchBudgets();
  }, [fetchBudgets]);

  // Check for overspend and show toast
  useEffect(() => {
    for (const b of budgets) {
      const spent = b.spent ?? 0;
      const percent = (spent / b.amount) * 100;
      if (percent > 100) {
        toast.error(
          `Over budget on ${b.category?.name ?? b.name}! (${percent.toFixed(0)}%)`,
          { id: `overspend-${b.id}` }
        );
      }
    }
  }, [budgets]);

  async function handleDelete(id: string) {
    setDeletingId(id);
    removeBudget(id);
    try {
      const res = await fetch(`/api/budgets/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Failed to delete budget");
        fetchBudgets();
      } else {
        toast.success("Budget deleted");
      }
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  }

  // Chart data
  const chartData = budgets.map((b) => {
    const spent = b.spent ?? 0;
    const percent = clampPercent((spent / b.amount) * 100);
    return {
      name: b.category?.name ?? b.name,
      budget: b.amount,
      spent,
      percent,
    };
  });

  const totalBudget = budgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent = budgets.reduce((s, b) => s + (b.spent ?? 0), 0);
  const overallPercent = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Budget Planning
          </h1>
          <p className="text-sm text-muted mt-1">
            {new Date().toLocaleString("default", {
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <Sheet
          open={sheetOpen}
          onOpenChange={(v) => {
            setSheetOpen(v);
            if (!v) setEditingBudget(null);
          }}
        >
          <SheetTrigger asChild>
            <button className="flex items-center gap-2 bg-gold text-background font-semibold text-sm py-2 px-4 rounded-md hover:bg-gold-hover transition-colors">
              <Plus className="w-4 h-4" />
              New Budget
            </button>
          </SheetTrigger>
          <SheetContent
            title={editingBudget ? "Edit Budget" : "New Budget"}
            description={
              editingBudget
                ? "Update your budget settings"
                : "Set a spending limit for a category"
            }
          >
            <BudgetForm
              editingBudget={editingBudget}
              onSuccess={() => {
                setSheetOpen(false);
                setEditingBudget(null);
                fetchBudgets();
              }}
            />
          </SheetContent>
        </Sheet>
      </div>

      {/* Overall summary */}
      {budgets.length > 0 && (
        <div className="bg-surface border border-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm text-muted">Overall Budget Usage</p>
              <p className="font-display text-xl font-bold text-foreground mt-0.5">
                {formatCurrency(totalSpent)} /{" "}
                <span className="text-muted font-normal text-base">
                  {formatCurrency(totalBudget)}
                </span>
              </p>
            </div>
            <Badge
              variant={
                overallPercent >= 100
                  ? "danger"
                  : overallPercent >= 75
                  ? "gold"
                  : "success"
              }
            >
              {overallPercent.toFixed(0)}% used
            </Badge>
          </div>
          <div className="progress-bar h-2">
            <div
              className="progress-bar-fill"
              style={{
                width: `${clampPercent(overallPercent)}%`,
                backgroundColor: getBudgetStatusColor(overallPercent),
              }}
            />
          </div>

          {/* Chart */}
          {chartData.length > 0 && (
            <div className="mt-5 pt-4 border-t border-border">
              <p className="text-xs text-muted mb-3">Budget vs. Actual by Category</p>
              <BudgetBarChart data={chartData} />
            </div>
          )}
        </div>
      )}

      {/* Budget cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonBudgetCard key={i} />
          ))}
        </div>
      ) : budgets.length === 0 ? (
        <div className="bg-surface border border-border rounded-lg p-12 text-center">
          <p className="text-4xl mb-4">📋</p>
          <p className="text-base font-medium text-foreground mb-1">
            No budgets for this month
          </p>
          <p className="text-sm text-muted">
            Create your first budget to start tracking spending limits
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {budgets.map((budget) => {
            const spent = budget.spent ?? 0;
            const percent = clampPercent((spent / budget.amount) * 100);
            const statusColor = getBudgetStatusColor(percent);
            const statusLabel = getBudgetStatusLabel(percent);
            const icon = budget.category?.icon ?? "📦";
            const isOver = percent >= 100;

            return (
              <div
                key={budget.id}
                className={cn(
                  "bg-surface border rounded-lg p-5 space-y-4 card-hover",
                  isOver ? "border-danger/40" : "border-border"
                )}
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {budget.category?.name ?? budget.name}
                      </p>
                      <p className="text-xs text-muted capitalize">
                        {budget.period}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingBudget(budget);
                        setSheetOpen(true);
                      }}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-muted hover:text-foreground hover:bg-accent transition-colors"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>

                    <Dialog
                      open={confirmDeleteId === budget.id}
                      onOpenChange={(v) =>
                        setConfirmDeleteId(v ? budget.id : null)
                      }
                    >
                      <DialogTrigger asChild>
                        <button className="w-7 h-7 rounded-md flex items-center justify-center text-muted hover:text-danger hover:bg-danger/10 transition-colors">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </DialogTrigger>
                      <DialogContent
                        title="Delete budget?"
                        description="This will remove the budget limit. Transactions are kept."
                      >
                        <div className="flex gap-3 justify-end mt-2">
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-4 py-2 text-sm rounded-md border border-border text-muted hover:text-foreground transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleDelete(budget.id)}
                            disabled={deletingId === budget.id}
                            className="px-4 py-2 text-sm rounded-md bg-danger/15 border border-danger/30 text-danger hover:bg-danger/25 transition-colors disabled:opacity-60 flex items-center gap-2"
                          >
                            {deletingId === budget.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : null}
                            Delete
                          </button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>

                {/* Progress */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted">
                      {formatCurrency(spent)} spent
                    </span>
                    <span
                      className="text-xs font-semibold"
                      style={{ color: statusColor }}
                    >
                      {percent.toFixed(0)}%
                    </span>
                  </div>
                  <div className="progress-bar h-2">
                    <div
                      className="progress-bar-fill"
                      style={{
                        width: `${percent}%`,
                        backgroundColor: statusColor,
                      }}
                    />
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted">
                    of {formatCurrency(budget.amount)}
                  </span>
                  <Badge
                    variant={
                      isOver
                        ? "danger"
                        : percent >= 75
                        ? "gold"
                        : "success"
                    }
                  >
                    {statusLabel}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
