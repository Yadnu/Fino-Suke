import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getMonthKey, formatDate } from "@/lib/utils";
import { MonthlySnapshot } from "@/components/dashboard/MonthlySnapshot";
import { BudgetStatusGrid } from "@/components/dashboard/BudgetStatusGrid";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { UpcomingBillsTeaser } from "@/components/dashboard/UpcomingBillsTeaser";
import { AiTipPlaceholder } from "@/components/dashboard/AiTipPlaceholder";
import prisma from "@/lib/db";

async function getDashboardData(userId: string) {
  const month = getMonthKey();
  const [year, mon] = month.split("-").map(Number);
  const currentStart = new Date(year, mon - 1, 1);
  const currentEnd = new Date(year, mon, 0, 23, 59, 59);
  const prevStart = new Date(year, mon - 2, 1);
  const prevEnd = new Date(year, mon - 1, 0, 23, 59, 59);

  const [
    incomeAgg,
    expensesAgg,
    prevIncomeAgg,
    prevExpensesAgg,
    recentTransactions,
    budgets,
  ] = await Promise.all([
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
    prisma.transaction.findMany({
      where: { userId },
      include: { category: true },
      orderBy: { date: "desc" },
      take: 5,
    }),
    prisma.budget.findMany({
      where: { userId, month },
      include: { category: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const totalIncome = incomeAgg._sum.amount ?? 0;
  const totalExpenses = expensesAgg._sum.amount ?? 0;
  const prevTotalIncome = prevIncomeAgg._sum.amount ?? 0;
  const prevTotalExpenses = prevExpensesAgg._sum.amount ?? 0;

  // Compute spent per budget category
  const categoryIds = budgets
    .map((b) => b.categoryId)
    .filter(Boolean) as string[];

  const spentByCategory =
    categoryIds.length > 0
      ? await prisma.transaction.groupBy({
          by: ["categoryId"],
          where: {
            userId,
            type: "expense",
            date: { gte: currentStart, lte: currentEnd },
            categoryId: { in: categoryIds },
          },
          _sum: { amount: true },
        })
      : [];

  const spentMap = Object.fromEntries(
    spentByCategory.map((r) => [r.categoryId, r._sum.amount ?? 0])
  );

  const budgetsWithSpent = budgets.map((b) => ({
    ...b,
    spent: b.categoryId ? (spentMap[b.categoryId] ?? 0) : 0,
  }));

  return {
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
    recentTransactions,
    budgets: budgetsWithSpent,
  };
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const userId = (session!.user as { id: string }).id;
  const currency = (session!.user as { currency?: string }).currency ?? "USD";

  const data = await getDashboardData(userId);

  const serialized = {
    ...data,
    recentTransactions: data.recentTransactions.map((tx) => ({
      ...tx,
      date: tx.date.toISOString(),
      createdAt: tx.createdAt.toISOString(),
      updatedAt: tx.updatedAt.toISOString(),
    })),
    budgets: data.budgets.map((b) => ({
      ...b,
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
    })),
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Page header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">
          Dashboard
        </h1>
        <p className="text-sm text-muted mt-1">
          {formatDate(new Date(), "MMMM yyyy")} overview
        </p>
      </div>

      {/* Monthly Snapshot — full width */}
      <MonthlySnapshot
        totalIncome={serialized.totalIncome}
        totalExpenses={serialized.totalExpenses}
        netSavings={serialized.netSavings}
        savingsRate={serialized.savingsRate}
        incomeTrend={serialized.incomeTrend}
        expensesTrend={serialized.expensesTrend}
        currency={currency}
      />

      {/* Budget + Savings row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BudgetStatusGrid
          budgets={serialized.budgets as Parameters<typeof BudgetStatusGrid>[0]["budgets"]}
          currency={currency}
        />

        {/* Savings goals teaser */}
        <div className="bg-surface border border-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-base font-semibold text-foreground">
              Savings Goals
            </h3>
          </div>
          <div className="text-center py-6">
            <div className="text-4xl mb-3">🎯</div>
            <p className="text-sm text-muted">Savings goals coming in Phase 2</p>
            <a
              href="/savings"
              className="text-xs text-gold hover:text-gold-hover mt-2 inline-block transition-colors"
            >
              Plan your first goal →
            </a>
          </div>
        </div>
      </div>

      {/* Recent transactions — full width */}
      <RecentTransactions
        transactions={serialized.recentTransactions as Parameters<typeof RecentTransactions>[0]["transactions"]}
        currency={currency}
      />

      {/* Bills + AI tip */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UpcomingBillsTeaser />
        <AiTipPlaceholder />
      </div>
    </div>
  );
}
