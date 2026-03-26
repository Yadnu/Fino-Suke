import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";
import { savingsGoalSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rateLimit";

async function getOwned(id: string, userId: string) {
  return prisma.savingsGoal.findFirst({ where: { id, userId } });
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await getAuthenticatedUser();

    const { allowed } = await rateLimit(userId, 60, 60);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const existing = await getOwned(params.id, userId);
    if (!existing)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await req.json();
    const parsed = savingsGoalSchema.partial().safeParse({
      ...body,
      targetAmount:
        body.targetAmount !== undefined ? Number(body.targetAmount) : undefined,
      currentAmount:
        body.currentAmount !== undefined ? Number(body.currentAmount) : undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const updated = await prisma.savingsGoal.update({
      where: { id: params.id },
      data: {
        ...(parsed.data.name !== undefined && { name: parsed.data.name }),
        ...(parsed.data.description !== undefined && {
          description: parsed.data.description,
        }),
        ...(parsed.data.targetAmount !== undefined && {
          targetAmount: parsed.data.targetAmount,
        }),
        ...(parsed.data.currentAmount !== undefined && {
          currentAmount: parsed.data.currentAmount,
        }),
        ...(parsed.data.targetDate !== undefined && {
          targetDate: parsed.data.targetDate
            ? new Date(parsed.data.targetDate)
            : null,
        }),
        ...(parsed.data.icon !== undefined && { icon: parsed.data.icon }),
        ...(parsed.data.color !== undefined && { color: parsed.data.color }),
        ...(parsed.data.isCompleted !== undefined && {
          isCompleted: parsed.data.isCompleted,
        }),
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthenticated") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[savings PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await getAuthenticatedUser();

    const { allowed } = await rateLimit(userId, 60, 60);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const existing = await getOwned(params.id, userId);
    if (!existing)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.savingsGoal.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthenticated") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[savings DELETE]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
