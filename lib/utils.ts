import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, startOfMonth, endOfMonth, subMonths } from "date-fns";

// ── Tailwind class merger ────────────────────────────────────────────
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Currency formatting ──────────────────────────────────────────────
export function formatCurrency(
  amount: number,
  currency = "USD",
  locale = "en-US"
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatCompactCurrency(
  amount: number,
  currency = "USD",
  locale = "en-US"
): string {
  if (Math.abs(amount) >= 1000) {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(amount);
  }
  return formatCurrency(amount, currency, locale);
}

// ── Date formatting ──────────────────────────────────────────────────
export function formatDate(date: Date | string, fmt = "MMM d, yyyy"): string {
  return format(new Date(date), fmt);
}

export function formatDateShort(date: Date | string): string {
  return format(new Date(date), "MMM d");
}

export function formatRelativeTime(date: Date | string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function getMonthKey(date = new Date()): string {
  return format(date, "yyyy-MM");
}

export function getMonthRange(date = new Date()) {
  return {
    start: startOfMonth(date),
    end: endOfMonth(date),
  };
}

export function getPreviousMonthRange(date = new Date()) {
  const prev = subMonths(date, 1);
  return {
    start: startOfMonth(prev),
    end: endOfMonth(prev),
  };
}

// ── Number helpers ───────────────────────────────────────────────────
export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

// ── Category helpers ─────────────────────────────────────────────────
export type CategoryMeta = {
  icon: string;
  color: string;
  label: string;
};

export const DEFAULT_CATEGORIES: Record<string, CategoryMeta> = {
  food: { icon: "🍔", color: "#f5c842", label: "Food & Dining" },
  transport: { icon: "🚗", color: "#2dd4bf", label: "Transport" },
  shopping: { icon: "🛍️", color: "#a78bfa", label: "Shopping" },
  entertainment: { icon: "🎬", color: "#f472b6", label: "Entertainment" },
  health: { icon: "💊", color: "#4ade80", label: "Health & Fitness" },
  utilities: { icon: "⚡", color: "#fb923c", label: "Utilities" },
  housing: { icon: "🏠", color: "#60a5fa", label: "Housing" },
  education: { icon: "📚", color: "#34d399", label: "Education" },
  travel: { icon: "✈️", color: "#818cf8", label: "Travel" },
  other: { icon: "📦", color: "#71717a", label: "Other" },
};

export function getCategoryMeta(name: string): CategoryMeta {
  const key = name.toLowerCase();
  return (
    DEFAULT_CATEGORIES[key] ?? {
      icon: "📦",
      color: "#71717a",
      label: name,
    }
  );
}

// ── Budget status color ──────────────────────────────────────────────
export function getBudgetStatusColor(percent: number): string {
  if (percent >= 100) return "#f87171";
  if (percent >= 90) return "#f87171";
  if (percent >= 75) return "#f5c842";
  return "#4ade80";
}

export function getBudgetStatusLabel(percent: number): string {
  if (percent >= 100) return "Over budget";
  if (percent >= 90) return "Almost full";
  if (percent >= 75) return "Moderate";
  return "On track";
}

// ── Greeting helper ──────────────────────────────────────────────────
export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

// ── Truncation ───────────────────────────────────────────────────────
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "…";
}
