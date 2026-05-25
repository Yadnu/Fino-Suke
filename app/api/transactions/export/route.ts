import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";

function escapeCsv(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildRow(cells: (string | number | boolean | null | undefined)[]): string {
  return cells.map(escapeCsv).join(",");
}

export async function GET(req: Request) {
  try {
    const { userId } = await getAuthenticatedUser();

    const { allowed } = await rateLimit(userId, 10, 60);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") ?? undefined;
    const startDate = searchParams.get("startDate") ?? undefined;
    const endDate = searchParams.get("endDate") ?? undefined;

    const where = {
      userId,
      ...(type && { type }),
      ...(startDate || endDate
        ? {
            date: {
              ...(startDate && { gte: new Date(startDate) }),
              ...(endDate && { lte: new Date(endDate) }),
            },
          }
        : {}),
    };

    const transactions = await prisma.transaction.findMany({
      where,
      include: { category: true },
      orderBy: { date: "desc" },
    });

    const header = buildRow([
      "Date",
      "Type",
      "Category",
      "Amount",
      "Notes",
      "Tags",
      "Recurring",
    ]);

    const rows = transactions.map((tx) =>
      buildRow([
        new Date(tx.date).toISOString().slice(0, 10),
        tx.type,
        tx.category?.name ?? "",
        tx.amount,
        tx.notes ?? "",
        tx.tags.join(";"),
        tx.isRecurring ? "Yes" : "No",
      ])
    );

    const csv = [header, ...rows].join("\r\n");
    const filename = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthenticated") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[transactions/export GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
