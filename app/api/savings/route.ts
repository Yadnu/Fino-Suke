import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";
import { savingsGoalSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rateLimit";

export async function GET() {
  try {
    const { userId } = await getAuthenticatedUser();

    const { allowed } = await rateLimit(userId, 60, 60);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const goals = await prisma.savingsGoal.findMany({
      where: { userId },
      orderBy: [{ isCompleted: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ goals });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthenticated") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[savings GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await getAuthenticatedUser();

    const { allowed } = await rateLimit(userId, 60, 60);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await req.json();

    const parsed = savingsGoalSchema.safeParse({
      ...body,
      targetAmount: Number(body.targetAmount),
      currentAmount: body.currentAmount !== undefined ? Number(body.currentAmount) : 0,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const goal = await prisma.savingsGoal.create({
      data: {
        userId,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        targetAmount: parsed.data.targetAmount,
        currentAmount: parsed.data.currentAmount,
        targetDate: parsed.data.targetDate ? new Date(parsed.data.targetDate) : null,
        icon: parsed.data.icon,
        color: parsed.data.color,
        isCompleted: parsed.data.isCompleted,
      },
    });

    return NextResponse.json(goal, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthenticated") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[savings POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
