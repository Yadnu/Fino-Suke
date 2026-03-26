import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";

function advanceNextDueDate(nextDueDate: Date, frequency: string): Date {
  const next = new Date(nextDueDate);

  if (frequency === "monthly") {
    next.setMonth(next.getMonth() + 1);
  } else if (frequency === "weekly") {
    next.setDate(next.getDate() + 7);
  } else if (frequency === "yearly") {
    next.setFullYear(next.getFullYear() + 1);
  } else {
    // "once" — move far into the future to effectively deactivate recurrence
    next.setFullYear(next.getFullYear() + 100);
  }

  return next;
}

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await getAuthenticatedUser();

    const { allowed } = await rateLimit(userId, 60, 60);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const existing = await prisma.bill.findFirst({
      where: { id: params.id, userId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const nextDueDate = advanceNextDueDate(
      existing.nextDueDate,
      existing.frequency
    );

    const updated = await prisma.bill.update({
      where: { id: params.id },
      data: { nextDueDate },
      include: { category: true },
    });

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthenticated") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[bills mark-paid POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
