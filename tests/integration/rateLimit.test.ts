/**
 * Integration test:
 * Flow 6: Rate limiting → 61st request in 60s window returns 429
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ getAuthenticatedUser: vi.fn() }));
vi.mock("@/lib/db", async () => ({
  default: (await import("../mocks/prisma")).mockPrismaClient,
}));
vi.mock("@/lib/redis", async () => ({
  redis: (await import("../mocks/redis")).mockRedisClient,
}));

import { GET } from "@/app/api/transactions/route";
import { getAuthenticatedUser } from "@/lib/auth";
import { redis } from "@/lib/redis";
import prisma from "@/lib/db";
import { resetPrismaMocks } from "../mocks/prisma";
import { resetRedisMocks } from "../mocks/redis";

const mockAuth = vi.mocked(getAuthenticatedUser);
const mockRedis = redis as typeof import("../mocks/redis").mockRedisClient;
const mockDb = prisma as typeof import("../mocks/prisma").mockPrismaClient;

const USER_ID = "user_test123";
const MOCK_USER = {
  id: USER_ID,
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
  resetPrismaMocks();
  resetRedisMocks();
  mockAuth.mockResolvedValue({ userId: USER_ID, user: MOCK_USER });
  mockDb.transaction.findMany.mockResolvedValue([]);
  mockDb.transaction.count.mockResolvedValue(0);
});

describe("Flow 6: Rate limiting via Redis INCR counter", () => {
  it("should allow the 60th request within the window (count === limit)", async () => {
    // Redis INCR returns 60 — exactly at the limit
    mockRedis.incr.mockResolvedValue(60);
    const req = new Request("http://localhost/api/transactions");
    const res = await GET(req);
    expect(res.status).toBe(200);
  });

  it("should block the 61st request in a 60s window with 429", async () => {
    // Redis INCR returns 61 — one over the limit
    mockRedis.incr.mockResolvedValue(61);
    const req = new Request("http://localhost/api/transactions");
    const res = await GET(req);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body).toMatchObject({ error: "Too many requests" });
  });

  it("should NOT set expire on subsequent requests (only on first increment)", async () => {
    // When count is > 1, expire should NOT be called (window already set)
    mockRedis.incr.mockResolvedValue(5);
    const req = new Request("http://localhost/api/transactions");
    await GET(req);
    expect(mockRedis.expire).not.toHaveBeenCalled();
  });

  it("should set the 60s expire on the very first request in a new window", async () => {
    // When count === 1, expire SHOULD be called with 60s
    mockRedis.incr.mockResolvedValue(1);
    const req = new Request("http://localhost/api/transactions");
    await GET(req);
    expect(mockRedis.expire).toHaveBeenCalledWith(`rate:${USER_ID}`, 60);
  });

  it("should fall through and allow the request when Redis is unavailable", async () => {
    // Redis throws — request should be allowed (fail open)
    mockRedis.incr.mockRejectedValue(new Error("Redis ECONNREFUSED"));
    const req = new Request("http://localhost/api/transactions");
    const res = await GET(req);
    expect(res.status).toBe(200);
  });

  it("should use the rate:${userId} key format for all endpoints", async () => {
    mockRedis.incr.mockResolvedValue(1);
    const req = new Request("http://localhost/api/transactions");
    await GET(req);
    expect(mockRedis.incr).toHaveBeenCalledWith(`rate:${USER_ID}`);
  });
});
