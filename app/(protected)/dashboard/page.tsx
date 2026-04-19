import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getMonthKey, formatDate } from "@/lib/utils";
import { MonthlySnapshot } from "@/components/dashboard/MonthlySnapshot";
import { BudgetStatusGrid } from "@/components/dashboard/BudgetStatusGrid";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import {
  UpcomingBillsTeaser,
  type DashboardBill,
} from "@/components/dashboard/UpcomingBillsTeaser";
import { SavingsGoalsTeaser } from "@/components/dashboard/SavingsGoalsTeaser";
import { AiTipPlaceholder } from "@/components/dashboard/AiTipPlaceholder";
import { getOrCreateUser } from "@/lib/auth";
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
    upcomingBills,
    savingsGoalsPreview,
  ] = await Promise.all([
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
    prisma.bill.findMany({
      where: { userId, isActive: true },
      include: { category: true },
      orderBy: { nextDueDate: "asc" },
      take: 4,
    }),
    prisma.savingsGoal.findMany({
      where: { userId, isCompleted: false },
      orderBy: { updatedAt: "desc" },
      take: 3,
    }),
  ]);

  const totalIncome = incomeAgg._sum.amount ?? 0;
  const totalExpenses = expensesAgg._sum.amount ?? 0;
  const prevTotalIncome = prevIncomeAgg._sum.amount ?? 0;
  const prevTotalExpenses = prevExpensesAgg._sum.amount ?? 0;

  const categoryIds = budgets
    .map((b: { categoryId: string | null }) => b.categoryId)
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
    budgets: budgets.map((b: Record<string, unknown> & { categoryId: string | null }) => ({
      ...b,
      spent: b.categoryId ? (spentMap[b.categoryId] ?? 0) : 0,
    })),
    upcomingBills,
    savingsGoalsPreview,
  };
}

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/auth/login");

  // Ensure user record exists in DB
  const user = await getOrCreateUser(userId);
  const data = await getDashboardData(userId);

  const {
    upcomingBills,
    savingsGoalsPreview,
    recentTransactions,
    budgets,
    ...summary
  } = data;

  const serializedBills: DashboardBill[] = upcomingBills.map((b) => ({
    id: b.id,
    name: b.name,
    amount: b.amount,
    nextDueDate: b.nextDueDate.toISOString(),
    category: b.category
      ? {
          name: b.category.name,
          icon: b.category.icon,
          color: b.category.color,
        }
      : null,
  }));

  const serialized = {
    ...summary,
    recentTransactions: recentTransactions.map((tx) => ({
      ...tx,
      date: tx.date.toISOString(),
      createdAt: tx.createdAt.toISOString(),
      updatedAt: tx.updatedAt.toISOString(),
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    budgets: budgets.map((b: any) => ({
      ...b,
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
    })),
    savingsGoalsPreview: savingsGoalsPreview.map((g) => ({
      id: g.id,
      name: g.name,
      icon: g.icon,
      color: g.color,
      targetAmount: g.targetAmount,
      currentAmount: g.currentAmount,
      targetDate: g.targetDate ? g.targetDate.toISOString() : null,
    })),
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">
          Dashboard
        </h1>
        <p className="text-sm text-muted mt-1">
          {formatDate(new Date(), "MMMM yyyy")} overview
        </p>
      </div>

      <MonthlySnapshot
        totalIncome={serialized.totalIncome}
        totalExpenses={serialized.totalExpenses}
        netSavings={serialized.netSavings}
        savingsRate={serialized.savingsRate}
        incomeTrend={serialized.incomeTrend}
        expensesTrend={serialized.expensesTrend}
        currency={user.currency}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BudgetStatusGrid
          budgets={
            serialized.budgets as Parameters<typeof BudgetStatusGrid>[0]["budgets"]
          }
          currency={user.currency}
        />
        <SavingsGoalsTeaser
          goals={serialized.savingsGoalsPreview}
          currency={user.currency}
        />
      </div>

      <RecentTransactions
        transactions={
          serialized.recentTransactions as Parameters<
            typeof RecentTransactions
          >[0]["transactions"]
        }
        currency={user.currency}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UpcomingBillsTeaser bills={serializedBills} currency={user.currency} />
        <AiTipPlaceholder />
      </div>
    </div>
  );
}
