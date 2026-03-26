import { describe, it, expect } from "vitest";
import {
  cn,
  formatCurrency,
  formatCompactCurrency,
  billDaysUntilDue,
  getMonthKey,
  formatPercent,
  clampPercent,
  getCategoryMeta,
  getBudgetStatusColor,
  getBudgetStatusLabel,
  truncate,
  DEFAULT_CATEGORIES,
} from "@/lib/utils";

describe("cn", () => {
  it("should merge class names correctly", () => {
    expect(cn("px-4", "py-2")).toBe("px-4 py-2");
  });

  it("should override conflicting Tailwind classes via tailwind-merge", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("should filter out falsy values", () => {
    expect(cn("px-4", false && "py-2", undefined)).toBe("px-4");
  });
});

describe("formatCurrency", () => {
  it("should format a USD amount with two decimal places", () => {
    const result = formatCurrency(1234.56, "USD", "en-US");
    expect(result).toBe("$1,234.56");
  });

  it("should default to USD when no currency is provided", () => {
    const result = formatCurrency(100);
    expect(result).toContain("100");
  });
});

describe("formatCompactCurrency", () => {
  it("should use compact notation for amounts >= 1000", () => {
    const result = formatCompactCurrency(1500, "USD", "en-US");
    expect(result).toContain("K");
  });

  it("should use standard notation for amounts < 1000", () => {
    const result = formatCompactCurrency(500, "USD", "en-US");
    expect(result).toBe("$500.00");
  });
});

describe("billDaysUntilDue", () => {
  it("should return a positive number for a future due date", () => {
    const future = new Date();
    future.setDate(future.getDate() + 5);
    expect(billDaysUntilDue(future)).toBe(5);
  });

  it("should return 0 for a due date that is today", () => {
    const today = new Date();
    expect(billDaysUntilDue(today)).toBe(0);
  });

  it("should return a negative number for an overdue date", () => {
    const past = new Date();
    past.setDate(past.getDate() - 3);
    expect(billDaysUntilDue(past)).toBe(-3);
  });
});

describe("getMonthKey", () => {
  it("should return a string in YYYY-MM format", () => {
    const key = getMonthKey(new Date("2024-03-15"));
    expect(key).toBe("2024-03");
  });
});

describe("formatPercent", () => {
  it("should format a number as a percentage string with one decimal", () => {
    expect(formatPercent(42.5)).toBe("42.5%");
  });

  it("should respect the decimals parameter", () => {
    expect(formatPercent(33.33, 0)).toBe("33%");
  });
});

describe("clampPercent", () => {
  it("should return the value when between 0 and 100", () => {
    expect(clampPercent(50)).toBe(50);
  });

  it("should return 100 when value exceeds 100", () => {
    expect(clampPercent(150)).toBe(100);
  });

  it("should return 0 when value is below 0", () => {
    expect(clampPercent(-10)).toBe(0);
  });
});

describe("getCategoryMeta", () => {
  it("should return matching metadata for a known category key", () => {
    const meta = getCategoryMeta("food");
    expect(meta.label).toBe("Food & Dining");
    expect(meta.icon).toBe("🍔");
  });

  it("should return fallback metadata for an unknown category name", () => {
    const meta = getCategoryMeta("unknown-xyz");
    expect(meta.icon).toBe("📦");
    expect(meta.label).toBe("unknown-xyz");
  });

  it("should be case-insensitive for known categories", () => {
    const meta = getCategoryMeta("FOOD");
    expect(meta.label).toBe("Food & Dining");
  });
});

describe("getBudgetStatusColor", () => {
  it("should return red color when at or over 100%", () => {
    expect(getBudgetStatusColor(100)).toBe("#f87171");
    expect(getBudgetStatusColor(110)).toBe("#f87171");
  });

  it("should return red color when at or over 90% but under 100%", () => {
    expect(getBudgetStatusColor(90)).toBe("#f87171");
  });

  it("should return yellow color when between 75% and 90%", () => {
    expect(getBudgetStatusColor(75)).toBe("#f5c842");
  });

  it("should return green color when under 75%", () => {
    expect(getBudgetStatusColor(74)).toBe("#4ade80");
  });
});

describe("getBudgetStatusLabel", () => {
  it("should return 'Over budget' at 100%+", () => {
    expect(getBudgetStatusLabel(100)).toBe("Over budget");
  });

  it("should return 'Almost full' at 90-99%", () => {
    expect(getBudgetStatusLabel(95)).toBe("Almost full");
  });

  it("should return 'Moderate' at 75-89%", () => {
    expect(getBudgetStatusLabel(80)).toBe("Moderate");
  });

  it("should return 'On track' below 75%", () => {
    expect(getBudgetStatusLabel(50)).toBe("On track");
  });
});

describe("truncate", () => {
  it("should return the string unchanged when within maxLength", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });

  it("should truncate and append ellipsis when string exceeds maxLength", () => {
    const result = truncate("hello world", 8);
    expect(result).toBe("hello…");
    expect(result.length).toBeLessThanOrEqual(8);
  });
});

describe("DEFAULT_CATEGORIES", () => {
  it("should contain exactly 10 default categories", () => {
    expect(Object.keys(DEFAULT_CATEGORIES)).toHaveLength(10);
  });

  it("should have icon, color, and label for every category", () => {
    for (const [, meta] of Object.entries(DEFAULT_CATEGORIES)) {
      expect(meta.icon).toBeTruthy();
      expect(meta.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(meta.label).toBeTruthy();
    }
  });
});
