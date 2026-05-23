import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { getNetWorthSummary } from "@/lib/networth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { userId } = await getAuthenticatedUser();

    const { allowed } = await rateLimit(userId, 60, 60);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const summary = await getNetWorthSummary(userId);
    return NextResponse.json(summary);
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthenticated") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[networth summary GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
