export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid";
import { getAuthenticatedUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import prisma from "@/lib/db";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await getAuthenticatedUser();

    const { allowed } = await rateLimit(userId, 20, 60);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { id } = await params;

    const item = await prisma.plaidItem.findUnique({
      where: { id },
    });

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    if (item.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
      await plaidClient.itemRemove({ access_token: item.accessToken });
    } catch (plaidErr) {
      console.warn("[plaid/items DELETE] itemRemove failed (continuing):", plaidErr);
    }

    await prisma.plaidItem.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthenticated") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[plaid/items/[id] DELETE]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
