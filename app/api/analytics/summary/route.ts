import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/db";
import { getMonthKey } from "@/lib/utils";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = (session.user as { id: string }).id;
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month") ?? getMonthKey();

    const [year, mon] = month.split("-").map(Number);
    const currentStart = new Date(year, mon - 1, 1);
    const currentEnd = new Date(year, mon, 0, 23, 59, 59);
    const prevStart = new Date(year, mon - 2, 1);
    const prevEnd = new Date(year, mon - 1, 0, 23, 59, 59);

    // Current month totals
    const [currentIncome, currentExpenses, prevIncome, prevExpenses] =
      await Promise.all([
        prisma.transaction.aggregate({
          where: { userId, type: "income", date: { gte: currentStart, lte: currentEnd } },
          _sum: { amount: true },
        }),
        prisma.transaction.aggregate({
          where: { userId, type: "expense", date: { gte: currentStart, lte: currentEnd } },
          _sum: { amount: true },
        }),
        prisma.transaction.aggregate({
          where: { userId, type: "income", date: { gte: prevStart, lte: prevEnd } },
          _sum: { amount: true },
        }),
        prisma.transaction.aggregate({
          where: { userId, type: "expense", date: { gte: prevStart, lte: prevEnd } },
          _sum: { amount: true },
        }),
      ]);

    // Category breakdown for expenses
    const categoryBreakdown = await prisma.transaction.groupBy({
      by: ["categoryId"],
      where: {
        userId,
        type: "expense",
        date: { gte: currentStart, lte: currentEnd },
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
    });

    // Enrich with category data
    const categoryIds = categoryBreakdown
      .map((c) => c.categoryId)
      .filter(Boolean) as string[];

    const categories = await prisma.category.findMany({
      where: { id: { in: categoryIds } },
    });

    const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c]));

    const breakdown = categoryBreakdown.map((c) => ({
      categoryId: c.categoryId,
      category: c.categoryId ? categoryMap[c.categoryId] : null,
      amount: c._sum.amount ?? 0,
    }));

    // Recent transactions
    const recentTransactions = await prisma.transaction.findMany({
      where: { userId },
      include: { category: true },
      orderBy: { date: "desc" },
      take: 5,
    });

    const totalIncome = currentIncome._sum.amount ?? 0;
    const totalExpenses = currentExpenses._sum.amount ?? 0;
    const prevTotalIncome = prevIncome._sum.amount ?? 0;
    const prevTotalExpenses = prevExpenses._sum.amount ?? 0;

    const incomeTrend =
      prevTotalIncome > 0
        ? ((totalIncome - prevTotalIncome) / prevTotalIncome) * 100
        : 0;
    const expensesTrend =
      prevTotalExpenses > 0
        ? ((totalExpenses - prevTotalExpenses) / prevTotalExpenses) * 100
        : 0;

    return NextResponse.json({
      month,
      totalIncome,
      totalExpenses,
      netSavings: totalIncome - totalExpenses,
      savingsRate: totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0,
      incomeTrend,
      expensesTrend,
      categoryBreakdown: breakdown,
      recentTransactions,
    });
  } catch (err) {
    console.error("[analytics/summary GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
