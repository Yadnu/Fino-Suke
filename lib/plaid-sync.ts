import { plaidClient } from "@/lib/plaid";
import prisma from "@/lib/db";

// Maps Plaid personal_finance_category.primary to keywords matched against user category names
const PLAID_CATEGORY_KEYWORDS: Record<string, string[]> = {
  FOOD_AND_DRINK: ["food", "dining", "restaurant", "grocery", "groceries", "drink", "cafe", "coffee"],
  TRANSPORTATION: ["transport", "car", "gas", "fuel", "commute", "transit", "uber", "lyft", "taxi", "parking"],
  TRAVEL: ["travel", "flight", "hotel", "vacation", "trip", "airline", "airbnb", "lodging"],
  GENERAL_MERCHANDISE: ["shopping", "merchandise", "retail", "clothing", "apparel", "amazon", "target", "walmart"],
  ENTERTAINMENT: ["entertainment", "fun", "leisure", "movie", "game", "sport", "concert", "ticket", "streaming"],
  PERSONAL_CARE: ["personal", "care", "beauty", "salon", "grooming", "spa", "haircut"],
  MEDICAL: ["medical", "health", "doctor", "pharmacy", "healthcare", "dental", "vision", "hospital"],
  HOME_IMPROVEMENT: ["home", "improvement", "hardware", "furniture", "decor", "garden", "renovation"],
  LOAN_PAYMENTS: ["loan", "debt", "mortgage", "credit"],
  RENT_AND_UTILITIES: ["utilities", "rent", "electric", "water", "internet", "phone", "cable", "bill", "energy", "gas"],
  INCOME: ["income", "salary", "wage", "payroll", "paycheck"],
  TRANSFER_IN: ["transfer"],
  TRANSFER_OUT: ["transfer"],
  GENERAL_SERVICES: ["services", "subscription", "insurance", "membership"],
  GOVERNMENT_AND_NON_PROFIT: ["government", "tax", "charity", "donation"],
  BANK_FEES: ["bank", "fee", "charge", "atm"],
};

type UserCategory = { id: string; name: string };

function findCategoryId(
  plaidPrimary: string | null | undefined,
  userCategories: UserCategory[]
): string | null {
  if (!plaidPrimary) return null;
  const keywords = PLAID_CATEGORY_KEYWORDS[plaidPrimary] ?? [];
  if (keywords.length === 0) return null;

  for (const cat of userCategories) {
    const lower = cat.name.toLowerCase();
    if (keywords.some((kw) => lower.includes(kw))) {
      return cat.id;
    }
  }
  return null;
}

export interface SyncResult {
  itemId: string;
  synced: number;
  skipped: number;
  removed: number;
}

export async function syncPlaidItem(item: {
  id: string;
  userId: string;
  accessToken: string;
  cursor: string | null;
}): Promise<SyncResult> {
  let cursor = item.cursor ?? undefined;
  let synced = 0;
  let skipped = 0;
  let removed = 0;

  const userCategories = await prisma.category.findMany({
    where: { userId: item.userId },
    select: { id: true, name: true },
  });

  let hasMore = true;

  while (hasMore) {
    const response = await plaidClient.transactionsSync({
      access_token: item.accessToken,
      cursor,
    });

    const { added, modified, removed: removedTx, has_more, next_cursor } = response.data;

    for (const tx of [...added, ...modified]) {
      if (tx.pending) {
        skipped++;
        continue;
      }

      const amount = Math.abs(tx.amount);
      const type = tx.amount > 0 ? "expense" : "income";
      const categoryId = findCategoryId(
        tx.personal_finance_category?.primary ?? null,
        userCategories
      );
      const date = new Date(tx.date);

      try {
        await prisma.transaction.upsert({
          where: { plaidTransactionId: tx.transaction_id },
          update: { amount, type, categoryId, date, notes: tx.name },
          create: {
            userId: item.userId,
            plaidTransactionId: tx.transaction_id,
            amount,
            type,
            categoryId,
            date,
            notes: tx.name,
            currency: tx.iso_currency_code ?? "USD",
          },
        });
        synced++;
      } catch {
        skipped++;
      }
    }

    for (const tx of removedTx) {
      if (!tx.transaction_id) continue;
      try {
        await prisma.transaction.deleteMany({
          where: { plaidTransactionId: tx.transaction_id, userId: item.userId },
        });
        removed++;
      } catch {
        // non-fatal; transaction may have already been deleted
      }
    }

    cursor = next_cursor;
    hasMore = has_more;
  }

  await prisma.plaidItem.update({
    where: { id: item.id },
    data: { cursor, lastSyncedAt: new Date() },
  });

  return { itemId: item.id, synced, skipped, removed };
}
