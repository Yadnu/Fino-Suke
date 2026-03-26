import { z } from "zod";

// ── Auth ─────────────────────────────────────────────────────────────
export const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});

export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

// ── Transaction ──────────────────────────────────────────────────────
export const transactionSchema = z.object({
  amount: z.coerce
    .number()
    .positive("Amount must be positive")
    .max(1_000_000, "Amount seems too large"),
  type: z.enum(["expense", "income"]),
  categoryId: z.string().optional().nullable(),
  date: z.string().min(1, "Date is required"),
  notes: z.string().max(500, "Notes too long").optional().nullable(),
  tags: z.array(z.string()).default([]),
  isRecurring: z.boolean().default(false),
});

export type TransactionInput = z.infer<typeof transactionSchema>;

// ── Budget ───────────────────────────────────────────────────────────
export const budgetSchema = z.object({
  name: z.string().min(1, "Name is required").max(50, "Name too long"),
  categoryId: z.string().optional().nullable(),
  amount: z.coerce
    .number()
    .positive("Amount must be positive")
    .max(1_000_000, "Amount seems too large"),
  period: z.enum(["weekly", "monthly"]).default("monthly"),
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Month must be in YYYY-MM format"),
  rollover: z.boolean().default(false),
});

export type BudgetInput = z.infer<typeof budgetSchema>;

// ── Category ─────────────────────────────────────────────────────────
export const categorySchema = z.object({
  name: z.string().min(1, "Name is required").max(30, "Name too long"),
  icon: z.string().default("circle"),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color")
    .default("#71717a"),
});

export type CategoryInput = z.infer<typeof categorySchema>;

// ── SavingsGoal ──────────────────────────────────────────────────────
export const savingsGoalSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  description: z.string().max(500, "Description too long").optional().nullable(),
  targetAmount: z.coerce
    .number()
    .positive("Target amount must be positive")
    .max(100_000_000, "Amount seems too large"),
  currentAmount: z.coerce.number().min(0).default(0),
  targetDate: z.string().optional().nullable(),
  icon: z.string().default("🎯"),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color")
    .default("#f5c842"),
  isCompleted: z.boolean().default(false),
});

export type SavingsGoalInput = z.infer<typeof savingsGoalSchema>;

export const depositSchema = z.object({
  amount: z.coerce
    .number()
    .positive("Deposit amount must be positive")
    .max(100_000_000, "Amount seems too large"),
});

export type DepositInput = z.infer<typeof depositSchema>;

// ── Bill ─────────────────────────────────────────────────────────────
export const billSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  amount: z.coerce
    .number()
    .positive("Amount must be positive")
    .max(1_000_000, "Amount seems too large"),
  frequency: z.enum(["monthly", "weekly", "yearly", "once"]).default("monthly"),
  dueDay: z.coerce.number().int().min(1, "Due day must be at least 1").max(31, "Due day must be 31 or less"),
  categoryId: z.string().optional().nullable(),
  notes: z.string().max(500, "Notes too long").optional().nullable(),
  isActive: z.boolean().default(true),
});

export type BillInput = z.infer<typeof billSchema>;

// ── Query params ─────────────────────────────────────────────────────
export const transactionQuerySchema = z.object({
  type: z.enum(["expense", "income"]).optional(),
  categoryId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type TransactionQuery = z.infer<typeof transactionQuerySchema>;
