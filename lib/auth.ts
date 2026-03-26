import { auth, currentUser } from "@clerk/nextjs/server";
import prisma from "@/lib/db";
import { DEFAULT_CATEGORIES } from "@/lib/utils";

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
export async function getOrCreateUser(clerkUserId: string) {
  const existing = await prisma.user.findUnique({
    where: { id: clerkUserId },
  });
  if (existing) return existing;

  // Fetch full profile from Clerk to seed the DB record
  const clerkUser = await currentUser();
  const email =
    clerkUser?.emailAddresses?.[0]?.emailAddress ??
    `${clerkUserId}@finosuke.app`;
  const name =
    clerkUser?.fullName ??
    clerkUser?.firstName ??
    null;

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

  return user;
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
