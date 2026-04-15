import { auth, currentUser } from "@clerk/nextjs/server";
import type { User } from "@prisma/client";
import prisma from "@/lib/db";
import { DEFAULT_CATEGORIES } from "@/lib/utils";
import { redis } from "@/lib/redis";

/**
 * Get the current Clerk userId from the request context.
 * Throws if unauthenticated (use inside protected routes only).
 */
export async function requireAuth(): Promise<string> {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthenticated");
  }
  return userId;
}

/**
 * Get-or-create the Finosuke user record in Postgres.
 * Called on first authenticated API request so we never need webhooks.
 */
export async function getOrCreateUser(clerkUserId: string): Promise<User> {
  const cacheKey = `user:${clerkUserId}`;
  const _dbg = (hypothesisId: string, message: string, data: Record<string, unknown>) => {
    // #region agent log
    const payload = { sessionId: '6324d3', hypothesisId, location: 'lib/auth.ts:getOrCreateUser', message, data, timestamp: Date.now() };
    console.error('[DBG-6324d3]', JSON.stringify(payload));
    fetch('http://127.0.0.1:7774/ingest/dcabfc3d-ed4e-43fc-97f7-df046417891c', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '6324d3' }, body: JSON.stringify(payload) }).catch(() => {});
    // #endregion
  };

  try {
    const cached = await redis.get(cacheKey);
    // #region agent log
    _dbg('H-C', 'redis cache result', { hit: !!cached });
    // #endregion
    if (cached) return cached as User;
  } catch (e) {
    // #region agent log
    _dbg('H-C', 'redis cache error', { error: String(e) });
    // #endregion
  }

  const existing = await prisma.user.findUnique({
    where: { id: clerkUserId },
  });
  // #region agent log
  _dbg('H-A|H-D', 'findUnique result', { found: !!existing, clerkUserId });
  // #endregion
  if (existing) {
    try {
      await redis.set(cacheKey, existing, { ex: 60 });
    } catch {
      // silent fail
    }
    return existing;
  }

  // Fetch full profile from Clerk to seed the DB record
  const clerkUser = await currentUser();
  const email =
    clerkUser?.emailAddresses?.[0]?.emailAddress ??
    `${clerkUserId}@finosuke.app`;
  const name =
    clerkUser?.fullName ??
    clerkUser?.firstName ??
    null;

  // #region agent log
  _dbg('H-A|H-B', 'about to create user', { clerkUserId, email: email.replace(/(?<=.).(?=.*@)/g, '*') });
  // #endregion

  try {
    const user = await prisma.user.create({
      data: {
        id: clerkUserId,
        email,
        name,
        categories: {
          create: Object.values(DEFAULT_CATEGORIES).map((meta) => ({
            name: meta.label,
            icon: meta.icon,
            color: meta.color,
            isDefault: true,
          })),
        },
      },
    });

    try {
      await redis.set(cacheKey, user, { ex: 60 });
    } catch {
      // silent fail
    }

    // #region agent log
    _dbg('H-A|H-B', 'user create succeeded', { clerkUserId });
    // #endregion

    return user;
  } catch (createErr: unknown) {
    // #region agent log
    const errCode = (createErr as { code?: string })?.code;
    _dbg('H-A|H-B', 'user create failed', { code: errCode, message: String(createErr) });
    // #endregion

    // P2002 = unique constraint — another concurrent request already created this user
    if (errCode === 'P2002') {
      const race = await prisma.user.findUnique({ where: { id: clerkUserId } });
      // #region agent log
      _dbg('H-A', 'P2002 fallback findUnique', { found: !!race });
      // #endregion
      if (race) return race;
    }
    throw createErr;
  }
}

/**
 * Get Clerk userId + ensure local DB user exists.
 * One-stop helper for API routes.
 */
export async function getAuthenticatedUser() {
  const userId = await requireAuth();
  const user = await getOrCreateUser(userId);
  return { userId, user };
}
