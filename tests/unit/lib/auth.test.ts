import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@clerk/nextjs/server", async () => {
  const { mockAuth, mockCurrentUser } = await import("../../mocks/clerk");
  return { auth: mockAuth, currentUser: mockCurrentUser };
});

vi.mock("@/lib/db", async () => {
  const { mockPrismaClient } = await import("../../mocks/prisma");
  return { default: mockPrismaClient };
});

vi.mock("@/lib/redis", async () => {
  const { mockRedisClient } = await import("../../mocks/redis");
  return { redis: mockRedisClient };
});

// DEFAULT_CATEGORIES is a pure export from utils — no need to mock it
vi.mock("@/lib/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/utils")>();
  return { ...actual };
});

import { requireAuth, getOrCreateUser, getAuthenticatedUser } from "@/lib/auth";
import { auth, currentUser } from "@clerk/nextjs/server";
import prisma from "@/lib/db";
import { redis } from "@/lib/redis";
import { resetRedisMocks } from "../../mocks/redis";
import { resetPrismaMocks } from "../../mocks/prisma";
import { resetClerkMocks, MOCK_CLERK_USER_ID } from "../../mocks/clerk";

const mockAuthFn = auth as ReturnType<typeof vi.fn>;
const mockCurrentUserFn = currentUser as ReturnType<typeof vi.fn>;
const mockDb = prisma as typeof import("../../mocks/prisma").mockPrismaClient;
const mockRedis = redis as typeof import("../../mocks/redis").mockRedisClient;

const MOCK_USER = {
  id: MOCK_CLERK_USER_ID,
  email: "test@finosuke.app",
  name: "Test User",
  currency: "USD",
  locale: "en-US",
  timezone: "UTC",
  avatar: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  resetClerkMocks();
  resetPrismaMocks();
  resetRedisMocks();
});

describe("requireAuth", () => {
  it("should return the Clerk userId when authenticated", async () => {
    mockAuthFn.mockResolvedValue({ userId: MOCK_CLERK_USER_ID });
    const userId = await requireAuth();
    expect(userId).toBe(MOCK_CLERK_USER_ID);
  });

  it("should throw 'Unauthenticated' when Clerk returns no userId", async () => {
    mockAuthFn.mockResolvedValue({ userId: null });
    await expect(requireAuth()).rejects.toThrow("Unauthenticated");
  });
});

describe("getOrCreateUser — cache hit", () => {
  it("should return the cached user from Redis without calling Prisma", async () => {
    mockRedis.get.mockResolvedValue(MOCK_USER);
    const result = await getOrCreateUser(MOCK_CLERK_USER_ID);
    expect(result).toEqual(MOCK_USER);
    expect(mockDb.user.findUnique).not.toHaveBeenCalled();
  });

  it("should look up the Redis cache with key user:${clerkUserId}", async () => {
    mockRedis.get.mockResolvedValue(MOCK_USER);
    await getOrCreateUser(MOCK_CLERK_USER_ID);
    expect(mockRedis.get).toHaveBeenCalledWith(`user:${MOCK_CLERK_USER_ID}`);
  });
});

describe("getOrCreateUser — cache miss, DB hit", () => {
  it("should call Prisma when Redis returns null and return the existing user", async () => {
    mockRedis.get.mockResolvedValue(null);
    mockDb.user.findUnique.mockResolvedValue(MOCK_USER);
    const result = await getOrCreateUser(MOCK_CLERK_USER_ID);
    expect(result).toEqual(MOCK_USER);
    expect(mockDb.user.findUnique).toHaveBeenCalledWith({
      where: { id: MOCK_CLERK_USER_ID },
    });
  });

  it("should store the DB result back in Redis with 60s TTL", async () => {
    mockRedis.get.mockResolvedValue(null);
    mockDb.user.findUnique.mockResolvedValue(MOCK_USER);
    await getOrCreateUser(MOCK_CLERK_USER_ID);
    expect(mockRedis.set).toHaveBeenCalledWith(
      `user:${MOCK_CLERK_USER_ID}`,
      MOCK_USER,
      { ex: 60 }
    );
  });
});

describe("getOrCreateUser — new user creation", () => {
  it("should create a new user with default categories when not found in DB", async () => {
    mockRedis.get.mockResolvedValue(null);
    mockDb.user.findUnique.mockResolvedValue(null);
    mockCurrentUserFn.mockResolvedValue({
      emailAddresses: [{ emailAddress: "test@finosuke.app" }],
      fullName: "Test User",
      firstName: "Test",
    });
    mockDb.user.create.mockResolvedValue(MOCK_USER);
    const result = await getOrCreateUser(MOCK_CLERK_USER_ID);
    expect(result).toEqual(MOCK_USER);
    expect(mockDb.user.create).toHaveBeenCalled();
  });
});

describe("getOrCreateUser — Redis failure fallback", () => {
  it("should proceed to Prisma lookup when Redis get throws", async () => {
    mockRedis.get.mockRejectedValue(new Error("Redis connection refused"));
    mockDb.user.findUnique.mockResolvedValue(MOCK_USER);
    const result = await getOrCreateUser(MOCK_CLERK_USER_ID);
    expect(result).toEqual(MOCK_USER);
    expect(mockDb.user.findUnique).toHaveBeenCalled();
  });

  it("should still return the user even when Redis set throws after DB lookup", async () => {
    mockRedis.get.mockResolvedValue(null);
    mockDb.user.findUnique.mockResolvedValue(MOCK_USER);
    mockRedis.set.mockRejectedValue(new Error("Redis write failed"));
    await expect(getOrCreateUser(MOCK_CLERK_USER_ID)).resolves.toEqual(MOCK_USER);
  });
});

describe("getAuthenticatedUser", () => {
  it("should return both userId and user object on success", async () => {
    mockAuthFn.mockResolvedValue({ userId: MOCK_CLERK_USER_ID });
    mockRedis.get.mockResolvedValue(MOCK_USER);
    const { userId, user } = await getAuthenticatedUser();
    expect(userId).toBe(MOCK_CLERK_USER_ID);
    expect(user).toEqual(MOCK_USER);
  });

  it("should throw when Clerk reports no authenticated user", async () => {
    mockAuthFn.mockResolvedValue({ userId: null });
    await expect(getAuthenticatedUser()).rejects.toThrow("Unauthenticated");
  });
});
