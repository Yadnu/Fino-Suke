import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";
import { transactionSchema } from "@/lib/validations";

async function getOwned(id: string, userId: string) {
  return prisma.transaction.findFirst({ where: { id, userId } });
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await getAuthenticatedUser();
    const existing = await getOwned(params.id, userId);
    if (!existing)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await req.json();
    const parsed = transactionSchema.partial().safeParse({
      ...body,
      amount: body.amount !== undefined ? Number(body.amount) : undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const updated = await prisma.transaction.update({
      where: { id: params.id },
      data: {
        ...(parsed.data.amount !== undefined && { amount: parsed.data.amount }),
        ...(parsed.data.type && { type: parsed.data.type }),
        ...(parsed.data.categoryId !== undefined && {
          categoryId: parsed.data.categoryId,
        }),
        ...(parsed.data.date && { date: new Date(parsed.data.date) }),
        ...(parsed.data.notes !== undefined && { notes: parsed.data.notes }),
        ...(parsed.data.tags && { tags: parsed.data.tags }),
        ...(parsed.data.isRecurring !== undefined && {
          isRecurring: parsed.data.isRecurring,
        }),
      },
      include: { category: true },
    });

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthenticated") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[transactions PATCH]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await getAuthenticatedUser();
    const existing = await getOwned(params.id, userId);
    if (!existing)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.transaction.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthenticated") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[transactions DELETE]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
