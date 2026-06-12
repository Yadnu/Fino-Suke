export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import prisma from "@/lib/db";

export async function GET() {
  try {
    const { userId } = await getAuthenticatedUser();

    const { allowed } = await rateLimit(userId, 60, 60);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const items = await prisma.plaidItem.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        itemId: true,
        institutionId: true,
        institutionName: true,
        lastSyncedAt: true,
        createdAt: true,
        updatedAt: true,
        accounts: {
          select: {
            id: true,
            accountId: true,
            name: true,
            mask: true,
            type: true,
            subtype: true,
          },
          orderBy: { name: "asc" },
        },
      },
    });

    return NextResponse.json({ items });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthenticated") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[plaid/items GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
