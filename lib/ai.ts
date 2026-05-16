import OpenAI from "openai";
import prisma from "@/lib/db";
import type { ChatHistoryItem } from "@/lib/validations";

// ── OpenAI client ─────────────────────────────────────────────────────────────

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }
  return new OpenAI({ apiKey });
}

// ── User finance context ──────────────────────────────────────────────────────

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

export interface UserFinanceContext {
  currency: string;
  currentMonth: string;
  recentTransactions: RecentTransaction[];
  monthlyTotals: MonthlyTotals;
  topExpenseCategories: TopCategory[];
  activeBudgets: BudgetSummary[];
  savingsGoals: SavingsGoalSummary[];
  activeBills: BillSummary[];
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

  const [user, recentTx, monthTx, budgets, goals, bills] = await Promise.all([
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
  ]);

  // Aggregate current-month income/expense and per-category spend
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

// ── System prompt builder ─────────────────────────────────────────────────────

function buildSystemPrompt(ctx: UserFinanceContext): string {
  const lines: string[] = [
    `You are Fino, a helpful and concise personal finance assistant embedded in the Finosuke app.`,
    `Today is ${new Date().toISOString().slice(0, 10)}. The user's currency is ${ctx.currency}.`,
    ``,
    `## Financial Snapshot — ${ctx.currentMonth}`,
    `Income:    ${ctx.monthlyTotals.income} ${ctx.currency}`,
    `Expenses:  ${ctx.monthlyTotals.expense} ${ctx.currency}`,
    `Net saved: ${ctx.monthlyTotals.netSavings} ${ctx.currency}`,
  ];

  if (ctx.topExpenseCategories.length > 0) {
    const cats = ctx.topExpenseCategories
      .map((c) => `${c.category} (${c.total})`)
      .join(", ");
    lines.push(`Top expense categories: ${cats}`);
  }

  if (ctx.recentTransactions.length > 0) {
    lines.push(``, `## Recent Transactions`);
    for (const tx of ctx.recentTransactions) {
      const cat = tx.category ? ` | ${tx.category}` : "";
      const note = tx.notes ? ` | "${tx.notes}"` : "";
      lines.push(`- ${tx.date} | ${tx.type} | ${tx.amount} ${ctx.currency}${cat}${note}`);
    }
  }

  if (ctx.activeBudgets.length > 0) {
    lines.push(``, `## Active Budgets`);
    for (const b of ctx.activeBudgets) {
      lines.push(`- ${b.name}: ${b.amount} ${ctx.currency} (${b.period}, ${b.month})`);
    }
  }

  if (ctx.savingsGoals.length > 0) {
    lines.push(``, `## Savings Goals`);
    for (const g of ctx.savingsGoals) {
      lines.push(
        `- ${g.name}: ${g.currentAmount}/${g.targetAmount} ${ctx.currency} (${g.progress}%)`
      );
    }
  }

  if (ctx.activeBills.length > 0) {
    lines.push(``, `## Recurring Bills`);
    for (const b of ctx.activeBills) {
      lines.push(`- ${b.name}: ${b.amount} ${ctx.currency} (${b.frequency}, due day ${b.dueDay})`);
    }
  }

  lines.push(
    ``,
    `## Instructions`,
    `Answer finance questions using the data above. Be concise (under 200 words).`,
    ``,
    `ONLY propose a write action when the user explicitly requests to create or update something.`,
    `NEVER execute a write without the user's explicit confirmation payload.`,
    ``,
    `Always respond with valid JSON in exactly one of these shapes:`,
    ``,
    `Plain answer:`,
    `{ "type": "answer", "content": "<your response>" }`,
    ``,
    `Proposing a write action:`,
    `{ "type": "action", "summary": "<one sentence: what will be done>", "proposedAction": { "type": "<action_type>", "args": { ... } } }`,
    ``,
    `Allowed action types: create_transaction | create_budget | update_budget | create_savings_goal | create_bill.`,
    `Never include multiple actions in one response. Always validate amounts are positive numbers.`
  );

  return lines.join("\n");
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
 * Calls OpenAI with a compact user-context system prompt and bounded output tokens.
 *
 * Returns either a plain answer or a structured action proposal. The caller is
 * responsible for validating any proposedAction args with Zod before writing to DB.
 */
export async function callAI(
  userId: string,
  message: string,
  history: ChatHistoryItem[]
): Promise<AIResponse> {
  const client = getOpenAIClient();
  const context = await buildUserContext(userId);
  const systemPrompt = buildSystemPrompt(context);
  const trimmedHistory = truncateHistory(history, 6);

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...trimmedHistory.map((h) => ({
      role: h.role as "user" | "assistant",
      content: h.content,
    })),
    { role: "user", content: message },
  ];

  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  const completion = await client.chat.completions.create({
    model,
    messages,
    response_format: { type: "json_object" },
    max_tokens: 800,
    temperature: 0.3,
  });

  const raw = completion.choices[0]?.message?.content ?? "";

  return parseAIResponse(raw);
}

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
      if (typeof proposal.type === "string" && typeof proposal.args === "object") {
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

    // Last resort: stringify whatever we got
    return { type: "answer", content: raw };
  } catch {
    return { type: "answer", content: raw };
  }
}
