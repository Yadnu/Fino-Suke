import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { chatRequestBaseSchema, confirmedActionSchema } from "@/lib/validations";
import { callAI } from "@/lib/ai";
import { redis } from "@/lib/redis";

// ── Helpers ──────────────────────────────────────────────────────────────────

function computeNextDueDate(frequency: string, dueDay: number): Date {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (frequency === "monthly" || frequency === "once") {
    const safeDay = Math.min(dueDay, 28);
    const candidate = new Date(today.getFullYear(), today.getMonth(), safeDay);
    if (candidate <= today) candidate.setMonth(candidate.getMonth() + 1);
    return candidate;
  }

  if (frequency === "weekly") {
    const jsTargetDay = dueDay % 7;
    const currentDay = today.getDay();
    let daysUntil = (jsTargetDay - currentDay + 7) % 7;
    if (daysUntil === 0) daysUntil = 7;
    const next = new Date(today);
    next.setDate(today.getDate() + daysUntil);
    return next;
  }

  if (frequency === "yearly") {
    const safeDay = Math.min(dueDay, 28);
    const candidate = new Date(today.getFullYear(), today.getMonth(), safeDay);
    if (candidate <= today) candidate.setFullYear(candidate.getFullYear() + 1);
    return candidate;
  }

  return today;
}

// ── Action executor ───────────────────────────────────────────────────────────

async function executeAction(
  userId: string,
  rawAction: unknown
): Promise<{ success: boolean; summary: string; data?: unknown }> {
  const parsed = confirmedActionSchema.safeParse(rawAction);
  if (!parsed.success) {
    return { success: false, summary: `Invalid action: ${parsed.error.issues[0].message}` };
  }

  const action = parsed.data;

  switch (action.type) {
    case "create_transaction": {
      const tx = await prisma.transaction.create({
        data: {
          userId,
          amount: action.args.amount,
          type: action.args.type,
          categoryId: action.args.categoryId ?? null,
          date: new Date(action.args.date),
          notes: action.args.notes ?? null,
          tags: action.args.tags ?? [],
          isRecurring: action.args.isRecurring ?? false,
        },
        include: { category: true },
      });
      // Invalidate analytics cache
      const monthKey = tx.date.toISOString().slice(0, 7);
      try { await redis.del(`analytics:${userId}:${monthKey}`); } catch { /* silent */ }
      return {
        success: true,
        summary: `Transaction of ${action.args.amount} (${action.args.type}) created successfully.`,
        data: tx,
      };
    }

    case "create_budget": {
      const budget = await prisma.budget.create({
        data: {
          userId,
          name: action.args.name,
          categoryId: action.args.categoryId ?? null,
          amount: action.args.amount,
          period: action.args.period ?? "monthly",
          month: action.args.month,
          rollover: action.args.rollover ?? false,
        },
      });
      return {
        success: true,
        summary: `Budget "${action.args.name}" for ${action.args.amount} created.`,
        data: budget,
      };
    }

    case "update_budget": {
      const existing = await prisma.budget.findFirst({
        where: { id: action.args.id, userId },
      });
      if (!existing) {
        return { success: false, summary: "Budget not found or does not belong to you." };
      }
      const updated = await prisma.budget.update({
        where: { id: action.args.id },
        data: {
          ...(action.args.name !== undefined && { name: action.args.name }),
          ...(action.args.amount !== undefined && { amount: action.args.amount }),
          ...(action.args.period !== undefined && { period: action.args.period }),
          ...(action.args.rollover !== undefined && { rollover: action.args.rollover }),
        },
      });
      return {
        success: true,
        summary: `Budget "${updated.name}" updated successfully.`,
        data: updated,
      };
    }

    case "create_savings_goal": {
      const goal = await prisma.savingsGoal.create({
        data: {
          userId,
          name: action.args.name,
          description: action.args.description ?? null,
          targetAmount: action.args.targetAmount,
          currentAmount: action.args.currentAmount ?? 0,
          targetDate: action.args.targetDate ? new Date(action.args.targetDate) : null,
          icon: action.args.icon ?? "🎯",
          color: action.args.color ?? "#f5c842",
        },
      });
      return {
        success: true,
        summary: `Savings goal "${action.args.name}" for ${action.args.targetAmount} created.`,
        data: goal,
      };
    }

    case "create_bill": {
      const nextDueDate = computeNextDueDate(
        action.args.frequency ?? "monthly",
        action.args.dueDay
      );
      const bill = await prisma.bill.create({
        data: {
          userId,
          name: action.args.name,
          amount: action.args.amount,
          frequency: action.args.frequency ?? "monthly",
          dueDay: action.args.dueDay,
          nextDueDate,
          categoryId: action.args.categoryId ?? null,
          notes: action.args.notes ?? null,
          isActive: true,
        },
        include: { category: true },
      });
      return {
        success: true,
        summary: `Bill "${action.args.name}" for ${action.args.amount} added.`,
        data: bill,
      };
    }
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const { userId } = await getAuthenticatedUser();

    // Stricter rate limit for AI (20 req / 60 s per user — costs money)
    const { allowed } = await rateLimit(userId, 20, 60);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await req.json();

    // Step 1: validate message + history (400 on invalid input)
    const parsed = chatRequestBaseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { message, history } = parsed.data;

    // Step 2: if a confirmedAction is present, validate and execute it (422 on invalid action)
    if (parsed.data.confirmedAction !== undefined) {
      const actionParsed = confirmedActionSchema.safeParse(parsed.data.confirmedAction);
      if (!actionParsed.success) {
        return NextResponse.json(
          { error: actionParsed.error.issues[0].message },
          { status: 422 }
        );
      }
      const result = await executeAction(userId, actionParsed.data);
      if (!result.success) {
        return NextResponse.json({ error: result.summary }, { status: 422 });
      }
      return NextResponse.json({
        type: "action_result",
        summary: result.summary,
        data: result.data ?? null,
      });
    }

    // Otherwise call the AI
    const aiResponse = await callAI(userId, message, history);
    return NextResponse.json(aiResponse);
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthenticated") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof Error && err.message === "OPENAI_API_KEY environment variable is not set") {
      return NextResponse.json(
        { error: "AI service is not configured. Please add OPENAI_API_KEY." },
        { status: 503 }
      );
    }
    console.error("[ai/chat POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
