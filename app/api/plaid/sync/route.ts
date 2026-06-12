export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import prisma from "@/lib/db";
import { syncPlaidItem } from "@/lib/plaid-sync";

export async function POST(req: Request) {
  try {
    const { userId } = await getAuthenticatedUser();

    const { allowed } = await rateLimit(userId, 10, 60);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    let itemId: string | undefined;
    try {
      const body = await req.json();
      if (body?.itemId && typeof body.itemId === "string") {
        itemId = body.itemId;
      }
    } catch {
      // body is optional — no-op
    }

    const where = itemId
      ? { id: itemId, userId }
      : { userId };

    const items = await prisma.plaidItem.findMany({
      where,
      select: { id: true, userId: true, accessToken: true, cursor: true },
    });

    if (itemId && items.length === 0) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const results = await Promise.allSettled(items.map((item) => syncPlaidItem(item)));

    let synced = 0;
    let skipped = 0;
    let removed = 0;
    const errors: string[] = [];

    for (const result of results) {
      if (result.status === "fulfilled") {
        synced += result.value.synced;
        skipped += result.value.skipped;
        removed += result.value.removed;
      } else {
        errors.push(String(result.reason));
      }
    }

    return NextResponse.json({ synced, skipped, removed, errors });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthenticated") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[plaid/sync POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
