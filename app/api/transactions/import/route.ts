import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { redis } from "@/lib/redis";
import { z } from "zod";

// ── CSV parser ────────────────────────────────────────────────────────

/** RFC 4180-compliant CSV parser. Returns rows as string arrays. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    const next = normalized[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(field);
        field = "";
      } else if (ch === "\n") {
        row.push(field);
        field = "";
        if (row.some((c) => c !== "")) rows.push(row);
        row = [];
      } else {
        field += ch;
      }
    }
  }

  // last field / row
  row.push(field);
  if (row.some((c) => c !== "")) rows.push(row);

  return rows;
}

// ── Column-map schema ─────────────────────────────────────────────────

const columnMapSchema = z.object({
  date: z.string().min(1),
  type: z.string().min(1),
  amount: z.string().min(1),
  category: z.string().optional(),
  notes: z.string().optional(),
  tags: z.string().optional(),
  isRecurring: z.string().optional(),
});

type ColumnMap = z.infer<typeof columnMapSchema>;

// ── Row validation ────────────────────────────────────────────────────

const rowSchema = z.object({
  amount: z.coerce
    .number()
    .positive("Amount must be positive")
    .max(1_000_000, "Amount too large"),
  type: z.enum(["expense", "income"], {
    message: 'Type must be "expense" or "income"',
  }),
  date: z.string().refine((v) => !isNaN(Date.parse(v)), "Invalid date"),
  notes: z.string().max(500).optional().nullable(),
  tags: z.array(z.string()).default([]),
  isRecurring: z.boolean().default(false),
});

interface RowError {
  row: number;
  message: string;
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: RowError[];
}

// ── Route handler ─────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const { userId } = await getAuthenticatedUser();

    const { allowed } = await rateLimit(userId, 5, 60);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const columnMapRaw = formData.get("columnMap");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No CSV file provided" }, { status: 400 });
    }
    if (!columnMapRaw || typeof columnMapRaw !== "string") {
      return NextResponse.json({ error: "Column map is required" }, { status: 400 });
    }

    let columnMap: ColumnMap;
    try {
      const parsed = columnMapSchema.safeParse(JSON.parse(columnMapRaw));
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0].message },
          { status: 400 }
        );
      }
      columnMap = parsed.data;
    } catch {
      return NextResponse.json({ error: "Invalid column map JSON" }, { status: 400 });
    }

    const text = await file.text();
    const rows = parseCsv(text);

    if (rows.length < 2) {
      return NextResponse.json(
        { error: "CSV must have a header row and at least one data row" },
        { status: 400 }
      );
    }

    if (rows.length > 1001) {
      return NextResponse.json(
        { error: "CSV may contain at most 1,000 data rows per import" },
        { status: 422 }
      );
    }

    const headers = rows[0].map((h) => h.trim());
    const dataRows = rows.slice(1);

    // Verify all required columns exist in the header
    const requiredFields: (keyof ColumnMap)[] = ["date", "type", "amount"];
    for (const field of requiredFields) {
      if (!headers.includes(columnMap[field]!)) {
        return NextResponse.json(
          { error: `Column "${columnMap[field]!}" not found in CSV` },
          { status: 400 }
        );
      }
    }

    const colIndex = (name: string) => headers.indexOf(name);

    // Resolve categories for the user (case-insensitive name lookup)
    const categories = await prisma.category.findMany({ where: { userId } });
    const catMap = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));

    // Ensure user row exists (FK safety)
    await prisma.user.findUniqueOrThrow({ where: { id: userId } });

    const result: ImportResult = { imported: 0, skipped: 0, errors: [] };
    const toCreate: Prisma.TransactionCreateManyInput[] = [];
    const affectedMonths = new Set<string>();

    for (let i = 0; i < dataRows.length; i++) {
      const cells = dataRows[i];
      const rowNumber = i + 2; // 1-indexed including header

      const get = (col: string | undefined) =>
        col ? (cells[colIndex(col)] ?? "").trim() : "";

      const rawType = get(columnMap.type).toLowerCase();
      const rawAmount = get(columnMap.amount).replace(/[^0-9.\-]/g, "");
      const rawDate = get(columnMap.date);
      const rawNotes = get(columnMap.notes);
      const rawTags = get(columnMap.tags);
      const rawRecurring = get(columnMap.isRecurring).toLowerCase();
      const rawCategory = get(columnMap.category);

      const parsed = rowSchema.safeParse({
        amount: rawAmount,
        type: rawType,
        date: rawDate,
        notes: rawNotes || null,
        tags: rawTags ? rawTags.split(";").map((t) => t.trim()).filter(Boolean) : [],
        isRecurring: ["yes", "true", "1"].includes(rawRecurring),
      });

      if (!parsed.success) {
        result.errors.push({
          row: rowNumber,
          message: parsed.error.issues[0].message,
        });
        result.skipped++;
        continue;
      }

      const categoryId = rawCategory
        ? (catMap.get(rawCategory.toLowerCase()) ?? null)
        : null;

      const date = new Date(parsed.data.date);
      const monthKey = date.toISOString().slice(0, 7);
      affectedMonths.add(monthKey);

      toCreate.push({
        userId,
        amount: parsed.data.amount,
        type: parsed.data.type,
        categoryId,
        date,
        notes: parsed.data.notes ?? null,
        tags: parsed.data.tags,
        isRecurring: parsed.data.isRecurring,
      });
    }

    if (toCreate.length > 0) {
      await prisma.transaction.createMany({ data: toCreate });
      result.imported = toCreate.length;

      // Bust analytics cache for affected months
      try {
        await Promise.all(
          Array.from(affectedMonths).map((m) => redis.del(`analytics:${userId}:${m}`))
        );
      } catch {
        // silent fail
      }
    }

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthenticated") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return NextResponse.json(
        { error: "Account not ready. Sign out and sign back in." },
        { status: 503 }
      );
    }
    console.error("[transactions/import POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
