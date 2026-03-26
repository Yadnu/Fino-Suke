import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";
import { getMonthKey } from "@/lib/utils";
import { redis } from "@/lib/redis";
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

    const cacheKey = `analytics:${userId}:${month}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return NextResponse.json(cached);
      }
    } catch {
      // fall through to DB
    }

    const [year, mon] = month.split("-").map(Number);
    const currentStart = new Date(year, mon - 1, 1);
    const currentEnd = new Date(year, mon, 0, 23, 59, 59);
    const prevStart = new Date(year, mon - 2, 1);
    const prevEnd = new Date(year, mon - 1, 0, 23, 59, 59);

    const [currentIncome, currentExpenses, prevIncome, prevExpenses] =
      await Promise.all([
        prisma.transaction.aggregate({
          where: {
            userId,
            type: "income",
            date: { gte: currentStart, lte: currentEnd },
          },
          _sum: { amount: true },
        }),
        prisma.transaction.aggregate({
          where: {
            userId,
            type: "expense",
            date: { gte: currentStart, lte: currentEnd },
          },
          _sum: { amount: true },
        }),
        prisma.transaction.aggregate({
          where: {
            userId,
            type: "income",
            date: { gte: prevStart, lte: prevEnd },
          },
          _sum: { amount: true },
        }),
        prisma.transaction.aggregate({
          where: {
            userId,
            type: "expense",
            date: { gte: prevStart, lte: prevEnd },
          },
          _sum: { amount: true },
        }),
      ]);

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

    const result = {
      month,
      totalIncome,
      totalExpenses,
      netSavings: totalIncome - totalExpenses,
      savingsRate:
        totalIncome > 0
          ? ((totalIncome - totalExpenses) / totalIncome) * 100
          : 0,
      incomeTrend:
        prevTotalIncome > 0
          ? ((totalIncome - prevTotalIncome) / prevTotalIncome) * 100
          : 0,
      expensesTrend:
        prevTotalExpenses > 0
          ? ((totalExpenses - prevTotalExpenses) / prevTotalExpenses) * 100
          : 0,
      categoryBreakdown: breakdown,
      recentTransactions,
    };

    try {
      await redis.set(cacheKey, result, { ex: 300 });
    } catch {
      // silent fail
    }

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthenticated") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[analytics/summary GET]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
