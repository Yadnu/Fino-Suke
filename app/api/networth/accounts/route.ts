import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";
import { netWorthAccountSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rateLimit";
import { upsertCurrentMonthSnapshot } from "@/lib/networth";

export async function GET() {
  try {
    const { userId } = await getAuthenticatedUser();

    const { allowed } = await rateLimit(userId, 60, 60);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const accounts = await prisma.netWorthAccount.findMany({
      where: { userId },
      orderBy: [{ type: "asc" }, { value: "desc" }],
    });

    return NextResponse.json({ accounts });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthenticated") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[networth accounts GET]", err);
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
    const parsed = netWorthAccountSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const account = await prisma.netWorthAccount.create({
      data: {
        userId,
        name: parsed.data.name,
        type: parsed.data.type,
        category: parsed.data.category,
        value: parsed.data.value,
        notes: parsed.data.notes ?? null,
      },
    });

    await upsertCurrentMonthSnapshot(userId);

    return NextResponse.json(account, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthenticated") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[networth accounts POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
