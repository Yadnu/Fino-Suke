import OpenAI from "openai";
import prisma from "@/lib/db";
import { sumAccounts } from "@/lib/networth";
import type { ChatHistoryItem } from "@/lib/validations";

// ── OpenAI client ─────────────────────────────────────────────────────────────

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }
  return new OpenAI({ apiKey });
}

// ── User finance context (kept for /api/ai/insights) ─────────────────────────

interface MonthlyTotals {
  income: number;
  expense: number;
  netSavings: number;
}

interface TopCategory {
  category: string;
  total: number;
}

interface RecentTransaction {
  amount: number;
  type: string;
  category: string | null;
  date: string;
  notes: string | null;
}

interface BudgetSummary {
  name: string;
  amount: number;
  period: string;
  month: string;
}

interface SavingsGoalSummary {
  name: string;
  targetAmount: number;
  currentAmount: number;
  progress: number;
}

interface BillSummary {
  name: string;
  amount: number;
  frequency: string;
  dueDay: number;
}

interface NetWorthSummary {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  topAssets: { name: string; category: string; value: number }[];
  topLiabilities: { name: string; category: string; value: number }[];
}

export interface UserFinanceContext {
  currency: string;
  currentMonth: string;
  recentTransactions: RecentTransaction[];
  monthlyTotals: MonthlyTotals;
  topExpenseCategories: TopCategory[];
  activeBudgets: BudgetSummary[];
  savingsGoals: SavingsGoalSummary[];
  activeBills: BillSummary[];
  netWorth: NetWorthSummary | null;
}

/**
 * Builds a compact, token-efficient snapshot of the user's financial data.
 * Limits rows at the DB level to keep context size predictable.
 */
