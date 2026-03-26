import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";
import { depositSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await getAuthenticatedUser();

    const { allowed } = await rateLimit(userId, 60, 60);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const existing = await prisma.savingsGoal.findFirst({
      where: { id: params.id, userId },
    });
    if (!existing)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await req.json();
    const parsed = depositSchema.safeParse({ amount: Number(body.amount) });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const newAmount = existing.currentAmount + parsed.data.amount;
    const isCompleted = newAmount >= existing.targetAmount;

    const updated = await prisma.savingsGoal.update({
      where: { id: params.id },
      data: {
        currentAmount: newAmount,
        isCompleted,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthenticated") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[savings deposit POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
