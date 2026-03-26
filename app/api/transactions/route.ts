import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/db";
import { transactionSchema, transactionQuerySchema } from "@/lib/validations";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = (session.user as { id: string }).id;
    const { searchParams } = new URL(req.url);

    const query = transactionQuerySchema.safeParse({
      type: searchParams.get("type") ?? undefined,
      categoryId: searchParams.get("categoryId") ?? undefined,
      startDate: searchParams.get("startDate") ?? undefined,
      endDate: searchParams.get("endDate") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      page: searchParams.get("page") ?? 1,
      limit: searchParams.get("limit") ?? 20,
    });

    if (!query.success) {
      return NextResponse.json(
        { error: query.error.issues[0].message },
        { status: 400 }
      );
    }

    const { type, categoryId, startDate, endDate, search, page, limit } =
      query.data;
    const skip = (page - 1) * limit;

    const where = {
      userId,
      ...(type && { type }),
      ...(categoryId && { categoryId }),
      ...(startDate || endDate
        ? {
            date: {
              ...(startDate && { gte: new Date(startDate) }),
              ...(endDate && { lte: new Date(endDate) }),
            },
          }
        : {}),
      ...(search && { notes: { contains: search, mode: "insensitive" as const } }),
    };

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: { category: true },
        orderBy: { date: "desc" },
        skip,
        take: limit,
      }),
      prisma.transaction.count({ where }),
    ]);

    return NextResponse.json({ transactions, total, page, limit });
  } catch (err) {
    console.error("[transactions GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = (session.user as { id: string }).id;
    const body = await req.json();

    const parsed = transactionSchema.safeParse({
      ...body,
      amount: Number(body.amount),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const transaction = await prisma.transaction.create({
      data: {
        userId,
        amount: parsed.data.amount,
        type: parsed.data.type,
        categoryId: parsed.data.categoryId ?? null,
        date: new Date(parsed.data.date),
        notes: parsed.data.notes ?? null,
        tags: parsed.data.tags,
        isRecurring: parsed.data.isRecurring,
      },
      include: { category: true },
    });

    return NextResponse.json(transaction, { status: 201 });
  } catch (err) {
    console.error("[transactions POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