export async function buildUserContext(userId: string): Promise<UserFinanceContext> {
  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7);
  const monthStart = new Date(`${currentMonth}-01T00:00:00.000Z`);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const [user, recentTx, monthTx, budgets, goals, bills, nwAccounts] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { currency: true },
    }),
    prisma.transaction.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: 15,
      select: {
        amount: true,
        type: true,
        date: true,
        notes: true,
        category: { select: { name: true } },
      },
    }),
    prisma.transaction.findMany({
      where: { userId, date: { gte: monthStart, lte: monthEnd } },
      select: {
        amount: true,
        type: true,
        category: { select: { name: true } },
      },
    }),
    prisma.budget.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { name: true, amount: true, period: true, month: true },
    }),
    prisma.savingsGoal.findMany({
      where: { userId, isCompleted: false },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { name: true, targetAmount: true, currentAmount: true },
    }),
    prisma.bill.findMany({
      where: { userId, isActive: true },
      orderBy: { dueDay: "asc" },
      take: 10,
      select: { name: true, amount: true, frequency: true, dueDay: true },
    }),
    prisma.netWorthAccount.findMany({
      where: { userId },
      orderBy: { value: "desc" },
      select: { name: true, type: true, category: true, value: true },
    }),
  ]);

  let income = 0;
  let expense = 0;
  const categoryExpenses: Record<string, number> = {};

  for (const tx of monthTx) {
    if (tx.type === "income") {
      income += tx.amount;
    } else {
      expense += tx.amount;
      const cat = tx.category?.name ?? "Uncategorized";
      categoryExpenses[cat] = (categoryExpenses[cat] ?? 0) + tx.amount;
    }
  }

  const topExpenseCategories = Object.entries(categoryExpenses)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([category, total]) => ({ category, total: round2(total) }));

  return {
    currency: user?.currency ?? "USD",
    currentMonth,
    recentTransactions: recentTx.map((tx) => ({
      amount: tx.amount,
      type: tx.type,
      category: tx.category?.name ?? null,
      date: tx.date.toISOString().slice(0, 10),
      notes: tx.notes,
    })),
    monthlyTotals: {
      income: round2(income),
      expense: round2(expense),
      netSavings: round2(income - expense),
    },
    topExpenseCategories,
    activeBudgets: budgets,
    savingsGoals: goals.map((g) => ({
      name: g.name,
      targetAmount: g.targetAmount,
      currentAmount: g.currentAmount,
      progress: g.targetAmount > 0 ? Math.round((g.currentAmount / g.targetAmount) * 100) : 0,
    })),
    activeBills: bills,
    netWorth: nwAccounts.length > 0
      ? {
          ...sumAccounts(nwAccounts),
          topAssets: nwAccounts
            .filter((a) => a.type === "asset")
            .slice(0, 5)
            .map(({ name, category, value }) => ({ name, category, value })),
          topLiabilities: nwAccounts
            .filter((a) => a.type === "liability")
            .slice(0, 5)
            .map(({ name, category, value }) => ({ name, category, value })),
        }
      : null,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── History truncation ────────────────────────────────────────────────────────

/**
 * Keeps only the last `maxTurns` user/assistant pairs to stay within the
 * token budget. Each turn = 1 user message + 1 assistant message.
 */
export function truncateHistory(history: ChatHistoryItem[], maxTurns = 6): ChatHistoryItem[] {
  const maxItems = maxTurns * 2;
  if (history.length <= maxItems) return history;
  return history.slice(-maxItems);
}

// ── Tool definitions ──────────────────────────────────────────────────────────

const QUERY_TOOLS: OpenAI.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_spending_breakdown",
      description:
        "Get the user's spending (expenses) broken down by category for a given month. Use this to answer questions about spending patterns, top categories, or category comparisons.",
      parameters: {
        type: "object",
        properties: {
          month: {
            type: "string",
            description: "Month in YYYY-MM format. Omit to use the current month.",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_budget_status",
      description:
        "Get the user's active budgets with actual spending vs the budget limit. Use this to answer questions about budget utilization, overspending, or remaining budget.",
      parameters: {
        type: "object",
        properties: {
          month: {
            type: "string",
            description: "Month in YYYY-MM format for monthly budgets. Omit to use current month.",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_savings_progress",
      description:
        "Get all active savings goals with current progress, remaining amounts, and completion percentages.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_recent_transactions",
      description:
        "Get recent transactions with optional filters. Use this to answer questions about specific transactions, spending history, or income history.",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Maximum number of transactions to return (default 10, max 30).",
          },
          type: {
            type: "string",
            enum: ["expense", "income"],
            description: "Filter by transaction type.",
          },
          category: {
            type: "string",
            description: "Filter by category name (case-insensitive partial match).",
          },
        },
        required: [],
      },
    },
  },
];

const WRITE_TOOLS: OpenAI.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "create_transaction",
      description:
        "Propose creating a new income or expense transaction. Only call this when the user explicitly asks to add/log/record a transaction.",
      parameters: {
        type: "object",
        properties: {
          summary: {
            type: "string",
            description: "One-sentence description of what will be created (shown to user for confirmation).",
          },
          amount: { type: "number", description: "Positive amount." },
          type: { type: "string", enum: ["expense", "income"] },
          categoryId: { type: "string", description: "Category ID (optional)." },
          date: { type: "string", description: "Date in YYYY-MM-DD format." },
          notes: { type: "string", description: "Optional notes." },
          tags: { type: "array", items: { type: "string" }, description: "Optional tags." },
          isRecurring: { type: "boolean", description: "Whether this is a recurring transaction." },
        },
        required: ["summary", "amount", "type", "date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_budget",
      description:
        "Propose creating a new budget. Only call this when the user explicitly asks to create or set up a budget.",
      parameters: {
        type: "object",
        properties: {
          summary: {
            type: "string",
            description: "One-sentence description of what will be created (shown to user for confirmation).",
          },
          name: { type: "string", description: "Budget name." },
          categoryId: { type: "string", description: "Category ID (optional)." },
          amount: { type: "number", description: "Budget limit amount." },
          period: { type: "string", enum: ["weekly", "monthly"], description: "Budget period." },
          month: { type: "string", description: "Month in YYYY-MM format." },
          rollover: { type: "boolean", description: "Whether unused budget rolls over." },
        },
        required: ["summary", "name", "amount", "period", "month"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_budget",
      description:
        "Propose updating an existing budget. Only call this when the user explicitly asks to update or change a budget.",
      parameters: {
        type: "object",
        properties: {
          summary: {
            type: "string",
            description: "One-sentence description of what will be updated (shown to user for confirmation).",
          },
          id: { type: "string", description: "Budget ID to update." },
          name: { type: "string", description: "New name (optional)." },
          amount: { type: "number", description: "New amount (optional)." },
          period: { type: "string", enum: ["weekly", "monthly"], description: "New period (optional)." },
          rollover: { type: "boolean", description: "New rollover setting (optional)." },
        },
        required: ["summary", "id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_savings_goal",
      description:
        "Propose creating a new savings goal. Only call this when the user explicitly asks to create or set up a savings goal.",
      parameters: {
        type: "object",
        properties: {
          summary: {
            type: "string",
            description: "One-sentence description of what will be created (shown to user for confirmation).",
          },
          name: { type: "string", description: "Goal name." },
          description: { type: "string", description: "Optional description." },
          targetAmount: { type: "number", description: "Target savings amount." },
          currentAmount: { type: "number", description: "Starting amount already saved (default 0)." },
          targetDate: { type: "string", description: "Target date in YYYY-MM-DD format (optional)." },
          icon: { type: "string", description: "Emoji icon (default 🎯)." },
          color: { type: "string", description: "Hex color like #f5c842." },
        },
        required: ["summary", "name", "targetAmount"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_bill",
      description:
        "Propose adding a new recurring bill. Only call this when the user explicitly asks to add or track a bill.",
      parameters: {
        type: "object",
        properties: {
          summary: {
            type: "string",
            description: "One-sentence description of what will be created (shown to user for confirmation).",
          },
          name: { type: "string", description: "Bill name." },
          amount: { type: "number", description: "Bill amount." },
          frequency: {
            type: "string",
            enum: ["monthly", "weekly", "yearly", "once"],
            description: "How often the bill recurs.",
          },
          dueDay: {
            type: "number",
            description: "Day of month (1–31) the bill is due, or day of week (0–6) for weekly.",
          },
          categoryId: { type: "string", description: "Category ID (optional)." },
          notes: { type: "string", description: "Optional notes." },
        },
        required: ["summary", "name", "amount", "frequency", "dueDay"],
      },
    },
  },
];

const QUERY_TOOL_NAMES = new Set(QUERY_TOOLS.map((t) => t.function.name));
const WRITE_TOOL_NAMES = new Set(WRITE_TOOLS.map((t) => t.function.name));

// ── Query tool executor ───────────────────────────────────────────────────────

async function executeQueryTool(
  userId: string,
  name: string,
  args: Record<string, unknown>,
  currency: string
): Promise<string> {
  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7);

  if (name === "get_spending_breakdown") {
    const month = typeof args.month === "string" ? args.month : currentMonth;
    const monthStart = new Date(`${month}-01T00:00:00.000Z`);
    const [y, m] = month.split("-").map(Number);
    const monthEnd = new Date(y, m, 0, 23, 59, 59, 999);

    const transactions = await prisma.transaction.findMany({
      where: { userId, type: "expense", date: { gte: monthStart, lte: monthEnd } },
      select: { amount: true, category: { select: { name: true } } },
    });

    const byCategory: Record<string, number> = {};
    let total = 0;
    for (const tx of transactions) {
      const cat = tx.category?.name ?? "Uncategorized";
      byCategory[cat] = (byCategory[cat] ?? 0) + tx.amount;
      total += tx.amount;
    }

    const breakdown = Object.entries(byCategory)
      .sort(([, a], [, b]) => b - a)
      .map(([category, amount]) => ({
        category,
        amount: round2(amount),
        percentage: total > 0 ? Math.round((amount / total) * 100) : 0,
      }));

    return JSON.stringify({ month, currency, totalExpenses: round2(total), breakdown });
  }

  if (name === "get_budget_status") {
    const month = typeof args.month === "string" ? args.month : currentMonth;
    const monthStart = new Date(`${month}-01T00:00:00.000Z`);
    const [y, m] = month.split("-").map(Number);
    const monthEnd = new Date(y, m, 0, 23, 59, 59, 999);

    const budgets = await prisma.budget.findMany({
      where: { userId },
      include: { category: { select: { id: true, name: true } } },
    });

    const results = await Promise.all(
      budgets.map(async (budget) => {
        const periodStart = budget.period === "monthly" ? monthStart : new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
        const periodEnd = budget.period === "monthly" ? monthEnd : now;

        const spent = await prisma.transaction.aggregate({
          where: {
            userId,
            type: "expense",
            date: { gte: periodStart, lte: periodEnd },
            ...(budget.categoryId ? { categoryId: budget.categoryId } : {}),
          },
          _sum: { amount: true },
        });

        const spentAmount = round2(spent._sum.amount ?? 0);
        const remaining = round2(budget.amount - spentAmount);
        const percentage = budget.amount > 0 ? Math.round((spentAmount / budget.amount) * 100) : 0;

        return {
          id: budget.id,
          name: budget.name,
          category: budget.category?.name ?? null,
          budgetAmount: round2(budget.amount),
          spentAmount,
          remaining,
          percentage,
          period: budget.period,
          month: budget.month,
          isOverBudget: spentAmount > budget.amount,
        };
      })
    );

    return JSON.stringify({ month, currency, budgets: results });
  }

  if (name === "get_savings_progress") {
    const goals = await prisma.savingsGoal.findMany({
      where: { userId, isCompleted: false },
      orderBy: { createdAt: "desc" },
    });

    const result = goals.map((g) => ({
      id: g.id,
      name: g.name,
      targetAmount: round2(g.targetAmount),
      currentAmount: round2(g.currentAmount),
      remaining: round2(g.targetAmount - g.currentAmount),
      progress: g.targetAmount > 0 ? Math.round((g.currentAmount / g.targetAmount) * 100) : 0,
      targetDate: g.targetDate ? g.targetDate.toISOString().slice(0, 10) : null,
    }));

    return JSON.stringify({ currency, goals: result });
  }

  if (name === "get_recent_transactions") {
    const limit = Math.min(typeof args.limit === "number" ? args.limit : 10, 30);
    const typeFilter = typeof args.type === "string" ? args.type : undefined;
    const categoryFilter = typeof args.category === "string" ? args.category : undefined;

    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        ...(typeFilter ? { type: typeFilter as "expense" | "income" } : {}),
        ...(categoryFilter
          ? { category: { name: { contains: categoryFilter, mode: "insensitive" } } }
          : {}),
      },
      orderBy: { date: "desc" },
      take: limit,
      select: {
        id: true,
        amount: true,
        type: true,
        date: true,
        notes: true,
        tags: true,
        category: { select: { name: true } },
      },
    });

    const result = transactions.map((tx) => ({
      id: tx.id,
      amount: round2(tx.amount),
      type: tx.type,
      category: tx.category?.name ?? null,
      date: tx.date.toISOString().slice(0, 10),
      notes: tx.notes,
      tags: tx.tags,
    }));

    return JSON.stringify({ currency, transactions: result });
  }

  return JSON.stringify({ error: `Unknown query tool: ${name}` });
}

// ── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(currency: string): string {
  return [
    `You are Fino, a helpful and concise personal finance assistant embedded in the Finosuke app.`,
    `Today is ${new Date().toISOString().slice(0, 10)}. The user's currency is ${currency}.`,
    ``,
    `Use the provided query tools to fetch the user's financial data before answering questions about their spending, budgets, savings, or transactions. Always fetch relevant data first — do not guess.`,
    ``,
    `ONLY propose a write action (create_transaction, create_budget, etc.) when the user explicitly asks to create or update something. Never propose a write without the user's clear intent.`,
    `Be concise (under 200 words) in your text responses.`,
  ].join("\n");
}

// ── Response types ────────────────────────────────────────────────────────────

export interface AIAnswer {
  type: "answer";
  content: string;
}

export interface AIActionProposal {
  type: "action";
  summary: string;
  proposedAction: {
    type: string;
    args: Record<string, unknown>;
  };
}

export type AIResponse = AIAnswer | AIActionProposal;

// ── Main AI call ──────────────────────────────────────────────────────────────

/**
 * Calls OpenAI with tool-calling enabled.
 *
 * Query tools (get_spending_breakdown, get_budget_status, get_savings_progress,
 * get_recent_transactions) are executed server-side automatically and results are
 * fed back to the model (up to 3 iterations).
 *
 * Write tools (create_transaction, create_budget, update_budget,
 * create_savings_goal, create_bill) are returned as AIActionProposal to the
 * client for user confirmation before any DB write occurs.
 */
export async function callAI(
  userId: string,
  message: string,
  history: ChatHistoryItem[]
): Promise<AIResponse> {
  const client = getOpenAIClient();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { currency: true },
  });
  const currency = user?.currency ?? "USD";

  const trimmedHistory = truncateHistory(history, 6);
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: buildSystemPrompt(currency) },
    ...trimmedHistory.map((h) => ({
      role: h.role as "user" | "assistant",
      content: h.content,
    })),
    { role: "user", content: message },
  ];

  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const allTools = [...QUERY_TOOLS, ...WRITE_TOOLS];

  for (let iteration = 0; iteration < 3; iteration++) {
    const completion = await client.chat.completions.create({
      model,
      messages,
      tools: allTools,
      tool_choice: "auto",
      max_tokens: 1000,
      temperature: 0.3,
    });

    const choice = completion.choices[0];
    const assistantMsg = choice.message;

    // Model returned a plain-text answer (no tool calls)
    if (!assistantMsg.tool_calls?.length || choice.finish_reason === "stop") {
      return { type: "answer", content: assistantMsg.content ?? "" };
    }

    // Check if any call is a write tool — return proposal immediately
    const writeCall = assistantMsg.tool_calls.find((tc) =>
      WRITE_TOOL_NAMES.has(tc.function.name)
    );
    if (writeCall) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(writeCall.function.arguments || "{}") as Record<string, unknown>;
      } catch {
        // malformed args — fall through to answer
      }
      const summary =
        typeof args.summary === "string" ? args.summary : `Proposed: ${writeCall.function.name}`;
      // Strip the meta summary field from the actual action args
      const { summary: _summary, ...actionArgs } = args;
      return {
        type: "action",
        summary,
        proposedAction: { type: writeCall.function.name, args: actionArgs },
      };
    }

    // All calls are query tools — execute them and feed results back
    messages.push(assistantMsg);

    for (const tc of assistantMsg.tool_calls) {
      if (!QUERY_TOOL_NAMES.has(tc.function.name)) continue;
      let toolArgs: Record<string, unknown> = {};
      try {
        toolArgs = JSON.parse(tc.function.arguments || "{}") as Record<string, unknown>;
      } catch {
        // empty args is fine
      }
      const result = await executeQueryTool(userId, tc.function.name, toolArgs, currency);
      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: result,
      });
    }
  }

  // Exhausted query-tool iterations — ask for a plain answer without tools
  const finalCompletion = await client.chat.completions.create({
    model,
    messages,
    max_tokens: 800,
    temperature: 0.3,
  });

  return {
    type: "answer",
    content: finalCompletion.choices[0]?.message?.content ?? "",
  };
}

// ── Legacy JSON-mode parser (kept for unit tests) ─────────────────────────────

/**
 * Parses the raw JSON string returned by the model into a typed AIResponse.
 * Falls back to a plain answer if the JSON is malformed or unexpected.
 */
export function parseAIResponse(raw: string): AIResponse {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    if (
      parsed.type === "action" &&
      typeof parsed.summary === "string" &&
      parsed.proposedAction !== null &&
      typeof parsed.proposedAction === "object"
    ) {
      const proposal = parsed.proposedAction as Record<string, unknown>;
      if (typeof proposal.type === "string" && proposal.args !== null && typeof proposal.args === "object") {
        return {
          type: "action",
          summary: parsed.summary,
          proposedAction: {
            type: proposal.type,
            args: (proposal.args ?? {}) as Record<string, unknown>,
          },
        };
      }
    }

    if (typeof parsed.content === "string") {
      return { type: "answer", content: parsed.content };
    }

    return { type: "answer", content: raw };
  } catch {
    return { type: "answer", content: raw };
  }
}
