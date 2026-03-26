import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";
import { billSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rateLimit";

function computeNextDueDate(frequency: string, dueDay: number): Date {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (frequency === "monthly" || frequency === "once") {
    const safeDay = Math.min(dueDay, 28);
    const candidate = new Date(today.getFullYear(), today.getMonth(), safeDay);
    if (candidate <= today) {
      candidate.setMonth(candidate.getMonth() + 1);
    }
    return candidate;
  }

  if (frequency === "weekly") {
    // dueDay 1–7 interpreted as Mon–Sun (JS: Mon=1, Tue=2, ..., Sun=0)
    const jsTargetDay = dueDay % 7; // 7 → 0 (Sun), 1 → 1 (Mon), ...
    const currentDay = today.getDay();
    let daysUntil = (jsTargetDay - currentDay + 7) % 7;
    if (daysUntil === 0) daysUntil = 7;
    const next = new Date(today);
    next.setDate(today.getDate() + daysUntil);
    return next;
  }

  if (frequency === "yearly") {
    const safeDay = Math.min(dueDay, 28);
    const candidate = new Date(
      today.getFullYear(),
      today.getMonth(),
      safeDay
    );
    if (candidate <= today) {
      candidate.setFullYear(candidate.getFullYear() + 1);
    }
    return candidate;
  }

  return today;
}

export async function GET() {
  try {
    const { userId } = await getAuthenticatedUser();

    const { allowed } = await rateLimit(userId, 60, 60);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const bills = await prisma.bill.findMany({
      where: { userId },
      include: { category: true },
      orderBy: { nextDueDate: "asc" },
    });

    return NextResponse.json({ bills });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthenticated") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[bills GET]", err);
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

    const parsed = billSchema.safeParse({
      ...body,
      amount: Number(body.amount),
      dueDay: Number(body.dueDay),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const nextDueDate = computeNextDueDate(
      parsed.data.frequency,
      parsed.data.dueDay
    );

    const bill = await prisma.bill.create({
      data: {
        userId,
        name: parsed.data.name,
        amount: parsed.data.amount,
        frequency: parsed.data.frequency,
        dueDay: parsed.data.dueDay,
        nextDueDate,
        categoryId: parsed.data.categoryId ?? null,
        notes: parsed.data.notes ?? null,
        isActive: parsed.data.isActive,
      },
      include: { category: true },
    });

    return NextResponse.json(bill, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthenticated") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[bills POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
