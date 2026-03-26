import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";
import { redis } from "@/lib/redis";
import { rateLimit } from "@/lib/rateLimit";

const settingsSchema = z.object({
  name: z.string().min(1, "Name is required").max(80).optional(),
  currency: z.string().length(3, "Currency must be a 3-letter code").optional(),
  locale: z.string().min(2).max(10).optional(),
  timezone: z.string().min(2).max(64).optional(),
});

export async function GET() {
  try {
    const { userId, user } = await getAuthenticatedUser();

    const { allowed } = await rateLimit(userId, 60, 60);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    return NextResponse.json({
      name: user.name,
      email: user.email,
      currency: user.currency,
      locale: user.locale,
      timezone: user.timezone,
      avatar: user.avatar,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthenticated") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[settings GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { userId } = await getAuthenticatedUser();

    const { allowed } = await rateLimit(userId, 60, 60);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await req.json();
    const parsed = settingsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: parsed.data,
    });

    try {
      await redis.del(`user:${userId}`);
    } catch {
      // silent fail
    }

    return NextResponse.json({
      name: updated.name,
      email: updated.email,
      currency: updated.currency,
      locale: updated.locale,
      timezone: updated.timezone,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthenticated") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[settings PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
