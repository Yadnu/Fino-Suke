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

// ── NetWorthAccount ──────────────────────────────────────────────────
const ASSET_CATEGORIES = ["cash", "investment", "real_estate", "vehicle", "other_asset"] as const;
const LIABILITY_CATEGORIES = ["credit_card", "loan", "mortgage", "other_liability"] as const;

export type AssetCategory = (typeof ASSET_CATEGORIES)[number];
export type LiabilityCategory = (typeof LIABILITY_CATEGORIES)[number];
export type AccountCategory = AssetCategory | LiabilityCategory;

const netWorthAccountBaseSchema = z.object({
  name:     z.string().min(1, "Name is required").max(100, "Name too long"),
  type:     z.enum(["asset", "liability"]),
  category: z.enum([
    "cash", "investment", "real_estate", "vehicle", "other_asset",
    "credit_card", "loan", "mortgage", "other_liability",
  ]),
  value:    z.coerce.number().min(0, "Value must be 0 or greater").max(1_000_000_000, "Value seems too large"),
  notes:    z.string().max(500, "Notes too long").optional().nullable(),
});

export const netWorthAccountSchema = netWorthAccountBaseSchema.superRefine((data, ctx) => {
  if (data.type === "asset" && !(ASSET_CATEGORIES as readonly string[]).includes(data.category)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["category"],
      message: "Category does not match account type 'asset'",
    });
  }
  if (data.type === "liability" && !(LIABILITY_CATEGORIES as readonly string[]).includes(data.category)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["category"],
      message: "Category does not match account type 'liability'",
    });
  }
});

/** Partial schema for PATCH — no cross-field refinement needed (all fields optional). */
export const netWorthAccountPatchSchema = netWorthAccountBaseSchema.partial();

export type NetWorthAccountInput = z.infer<typeof netWorthAccountSchema>;

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

// ── AI Chat ───────────────────────────────────────────────────────────
export const chatHistoryItemSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

export type ChatHistoryItem = z.infer<typeof chatHistoryItemSchema>;

// ── AI Action schemas (whitelisted write intents) ─────────────────────
const createTransactionActionSchema = z.object({
  type: z.literal("create_transaction"),
  args: z.object({
    amount: z.number().positive().max(1_000_000),
    type: z.enum(["expense", "income"]),
    categoryId: z.string().optional().nullable(),
    date: z.string().min(1, "Date is required"),
    notes: z.string().max(500).optional().nullable(),
    tags: z.array(z.string()).default([]),
    isRecurring: z.boolean().default(false),
  }),
  summary: z.string().max(200),
});

const createBudgetActionSchema = z.object({
  type: z.literal("create_budget"),
  args: z.object({
    name: z.string().min(1).max(50),
    categoryId: z.string().optional().nullable(),
    amount: z.number().positive().max(1_000_000),
    period: z.enum(["weekly", "monthly"]).default("monthly"),
    month: z.string().regex(/^\d{4}-\d{2}$/, "Month must be in YYYY-MM format"),
    rollover: z.boolean().default(false),
  }),
  summary: z.string().max(200),
});

const updateBudgetActionSchema = z.object({
  type: z.literal("update_budget"),
  args: z.object({
    id: z.string().min(1),
    name: z.string().min(1).max(50).optional(),
    amount: z.number().positive().max(1_000_000).optional(),
    period: z.enum(["weekly", "monthly"]).optional(),
    rollover: z.boolean().optional(),
  }),
  summary: z.string().max(200),
});

const createSavingsGoalActionSchema = z.object({
  type: z.literal("create_savings_goal"),
  args: z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional().nullable(),
    targetAmount: z.number().positive().max(100_000_000),
    currentAmount: z.number().min(0).default(0),
    targetDate: z.string().optional().nullable(),
    icon: z.string().default("🎯"),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color")
      .default("#f5c842"),
  }),
  summary: z.string().max(200),
});

const createBillActionSchema = z.object({
  type: z.literal("create_bill"),
  args: z.object({
    name: z.string().min(1).max(100),
    amount: z.number().positive().max(1_000_000),
    frequency: z.enum(["monthly", "weekly", "yearly", "once"]).default("monthly"),
    dueDay: z.coerce.number().int().min(1).max(31),
    categoryId: z.string().optional().nullable(),
    notes: z.string().max(500).optional().nullable(),
  }),
  summary: z.string().max(200),
});

export const confirmedActionSchema = z.discriminatedUnion("type", [
  createTransactionActionSchema,
  createBudgetActionSchema,
  updateBudgetActionSchema,
  createSavingsGoalActionSchema,
  createBillActionSchema,
]);

export type ConfirmedAction = z.infer<typeof confirmedActionSchema>;
export type ActionType = ConfirmedAction["type"];

export const AI_ACTION_TYPES = [
  "create_transaction",
  "create_budget",
  "update_budget",
  "create_savings_goal",
  "create_bill",
] as const satisfies readonly ActionType[];

/** Base request — only validates message + history. Used for the initial parse so
 * an invalid confirmedAction type returns 422 instead of 400. */
export const chatRequestBaseSchema = z.object({
  message: z.string().min(1, "Message is required").max(2000, "Message too long"),
  history: z.array(chatHistoryItemSchema).max(20, "History too long").default([]),
  confirmedAction: z.unknown().optional(),
});

export const chatRequestSchema = z.object({
  message: z.string().min(1, "Message is required").max(2000, "Message too long"),
  history: z.array(chatHistoryItemSchema).max(20, "History too long").default([]),
  confirmedAction: confirmedActionSchema.optional(),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
