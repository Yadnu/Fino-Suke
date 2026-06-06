import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { syncPlaidItem } from "@/lib/plaid-sync";

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "Cron not configured" }, { status: 500 });
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await prisma.plaidItem.findMany({
    select: { id: true, userId: true, accessToken: true, cursor: true },
  });

  const results = await Promise.allSettled(items.map((item) => syncPlaidItem(item)));

  let synced = 0;
  let skipped = 0;
  let removed = 0;
  const errors: { itemId: string; error: string }[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "fulfilled") {
      synced += result.value.synced;
      skipped += result.value.skipped;
      removed += result.value.removed;
    } else {
      errors.push({ itemId: items[i].id, error: String(result.reason) });
      console.error("[cron/plaid-sync] item failed:", items[i].id, result.reason);
    }
  }

  return NextResponse.json({
    ok: true,
    itemsProcessed: items.length,
    synced,
    skipped,
    removed,
    errors,
  });
}
