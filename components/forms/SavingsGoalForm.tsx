"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { savingsGoalSchema, type SavingsGoalInput } from "@/lib/validations";
import { useSavingsStore } from "@/lib/stores/savingsStore";
import { formatDate } from "@/lib/utils";

const PRESET_ICONS = ["🎯", "🏠", "✈️", "🚗", "💻", "💍", "📚", "🎓", "🏖️", "💰", "🌟", "🎁"];
const PRESET_COLORS = [
  "#f5c842", "#4ade80", "#2dd4bf", "#60a5fa",
  "#a78bfa", "#f472b6", "#fb923c", "#f87171",
];

type SavingsGoalFormProps = {
  editingGoal?: {
    id: string;
    name: string;
    description: string | null;
    targetAmount: number;
    currentAmount: number;
    targetDate: string | null;
    icon: string;
    color: string;
  } | null;
  onSuccess: () => void;
};

export function SavingsGoalForm({ editingGoal, onSuccess }: SavingsGoalFormProps) {
  const { addGoal, updateGoal } = useSavingsStore();
  const isEditing = !!editingGoal;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SavingsGoalInput>({
    resolver: zodResolver(savingsGoalSchema) as Resolver<SavingsGoalInput>,
    defaultValues: editingGoal
      ? {
          name: editingGoal.name,
          description: editingGoal.description ?? "",
          targetAmount: editingGoal.targetAmount,
          currentAmount: editingGoal.currentAmount,
          targetDate: editingGoal.targetDate
            ? formatDate(editingGoal.targetDate, "yyyy-MM-dd")
            : undefined,
          icon: editingGoal.icon,
          color: editingGoal.color,
          isCompleted: false,
        }
      : {
          icon: "🎯",
          color: "#f5c842",
          currentAmount: 0,
          isCompleted: false,
        },
  });

  const selectedIcon = watch("icon");
  const selectedColor = watch("color");

  async function onSubmit(data: SavingsGoalInput) {
    try {
      const url = isEditing ? `/api/savings/${editingGoal!.id}` : "/api/savings";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();

      if (!res.ok) {
        toast.error(result.error ?? "Failed to save goal");
        return;
      }

      if (isEditing) {
        updateGoal(editingGoal!.id, result);
        toast.success("Goal updated");
      } else {
        addGoal(result);
        toast.success("Goal created!");
      }

      onSuccess();
    } catch {
      toast.error("Something went wrong");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Goal name
        </label>
        <input
          {...register("name")}
          placeholder="e.g. Emergency Fund"
          className="input-field"
        />
        {errors.name && (
          <p className="mt-1 text-xs text-danger">{errors.name.message}</p>
        )}
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Description{" "}
          <span className="text-muted font-normal">(optional)</span>
        </label>
        <textarea
          {...register("description")}
          rows={2}
          placeholder="What are you saving for?"
          className="input-field resize-none"
        />
      </div>

      {/* Target amount */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Target amount
        </label>
        <input
          {...register("targetAmount", { valueAsNumber: true })}
          type="number"
          step="0.01"
          placeholder="0.00"
          className="input-field"
        />
        {errors.targetAmount && (
          <p className="mt-1 text-xs text-danger">{errors.targetAmount.message}</p>
        )}
      </div>

      {/* Starting amount (only on create) */}
      {!isEditing && (
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Starting amount{" "}
            <span className="text-muted font-normal">(optional)</span>
          </label>
          <input
            {...register("currentAmount", { valueAsNumber: true })}
            type="number"
            step="0.01"
            placeholder="0.00"
            className="input-field"
          />
        </div>
      )}

      {/* Target date */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Target date{" "}
          <span className="text-muted font-normal">(optional)</span>
        </label>
        <input
          {...register("targetDate")}
          type="date"
          className="input-field"
        />
      </div>

      {/* Icon picker */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Icon
        </label>
        <div className="flex flex-wrap gap-2">
          {PRESET_ICONS.map((icon) => (
            <button
              key={icon}
              type="button"
              onClick={() => setValue("icon", icon)}
              className={`w-9 h-9 rounded-md text-lg flex items-center justify-center transition-all border ${
                selectedIcon === icon
                  ? "border-gold/60 bg-gold/10 scale-110"
                  : "border-border hover:border-border/60 hover:bg-accent"
              }`}
            >
              {icon}
            </button>
          ))}
        </div>
      </div>

      {/* Color picker */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Color
        </label>
        <div className="flex items-center gap-2 flex-wrap">
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setValue("color", color)}
              className={`w-7 h-7 rounded-full transition-all border-2 ${
                selectedColor === color
                  ? "scale-125 border-foreground/40"
                  : "border-transparent"
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
          <input
            type="color"
            value={selectedColor ?? "#f5c842"}
            onChange={(e) => setValue("color", e.target.value)}
            className="w-7 h-7 rounded-full cursor-pointer bg-transparent border-0"
            title="Custom color"
          />
        </div>
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
          ? "Update Goal"
          : "Create Goal"}
      </button>
    </form>
  );
}
