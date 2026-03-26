"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import { Loader2, RefreshCw } from "lucide-react";
import { transactionSchema, type TransactionInput } from "@/lib/validations";
import { Select, SelectItem } from "@/components/ui/Select";
import { useTransactionStore } from "@/lib/stores/transactionStore";
import { formatDate } from "@/lib/utils";

type Category = {
  id: string;
  name: string;
  icon: string;
  color: string;
};

type TransactionFormProps = {
  editingTransaction?: {
    id: string;
    amount: number;
    type: "expense" | "income";
    categoryId: string | null;
    date: string;
    notes: string | null;
    tags: string[];
    isRecurring: boolean;
  } | null;
  onSuccess: () => void;
};

export function TransactionForm({
  editingTransaction,
  onSuccess,
}: TransactionFormProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const { addTransaction, updateTransaction } = useTransactionStore();
  const isEditing = !!editingTransaction;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(transactionSchema),
    defaultValues: editingTransaction
      ? {
          amount: editingTransaction.amount,
          type: editingTransaction.type,
          categoryId: editingTransaction.categoryId ?? undefined,
          date: editingTransaction.date.slice(0, 10),
          notes: editingTransaction.notes ?? "",
          tags: editingTransaction.tags,
          isRecurring: editingTransaction.isRecurring,
        }
      : {
          type: "expense",
          date: formatDate(new Date(), "yyyy-MM-dd"),
          tags: [],
          isRecurring: false,
        },
  });

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((d) => setCategories(d.categories ?? []));
  }, []);

  async function onSubmit(data: TransactionInput) {
    try {
      const url = isEditing
        ? `/api/transactions/${editingTransaction!.id}`
        : "/api/transactions";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (!res.ok) {
        toast.error(result.error ?? "Failed to save transaction");
        return;
      }

      // Optimistic update
      const serialized = {
        ...result,
        date: result.date,
        createdAt: result.createdAt,
      };

      if (isEditing) {
        updateTransaction(editingTransaction!.id, serialized);
        toast.success("Transaction updated");
      } else {
        addTransaction(serialized);
        toast.success("Transaction added");
      }

      reset();
      onSuccess();
    } catch {
      toast.error("Something went wrong");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Type */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Type
        </label>
        <Controller
          name="type"
          control={control}
          render={({ field }) => (
            <div className="grid grid-cols-2 gap-2">
              {(["expense", "income"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => field.onChange(t)}
                  className={`py-2 rounded-md text-sm font-medium transition-colors border ${
                    field.value === t
                      ? t === "expense"
                        ? "bg-danger/15 border-danger/40 text-danger"
                        : "bg-success/15 border-success/40 text-success"
                      : "bg-surface border-border text-muted hover:text-foreground"
                  }`}
                >
                  {t === "expense" ? "Expense" : "Income"}
                </button>
              ))}
            </div>
          )}
        />
      </div>

      {/* Amount */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Amount
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

      {/* Category */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Category
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

      {/* Date */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Date
        </label>
        <input
          {...register("date")}
          type="date"
          className="input-field"
        />
        {errors.date && (
          <p className="mt-1 text-xs text-danger">{errors.date.message}</p>
        )}
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Notes{" "}
          <span className="text-muted font-normal">(optional)</span>
        </label>
        <textarea
          {...register("notes")}
          rows={2}
          placeholder="Add a note…"
          className="input-field resize-none"
        />
      </div>

      {/* Recurring */}
      <div className="flex items-center gap-3">
        <input
          {...register("isRecurring")}
          type="checkbox"
          id="isRecurring"
          className="w-4 h-4 rounded border-border bg-surface accent-gold"
        />
        <label
          htmlFor="isRecurring"
          className="flex items-center gap-2 text-sm text-foreground cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5 text-muted" />
          Recurring transaction
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
          ? "Update Transaction"
          : "Add Transaction"}
      </button>
    </form>
  );
}
