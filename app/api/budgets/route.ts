import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";
import { budgetSchema } from "@/lib/validations";
import { getMonthKey } from "@/lib/utils";
import { rateLimit } from "@/lib/rateLimit";

export async function GET(req: Request) {
  try {
    const { userId } = await getAuthenticatedUser();

    const { allowed } = await rateLimit(userId, 60, 60);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month") ?? getMonthKey();

    const budgets = await prisma.budget.findMany({
      where: { userId, month },
      include: { category: true },
      orderBy: { createdAt: "asc" },
    });

    const [startDate, endDate] = getMonthDateRange(month);
    const spentByCategory = await prisma.transaction.groupBy({
      by: ["categoryId"],
      where: {
        userId,
        type: "expense",
        date: { gte: startDate, lte: endDate },
        categoryId: { not: null },
      },
      _sum: { amount: true },
    });

    const spentMap = Object.fromEntries(
      spentByCategory.map((r) => [r.categoryId, r._sum.amount ?? 0])
    );

    const budgetsWithSpent = budgets.map((b) => ({
      ...b,
      spent: b.categoryId ? (spentMap[b.categoryId] ?? 0) : 0,
    }));

    return NextResponse.json({ budgets: budgetsWithSpent, month });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthenticated") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[budgets GET]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await getAuthenticatedUser();

    const { allowed } = await rateLimit(userId, 60, 60);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await req.json();

    const parsed = budgetSchema.safeParse({
      ...body,
      amount: Number(body.amount),
      month: body.month ?? getMonthKey(),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const budget = await prisma.budget.create({
      data: {
        userId,
        name: parsed.data.name,
        categoryId: parsed.data.categoryId ?? null,
        amount: parsed.data.amount,
        period: parsed.data.period,
        month: parsed.data.month,
        rollover: parsed.data.rollover,
      },
      include: { category: true },
    });

    return NextResponse.json(budget, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthenticated") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[budgets POST]", err);
    if ((err as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { error: "A budget for this category already exists this month" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function getMonthDateRange(month: string): [Date, Date] {
  const [year, mon] = month.split("-").map(Number);
  const start = new Date(year, mon - 1, 1);
  const end = new Date(year, mon, 0, 23, 59, 59);
  return [start, end];
}
