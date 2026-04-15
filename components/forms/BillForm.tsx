"use client";

import { useEffect, useState } from "react";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { billSchema, type BillInput } from "@/lib/validations";
import { Select, SelectItem } from "@/components/ui/Select";
import { useBillStore, type Bill } from "@/lib/stores/billStore";

type Category = {
  id: string;
  name: string;
  icon: string;
  color: string;
};

type BillFormProps = {
  editingBill?: Bill | null;
  onSuccess: () => void;
};

const FREQUENCIES = [
  { value: "monthly", label: "Monthly" },
  { value: "weekly", label: "Weekly" },
  { value: "yearly", label: "Yearly" },
  { value: "once", label: "One-time" },
] as const;

export function BillForm({ editingBill, onSuccess }: BillFormProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const { addBill, updateBill } = useBillStore();
  const isEditing = !!editingBill;

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<BillInput>({
    resolver: zodResolver(billSchema) as Resolver<BillInput>,
    defaultValues: editingBill
      ? {
          name: editingBill.name,
          amount: editingBill.amount,
          frequency: editingBill.frequency,
          dueDay: editingBill.dueDay,
          categoryId: editingBill.categoryId ?? undefined,
          notes: editingBill.notes ?? undefined,
          isActive: editingBill.isActive,
        }
      : {
          frequency: "monthly",
          dueDay: 1,
          isActive: true,
        },
  });

  const frequency = watch("frequency");

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((d) => setCategories(d.categories ?? []));
  }, []);

  async function onSubmit(data: BillInput) {
    try {
      const url = isEditing ? `/api/bills/${editingBill!.id}` : "/api/bills";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          categoryId: data.categoryId || null,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        toast.error(result.error ?? "Failed to save bill");
        return;
      }

      const serialized = {
        ...result,
        nextDueDate:
          typeof result.nextDueDate === "string"
            ? result.nextDueDate
            : new Date(result.nextDueDate).toISOString(),
        createdAt:
          typeof result.createdAt === "string"
            ? result.createdAt
            : new Date(result.createdAt).toISOString(),
        updatedAt:
          typeof result.updatedAt === "string"
            ? result.updatedAt
            : new Date(result.updatedAt).toISOString(),
      } as Bill;

      if (isEditing) {
        updateBill(editingBill!.id, serialized);
        toast.success("Bill updated");
      } else {
        addBill(serialized);
        toast.success("Bill created");
      }

      onSuccess();
    } catch {
      toast.error("Something went wrong");
    }
  }

  const dueHint =
    frequency === "weekly"
      ? "1 = Monday … 7 = Sunday"
      : "Day of month (1–31)";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Bill name
        </label>
        <input
          {...register("name")}
          placeholder="e.g. Rent, Internet"
          className="input-field"
        />
        {errors.name && (
          <p className="mt-1 text-xs text-danger">{errors.name.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Amount
        </label>
        <input
          type="number"
          step="0.01"
          min={0}
          {...register("amount")}
          className="input-field"
        />
        {errors.amount && (
          <p className="mt-1 text-xs text-danger">{errors.amount.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Frequency
          </label>
          <Controller
            name="frequency"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                placeholder="Frequency"
              >
                {FREQUENCIES.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </Select>
            )}
          />
          {errors.frequency && (
            <p className="mt-1 text-xs text-danger">
              {errors.frequency.message}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Due day
          </label>
          <input
            type="number"
            min={1}
            max={31}
            {...register("dueDay")}
            className="input-field"
          />
          <p className="mt-1 text-[11px] text-muted">{dueHint}</p>
          {errors.dueDay && (
            <p className="mt-1 text-xs text-danger">{errors.dueDay.message}</p>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Category
        </label>
        <Controller
          name="categoryId"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value ?? "__none__"}
              onValueChange={(v) =>
                field.onChange(v === "__none__" ? undefined : v)
              }
              placeholder="Optional"
            >
              <SelectItem value="__none__">None</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </SelectItem>
              ))}
            </Select>
          )}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Notes
        </label>
        <textarea
          {...register("notes")}
          rows={2}
          placeholder="Optional reminder details"
          className="input-field resize-none"
        />
        {errors.notes && (
          <p className="mt-1 text-xs text-danger">{errors.notes.message}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input type="checkbox" id="bill-active" {...register("isActive")} />
        <label htmlFor="bill-active" className="text-sm text-foreground">
          Active (show in upcoming)
        </label>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full flex items-center justify-center gap-2 bg-gold text-background font-semibold text-sm py-2.5 px-4 rounded-md hover:bg-gold-hover transition-colors disabled:opacity-60"
      >
        {isSubmitting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : null}
        {isEditing ? "Save changes" : "Add bill"}
      </button>
    </form>
  );
}
