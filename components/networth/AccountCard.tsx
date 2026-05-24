"use client";

import { Pencil, Trash2 } from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";
import { useUserSettings } from "@/lib/context/UserSettingsContext";
import type { NetWorthAccount } from "@/lib/stores/networthStore";

const CATEGORY_LABELS: Record<string, string> = {
  cash:              "Cash & Bank",
  investment:        "Investments",
  real_estate:       "Real Estate",
  vehicle:           "Vehicle",
  other_asset:       "Other Asset",
  credit_card:       "Credit Card",
  loan:              "Loan",
  mortgage:          "Mortgage",
  other_liability:   "Other Liability",
};

const CATEGORY_ICONS: Record<string, string> = {
  cash:              "🏦",
  investment:        "📈",
  real_estate:       "🏠",
  vehicle:           "🚗",
  other_asset:       "💼",
  credit_card:       "💳",
  loan:              "📋",
  mortgage:          "🏡",
  other_liability:   "📄",
};

type Props = {
  account: NetWorthAccount;
  currency?: string;
  onEdit: () => void;
  onDelete: () => void;
};

export function AccountCard({ account, currency = "USD", onEdit, onDelete }: Props) {
  const { locale } = useUserSettings();
  const isAsset = account.type === "asset";

  return (
    <div className="group relative bg-surface border border-border rounded-lg px-4 py-3 flex items-center gap-3 hover:border-border/80 hover:shadow-card transition-all">
      {/* Icon */}
      <div
        className={cn(
          "w-9 h-9 rounded-md flex items-center justify-center text-lg shrink-0",
          isAsset ? "bg-success/10" : "bg-danger/10"
        )}
      >
        {CATEGORY_ICONS[account.category] ?? (isAsset ? "💰" : "📉")}
      </div>

      {/* Name + category */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{account.name}</p>
        <p className="text-xs text-muted">{CATEGORY_LABELS[account.category] ?? account.category}</p>
      </div>

      {/* Value */}
      <p
        className={cn(
          "text-sm font-semibold shrink-0 mr-2",
          isAsset ? "text-success" : "text-danger"
        )}
      >
        {formatCurrency(account.value, currency, locale)}
      </p>

      {/* Actions */}
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onEdit}
          className="w-7 h-7 rounded-md flex items-center justify-center text-muted hover:text-foreground hover:bg-accent transition-colors"
          aria-label="Edit"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onDelete}
          className="w-7 h-7 rounded-md flex items-center justify-center text-muted hover:text-danger hover:bg-danger/10 transition-colors"
          aria-label="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
