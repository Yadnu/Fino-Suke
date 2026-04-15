import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";

const subscribeBodySchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export async function POST(req: Request) {
  try {
    const { userId } = await getAuthenticatedUser();

    const { allowed } = await rateLimit(userId, 30, 60);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const json = await req.json();
    const parsed = subscribeBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid body" },
        { status: 400 }
      );
    }

    const { endpoint, keys } = parsed.data;

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        userId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
      update: {
        userId,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthenticated") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[push subscribe POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

const deleteBodySchema = z.object({
  endpoint: z.string().url().optional(),
});

export async function DELETE(req: Request) {
  try {
    const { userId } = await getAuthenticatedUser();

    const { allowed } = await rateLimit(userId, 30, 60);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    let endpoint: string | undefined;
    try {
      const json = await req.json();
      const parsed = deleteBodySchema.safeParse(json);
      if (parsed.success && parsed.data.endpoint) {
        endpoint = parsed.data.endpoint;
      }
    } catch {
      // no body — delete all for user
    }

    if (endpoint) {
      await prisma.pushSubscription.deleteMany({
        where: { userId, endpoint },
      });
    } else {
      await prisma.pushSubscription.deleteMany({ where: { userId } });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthenticated") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[push subscribe DELETE]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
