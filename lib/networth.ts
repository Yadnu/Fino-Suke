import prisma from "@/lib/db";
import { getMonthKey } from "@/lib/utils";

export interface NetWorthTotals {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
}

export interface NetWorthAccount {
  id: string;
  userId: string;
  name: string;
  type: string;
  category: string;
  value: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NetWorthHistoryItem {
  month: string;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
}

export function sumAccounts(accounts: Pick<NetWorthAccount, "type" | "value">[]): NetWorthTotals {
  const totalAssets = accounts
    .filter((a) => a.type === "asset")
    .reduce((s, a) => s + a.value, 0);
  const totalLiabilities = accounts
    .filter((a) => a.type === "liability")
    .reduce((s, a) => s + a.value, 0);
  return {
    totalAssets: round2(totalAssets),
    totalLiabilities: round2(totalLiabilities),
    netWorth: round2(totalAssets - totalLiabilities),
  };
}

/**
 * Recompute the current month's snapshot from live accounts and upsert it.
 * Called after every account create / update / delete so the snapshot stays fresh.
 */
export async function upsertCurrentMonthSnapshot(userId: string): Promise<void> {
  const accounts = await prisma.netWorthAccount.findMany({
    where: { userId },
    select: { type: true, value: true },
  });

  const { totalAssets, totalLiabilities, netWorth } = sumAccounts(accounts);
  const month = getMonthKey();

  await prisma.netWorthSnapshot.upsert({
    where: { userId_month: { userId, month } },
    create: { userId, month, totalAssets, totalLiabilities, netWorth },
    update: { totalAssets, totalLiabilities, netWorth },
  });
}

/**
 * Returns current account list + last 12 monthly snapshots ordered ascending.
 */
export async function getNetWorthSummary(userId: string) {
  const [accounts, history] = await Promise.all([
    prisma.netWorthAccount.findMany({
      where: { userId },
      orderBy: [{ type: "asc" }, { value: "desc" }],
    }),
    prisma.netWorthSnapshot.findMany({
      where: { userId },
      orderBy: { month: "asc" },
      take: 12,
      select: { month: true, totalAssets: true, totalLiabilities: true, netWorth: true },
    }),
  ]);

  const totals = sumAccounts(accounts);
  return { totals, accounts, history };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
