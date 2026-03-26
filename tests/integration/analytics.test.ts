/**
 * Integration tests:
 * Flow 2: GET analytics (cold cache) → cache miss → Prisma runs → result cached
 * Flow 3: GET analytics (warm cache) → cache hit → Prisma NOT called
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ getAuthenticatedUser: vi.fn() }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: vi.fn() }));
vi.mock("@/lib/db", async () => ({
  default: (await import("../mocks/prisma")).mockPrismaClient,
}));
vi.mock("@/lib/redis", async () => ({
  redis: (await import("../mocks/redis")).mockRedisClient,
}));

import { GET } from "@/app/api/analytics/summary/route";
import { getAuthenticatedUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import prisma from "@/lib/db";
import { redis } from "@/lib/redis";
import { resetPrismaMocks } from "../mocks/prisma";
import { resetRedisMocks } from "../mocks/redis";

const mockAuth = vi.mocked(getAuthenticatedUser);
const mockRateLimit = vi.mocked(rateLimit);
const mockDb = prisma as typeof import("../mocks/prisma").mockPrismaClient;
const mockRedis = redis as typeof import("../mocks/redis").mockRedisClient;

const USER_ID = "user_test123";
const MONTH = "2024-01";
const CACHE_KEY = `analytics:${USER_ID}:${MONTH}`;

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

const CACHED_RESULT = {
  month: MONTH,
  totalIncome: 5000,
  totalExpenses: 2000,
  netSavings: 3000,
  savingsRate: 60,
  incomeTrend: 10,
  expensesTrend: -5,
  categoryBreakdown: [],
  recentTransactions: [],
};

const ZERO_SUM = { _sum: { amount: 0 } };

beforeEach(() => {
  resetPrismaMocks();
  resetRedisMocks();
  mockAuth.mockResolvedValue({ userId: USER_ID, user: MOCK_USER });
  mockRateLimit.mockResolvedValue({ allowed: true, remaining: 59 });
});

describe("Flow 2: Cold cache — Prisma runs and result is cached", () => {
  it("should check Redis for the analytics cache key first", async () => {
    mockRedis.get.mockResolvedValue(null);
    mockDb.transaction.aggregate.mockResolvedValue(ZERO_SUM);
    mockDb.transaction.groupBy.mockResolvedValue([]);
    mockDb.transaction.findMany.mockResolvedValue([]);
    mockDb.category.findMany.mockResolvedValue([]);

    const req = new Request(`http://localhost/api/analytics/summary?month=${MONTH}`);
    await GET(req);

    expect(mockRedis.get).toHaveBeenCalledWith(CACHE_KEY);
  });

  it("should run Prisma aggregate queries on a cache miss", async () => {
    mockRedis.get.mockResolvedValue(null);
    mockDb.transaction.aggregate.mockResolvedValue(ZERO_SUM);
    mockDb.transaction.groupBy.mockResolvedValue([]);
    mockDb.transaction.findMany.mockResolvedValue([]);
    mockDb.category.findMany.mockResolvedValue([]);

    const req = new Request(`http://localhost/api/analytics/summary?month=${MONTH}`);
    await GET(req);

    // 4 aggregate calls: currentIncome, currentExpenses, prevIncome, prevExpenses
    expect(mockDb.transaction.aggregate).toHaveBeenCalledTimes(4);
  });

  it("should store the computed result in Redis with a 300s TTL after a cache miss", async () => {
    mockRedis.get.mockResolvedValue(null);
    mockDb.transaction.aggregate.mockResolvedValue(ZERO_SUM);
    mockDb.transaction.groupBy.mockResolvedValue([]);
    mockDb.transaction.findMany.mockResolvedValue([]);
    mockDb.category.findMany.mockResolvedValue([]);

    const req = new Request(`http://localhost/api/analytics/summary?month=${MONTH}`);
    await GET(req);

    expect(mockRedis.set).toHaveBeenCalledWith(
      CACHE_KEY,
      expect.objectContaining({ month: MONTH }),
      { ex: 300 }
    );
  });

  it("should return correct analytics shape including all required fields", async () => {
    mockRedis.get.mockResolvedValue(null);
    mockDb.transaction.aggregate.mockResolvedValue({ _sum: { amount: 1000 } });
    mockDb.transaction.groupBy.mockResolvedValue([]);
    mockDb.transaction.findMany.mockResolvedValue([]);
    mockDb.category.findMany.mockResolvedValue([]);

    const req = new Request(`http://localhost/api/analytics/summary?month=${MONTH}`);
    const res = await GET(req);
    const body = await res.json();

    expect(body).toMatchObject({
      month: MONTH,
      totalIncome: expect.any(Number),
      totalExpenses: expect.any(Number),
      netSavings: expect.any(Number),
      savingsRate: expect.any(Number),
      incomeTrend: expect.any(Number),
      expensesTrend: expect.any(Number),
      categoryBreakdown: expect.any(Array),
      recentTransactions: expect.any(Array),
    });
  });
});

describe("Flow 3: Warm cache — Prisma is NOT called", () => {
  it("should return the cached result directly from Redis", async () => {
    mockRedis.get.mockResolvedValue(CACHED_RESULT);

    const req = new Request(`http://localhost/api/analytics/summary?month=${MONTH}`);
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(CACHED_RESULT);
  });

  it("should NOT call Prisma when the cache is warm", async () => {
    mockRedis.get.mockResolvedValue(CACHED_RESULT);

    const req = new Request(`http://localhost/api/analytics/summary?month=${MONTH}`);
    await GET(req);

    expect(mockDb.transaction.aggregate).not.toHaveBeenCalled();
    expect(mockDb.transaction.groupBy).not.toHaveBeenCalled();
    expect(mockDb.transaction.findMany).not.toHaveBeenCalled();
  });

  it("should NOT write to the Redis cache when returning a cached result", async () => {
    mockRedis.get.mockResolvedValue(CACHED_RESULT);

    const req = new Request(`http://localhost/api/analytics/summary?month=${MONTH}`);
    await GET(req);

    expect(mockRedis.set).not.toHaveBeenCalled();
  });
});
