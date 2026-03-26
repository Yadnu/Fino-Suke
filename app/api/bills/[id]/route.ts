import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";
import { billSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rateLimit";

async function getOwnedBill(id: string, userId: string) {
  return prisma.bill.findFirst({ where: { id, userId } });
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

    const existing = await getOwnedBill(params.id, userId);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();

    const parsed = billSchema.partial().safeParse({
      ...body,
      amount: body.amount !== undefined ? Number(body.amount) : undefined,
      dueDay: body.dueDay !== undefined ? Number(body.dueDay) : undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const updated = await prisma.bill.update({
      where: { id: params.id },
      data: {
        ...(parsed.data.name !== undefined && { name: parsed.data.name }),
        ...(parsed.data.amount !== undefined && { amount: parsed.data.amount }),
        ...(parsed.data.frequency !== undefined && {
          frequency: parsed.data.frequency,
        }),
        ...(parsed.data.dueDay !== undefined && { dueDay: parsed.data.dueDay }),
        ...(parsed.data.categoryId !== undefined && {
          categoryId: parsed.data.categoryId ?? null,
        }),
        ...(parsed.data.notes !== undefined && {
          notes: parsed.data.notes ?? null,
        }),
        ...(parsed.data.isActive !== undefined && {
          isActive: parsed.data.isActive,
        }),
      },
      include: { category: true },
    });

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthenticated") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[bills PATCH]", err);
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

    const existing = await getOwnedBill(params.id, userId);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.bill.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthenticated") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[bills DELETE]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
