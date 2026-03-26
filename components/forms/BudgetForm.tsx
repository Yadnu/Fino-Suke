"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { budgetSchema, type BudgetInput } from "@/lib/validations";
import { Select, SelectItem } from "@/components/ui/Select";
import { useBudgetStore } from "@/lib/stores/budgetStore";
import { getMonthKey } from "@/lib/utils";

type Category = {
  id: string;
  name: string;
  icon: string;
  color: string;
};

type BudgetFormProps = {
  editingBudget?: {
    id: string;
    name: string;
    categoryId: string | null;
    amount: number;
    period: "weekly" | "monthly";
    month: string;
    rollover: boolean;
  } | null;
  onSuccess: () => void;
};

export function BudgetForm({ editingBudget, onSuccess }: BudgetFormProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const { addBudget, updateBudget } = useBudgetStore();
  const isEditing = !!editingBudget;

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(budgetSchema),
    defaultValues: editingBudget
      ? {
          name: editingBudget.name,
          categoryId: editingBudget.categoryId ?? undefined,
          amount: editingBudget.amount,
          period: editingBudget.period,
          month: editingBudget.month,
          rollover: editingBudget.rollover,
        }
      : {
          period: "monthly",
          month: getMonthKey(),
          rollover: false,
        },
  });

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((d) => setCategories(d.categories ?? []));
  }, []);

  async function onSubmit(data: BudgetInput) {
    try {
      const url = isEditing
        ? `/api/budgets/${editingBudget!.id}`
        : "/api/budgets";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (!res.ok) {
        toast.error(result.error ?? "Failed to save budget");
        return;
      }

      const serialized = {
        ...result,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      };

      if (isEditing) {
        updateBudget(editingBudget!.id, serialized);
        toast.success("Budget updated");
      } else {
        addBudget(serialized);
        toast.success("Budget created");
      }

      onSuccess();
    } catch {
      toast.error("Something went wrong");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Budget name */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Budget name
        </label>
        <input
          {...register("name")}
          placeholder="e.g. Food & Dining"
          className="input-field"
        />
        {errors.name && (
          <p className="mt-1 text-xs text-danger">{errors.name.message}</p>
        )}
      </div>

      {/* Category */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Category{" "}
          <span className="text-muted font-normal">(optional)</span>
        </label>
        <Controller
          name="categoryId"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value ?? ""}
              onValueChange={field.onChange}
              placeholder="Select category"
            >
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name}
                </SelectItem>
              ))}
            </Select>
          )}
        />
      </div>

      {/* Amount */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Budget amount
        </label>
        <input
          {...register("amount", { valueAsNumber: true })}
          type="number"
          step="0.01"
          placeholder="0.00"
          className="input-field"
        />
        {errors.amount && (
          <p className="mt-1 text-xs text-danger">{errors.amount.message}</p>
        )}
      </div>

      {/* Period */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Period
        </label>
        <Controller
          name="period"
          control={control}
          render={({ field }) => (
            <div className="grid grid-cols-2 gap-2">
              {(["monthly", "weekly"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => field.onChange(p)}
                  className={`py-2 rounded-md text-sm font-medium transition-colors border capitalize ${
                    field.value === p
                      ? "bg-gold/15 border-gold/30 text-gold"
                      : "bg-surface border-border text-muted hover:text-foreground"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        />
      </div>

      {/* Rollover */}
      <div className="flex items-center gap-3">
        <input
          {...register("rollover")}
          type="checkbox"
          id="rollover"
          className="w-4 h-4 rounded border-border bg-surface accent-gold"
        />
        <label htmlFor="rollover" className="text-sm text-foreground cursor-pointer">
          Roll over unused budget to next month
        </label>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full flex items-center justify-center gap-2 bg-gold text-background font-semibold py-2.5 px-4 rounded-md hover:bg-gold-hover transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        {isSubmitting
          ? "Saving…"
          : isEditing
          ? "Update Budget"
          : "Create Budget"}
      </button>
    </form>
  );
}
