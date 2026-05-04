import { auth, currentUser } from "@clerk/nextjs/server";
import { Prisma, type User } from "@prisma/client";
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
 * Resolve Clerk profile fields used to seed or match a DB user.
 */
async function clerkProfileFor(clerkUserId: string) {
  const clerkUser = await currentUser();
  const email =
    clerkUser?.emailAddresses?.[0]?.emailAddress ??
    `${clerkUserId}@finosuke.app`;
  const name =
    clerkUser?.fullName ?? clerkUser?.firstName ?? null;
  return { email, name };
}

/**
 * Get-or-create the Finosuke user record in Postgres.
 * No Clerk webhook — first authenticated API call provisions the row.
 *
 * Handles the same human signing in with different Clerk IDs (e.g. Google vs
 * email/password): we match by email and return the existing account so FKs
 * stay consistent (`transactions.userId` = `users.id`).
 */
export async function getOrCreateUser(clerkUserId: string): Promise<User> {
  const cacheKey = `user:${clerkUserId}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return cached as User;
  } catch {
    // fall through to DB
  }

  const byClerkId = await prisma.user.findUnique({
    where: { id: clerkUserId },
  });
  if (byClerkId) {
    try {
      await redis.set(cacheKey, byClerkId, { ex: 60 });
    } catch {
      // silent fail
    }
    return byClerkId;
  }

  const { email, name } = await clerkProfileFor(clerkUserId);

  const byEmail = await prisma.user.findUnique({ where: { email } });
  if (byEmail) {
    try {
      await redis.set(cacheKey, byEmail, { ex: 60 });
    } catch {
      // silent fail
    }
    return byEmail;
  }

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

    return user;
  } catch (createErr: unknown) {
    if (
      createErr instanceof Prisma.PrismaClientKnownRequestError &&
      createErr.code === "P2002"
    ) {
      const againById = await prisma.user.findUnique({
        where: { id: clerkUserId },
      });
      if (againById) {
        try {
          await redis.set(cacheKey, againById, { ex: 60 });
        } catch {
          // silent fail
        }
        return againById;
      }

      const againByEmail = await prisma.user.findUnique({ where: { email } });
      if (againByEmail) {
        try {
          await redis.set(cacheKey, againByEmail, { ex: 60 });
        } catch {
          // silent fail
        }
        return againByEmail;
      }
    }
    throw createErr;
  }
}

/**
 * Clerk session + ensured local `User` row.
 *
 * - `clerkUserId`: ID from the current Clerk session (JWT).
 * - `userId`: Primary key in Postgres to use for all FKs (`user.id`). After an
 *   email-based merge this may differ from `clerkUserId`.
 * - `user`: The resolved `User` row.
 */
export async function getAuthenticatedUser() {
  const clerkUserId = await requireAuth();

  try {
    const user = await getOrCreateUser(clerkUserId);
    return { userId: user.id, user, clerkUserId };
  } catch (err: unknown) {
    const { email } = await clerkProfileFor(clerkUserId);
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      try {
        await redis.set(`user:${clerkUserId}`, existing, { ex: 60 });
      } catch {
        // silent fail
      }
      return { userId: existing.id, user: existing, clerkUserId };
    }
    throw err;
  }
}
