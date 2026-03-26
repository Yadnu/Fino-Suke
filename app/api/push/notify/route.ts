import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { getWebPush } from "@/lib/webPush";
import type { PushSubscription } from "web-push";

const notifyBodySchema = z.object({
  title: z.string().min(1).max(120),
  body: z.string().max(500).default(""),
  url: z.string().max(2048).optional(),
  tag: z.string().max(64).optional(),
});

export async function POST(req: Request) {
  try {
    const { userId } = await getAuthenticatedUser();

    const { allowed } = await rateLimit(userId, 20, 60);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const wp = getWebPush();
    if (!wp) {
      return NextResponse.json(
        { error: "Push is not configured on the server" },
        { status: 503 }
      );
    }

    const json = await req.json();
    const parsed = notifyBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid body" },
        { status: 400 }
      );
    }

    const subs = await prisma.pushSubscription.findMany({
      where: { userId },
    });

    if (subs.length === 0) {
      return NextResponse.json({ sent: 0, skipped: "no_subscriptions" });
    }

    const payload = JSON.stringify({
      title: parsed.data.title,
      body: parsed.data.body,
      url: parsed.data.url ?? "/dashboard",
      tag: parsed.data.tag,
    });

    let sent = 0;
    const staleIds: string[] = [];

    for (const row of subs) {
      const subscription = {
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth },
      } as PushSubscription;

      try {
        await wp.sendNotification(subscription, payload, {
          TTL: 60 * 60,
        });
        sent += 1;
      } catch (e: unknown) {
        const status = (e as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          staleIds.push(row.id);
        } else {
          console.error("[push notify] send failed", e);
        }
      }
    }

    if (staleIds.length > 0) {
      await prisma.pushSubscription.deleteMany({
        where: { id: { in: staleIds } },
      });
    }

    return NextResponse.json({ sent, removed: staleIds.length });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthenticated") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[push notify POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
