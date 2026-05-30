"use client";

import { useEffect } from "react";
import { type Resolver, useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { netWorthAccountSchema, type NetWorthAccountInput } from "@/lib/validations";
import { Select, SelectItem } from "@/components/ui/Select";
import type { NetWorthAccount } from "@/lib/stores/networthStore";

const ASSET_CATEGORIES = [
  { value: "cash",         label: "Cash & Bank" },
  { value: "investment",   label: "Investments" },
  { value: "real_estate",  label: "Real Estate" },
  { value: "vehicle",      label: "Vehicle" },
  { value: "other_asset",  label: "Other Asset" },
] as const;

const LIABILITY_CATEGORIES = [
  { value: "credit_card",       label: "Credit Card" },
  { value: "loan",              label: "Loan" },
  { value: "mortgage",          label: "Mortgage" },
  { value: "other_liability",   label: "Other Liability" },
] as const;

type Props = {
  editingAccount?: NetWorthAccount | null;
  onSuccess: (account: NetWorthAccount) => void;
};

export function NetWorthAccountForm({ editingAccount, onSuccess }: Props) {
  const isEditing = !!editingAccount;

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<NetWorthAccountInput>({
    resolver: zodResolver(netWorthAccountSchema) as Resolver<NetWorthAccountInput>,
    defaultValues: editingAccount
      ? {
          name: editingAccount.name,
          type: editingAccount.type as "asset" | "liability",
          category: editingAccount.category as NetWorthAccountInput["category"],
          value: editingAccount.value,
          notes: editingAccount.notes ?? undefined,
        }
      : { type: "asset", category: "cash" },
  });

  const selectedType = watch("type");

  // Reset category when type changes
  useEffect(() => {
    if (selectedType === "asset") {
      setValue("category", "cash");
    } else {
      setValue("category", "credit_card");
    }
  }, [selectedType, setValue]);

  const categoryOptions = selectedType === "asset" ? ASSET_CATEGORIES : LIABILITY_CATEGORIES;

  async function onSubmit(data: NetWorthAccountInput) {
    try {
      const url = isEditing
        ? `/api/networth/accounts/${editingAccount!.id}`
        : "/api/networth/accounts";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (!res.ok) {
        toast.error(result.error ?? "Something went wrong");
        return;
      }

      toast.success(isEditing ? "Account updated" : "Account added");
      onSuccess(result);
    } catch {
      toast.error("Network error. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Name */}
      <div>
        <label className="label" htmlFor="name">Account Name</label>
        <input
          id="name"
          {...register("name")}
          placeholder="e.g. Emergency Fund, Car Loan"
          className="input-field"
        />
        {errors.name && <p className="field-error">{errors.name.message}</p>}
      </div>

      {/* Type */}
      <div>
        <label className="label">Type</label>
        <Controller
          name="type"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={field.onChange}
              placeholder="Select type"
            >
              <SelectItem value="asset">Asset</SelectItem>
              <SelectItem value="liability">Liability</SelectItem>
            </Select>
          )}
        />
        {errors.type && <p className="field-error">{errors.type.message}</p>}
      </div>

      {/* Category */}
      <div>
        <label className="label">Category</label>
        <Controller
          name="category"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={field.onChange}
              placeholder="Select category"
            >
              {categoryOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </Select>
          )}
        />
        {errors.category && <p className="field-error">{errors.category.message}</p>}
      </div>

      {/* Value */}
      <div>
        <label className="label" htmlFor="value">
          {selectedType === "asset" ? "Current Value" : "Balance Owed"}
        </label>
        <input
          id="value"
          type="number"
          step="0.01"
          min="0"
          {...register("value")}
          placeholder="0.00"
          className="input-field"
        />
        {errors.value && <p className="field-error">{errors.value.message}</p>}
      </div>

      {/* Notes */}
      <div>
        <label className="label" htmlFor="notes">Notes (optional)</label>
        <input
          id="notes"
          {...register("notes")}
          placeholder="Any details about this account"
          className="input-field"
        />
        {errors.notes && <p className="field-error">{errors.notes.message}</p>}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full flex items-center justify-center gap-2 bg-gold text-background font-semibold text-sm py-2.5 rounded-md hover:bg-gold-hover transition-colors disabled:opacity-60"
      >
        {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
        {isEditing ? "Update Account" : "Add Account"}
      </button>
    </form>
  );
}
