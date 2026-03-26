import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/db";
import { budgetSchema } from "@/lib/validations";
import { getMonthKey } from "@/lib/utils";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = (session.user as { id: string }).id;
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month") ?? getMonthKey();

    const budgets = await prisma.budget.findMany({
      where: { userId, month },
      include: { category: true },
      orderBy: { createdAt: "asc" },
    });

    // Calculate spent amount per budget
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
    console.error("[budgets GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = (session.user as { id: string }).id;
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
    console.error("[budgets POST]", err);
    if ((err as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { error: "A budget for this category already exists this month" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function getMonthDateRange(month: string): [Date, Date] {
  const [year, mon] = month.split("-").map(Number);
  const start = new Date(year, mon - 1, 1);
  const end = new Date(year, mon, 0, 23, 59, 59);
  return [start, end];
}
