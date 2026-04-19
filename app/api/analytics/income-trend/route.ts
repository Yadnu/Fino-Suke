import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";

export async function GET() {
  try {
    const { userId } = await getAuthenticatedUser();

    // Build the last 6 month ranges (current month + 5 previous)
    const now = new Date();
    const months: Array<{ key: string; label: string; start: Date; end: Date }> = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleString("default", { month: "short", year: "2-digit" });
      months.push({ key, label, start, end });
    }

    // Fetch income + expense aggregates for all 6 months in parallel
    const results = await Promise.all(
      months.map(async ({ start, end }) => {
        const [income, expenses] = await Promise.all([
          prisma.transaction.aggregate({
            where: { userId, type: "income", date: { gte: start, lte: end } },
            _sum: { amount: true },
          }),
          prisma.transaction.aggregate({
            where: { userId, type: "expense", date: { gte: start, lte: end } },
            _sum: { amount: true },
          }),
        ]);
        return {
          income: income._sum.amount ?? 0,
          expenses: expenses._sum.amount ?? 0,
        };
      })
    );

    // Fetch top income categories for the current month
    const currentMonth = months[months.length - 1];
    const categoryBreakdown = await prisma.transaction.groupBy({
      by: ["categoryId"],
      where: {
        userId,
        type: "income",
        date: { gte: currentMonth.start, lte: currentMonth.end },
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
      take: 5,
    });

    const categoryIds = categoryBreakdown
      .map((c) => c.categoryId)
      .filter(Boolean) as string[];

    const categories =
      categoryIds.length > 0
        ? await prisma.category.findMany({ where: { id: { in: categoryIds } } })
        : [];

    const catMap = Object.fromEntries(categories.map((c) => [c.id, c]));

    const topSources = categoryBreakdown.map((c) => ({
      categoryId: c.categoryId,
      category: c.categoryId ? catMap[c.categoryId] ?? null : null,
      amount: c._sum.amount ?? 0,
    }));

    // Compute averages
    const nonZeroMonths = results.filter((r) => r.income > 0);
    const avgIncome =
      nonZeroMonths.length > 0
        ? nonZeroMonths.reduce((s, r) => s + r.income, 0) / nonZeroMonths.length
        : 0;

    const trend = months.map(({ key, label }, i) => ({
      key,
      label,
      income: results[i].income,
      expenses: results[i].expenses,
    }));

    return NextResponse.json({
      trend,
      currentMonth: {
        key: currentMonth.key,
        totalIncome: results[results.length - 1].income,
        totalExpenses: results[results.length - 1].expenses,
      },
      avgIncome,
      topSources,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthenticated") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[income-trend GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
