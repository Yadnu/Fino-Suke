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

const MOCK_USER_ID = "user_test123";
const MOCK_USER = {
  id: MOCK_USER_ID,
  email: "test@finosuke.app",
  name: "Test User",
  currency: "USD",
  locale: "en-US",
  timezone: "UTC",
  avatar: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const CACHED_ANALYTICS = {
  month: "2024-01",
  totalIncome: 5000,
  totalExpenses: 2000,
  netSavings: 3000,
  savingsRate: 60,
  incomeTrend: 5,
  expensesTrend: -3,
  categoryBreakdown: [],
  recentTransactions: [],
};

const ZERO_SUM = { _sum: { amount: 0 } };

beforeEach(() => {
  resetPrismaMocks();
  resetRedisMocks();
  mockAuth.mockResolvedValue({ userId: MOCK_USER_ID, user: MOCK_USER });
  mockRateLimit.mockResolvedValue({ allowed: true, remaining: 59 });
});

describe("GET /api/analytics/summary", () => {
  it("should return 401 when the user is not authenticated", async () => {
    mockAuth.mockRejectedValue(new Error("Unauthenticated"));
    const req = new Request("http://localhost/api/analytics/summary");
    const res = await GET(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toMatchObject({ error: "Unauthorized" });
  });

  it("should return 429 when the rate limit is exceeded", async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, remaining: 0 });
    const req = new Request("http://localhost/api/analytics/summary");
    const res = await GET(req);
    expect(res.status).toBe(429);
  });

  it("should return the cached result from Redis without calling Prisma on a cache hit", async () => {
    mockRedis.get.mockResolvedValue(CACHED_ANALYTICS);
    const req = new Request("http://localhost/api/analytics/summary");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.month).toBe("2024-01");
    // Prisma should NOT have been called
    expect(mockDb.transaction.aggregate).not.toHaveBeenCalled();
  });

  it("should call Prisma aggregation on a cache miss and return 200", async () => {
    mockRedis.get.mockResolvedValue(null);
    mockDb.transaction.aggregate.mockResolvedValue(ZERO_SUM);
    mockDb.transaction.groupBy.mockResolvedValue([]);
    mockDb.transaction.findMany.mockResolvedValue([]);
    mockDb.category.findMany.mockResolvedValue([]);
    const req = new Request("http://localhost/api/analytics/summary?month=2024-01");
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(mockDb.transaction.aggregate).toHaveBeenCalled();
  });

  it("should store the computed result in Redis with a 300s TTL on a cache miss", async () => {
    mockRedis.get.mockResolvedValue(null);
    mockDb.transaction.aggregate.mockResolvedValue(ZERO_SUM);
    mockDb.transaction.groupBy.mockResolvedValue([]);
    mockDb.transaction.findMany.mockResolvedValue([]);
    mockDb.category.findMany.mockResolvedValue([]);
    const req = new Request("http://localhost/api/analytics/summary?month=2024-01");
    await GET(req);
    expect(mockRedis.set).toHaveBeenCalledWith(
      `analytics:${MOCK_USER_ID}:2024-01`,
      expect.any(Object),
      { ex: 300 }
    );
  });

  it("should use the key format analytics:${userId}:${YYYY-MM}", async () => {
    mockRedis.get.mockResolvedValue(null);
    mockDb.transaction.aggregate.mockResolvedValue(ZERO_SUM);
    mockDb.transaction.groupBy.mockResolvedValue([]);
    mockDb.transaction.findMany.mockResolvedValue([]);
    mockDb.category.findMany.mockResolvedValue([]);
    const req = new Request("http://localhost/api/analytics/summary?month=2024-03");
    await GET(req);
    expect(mockRedis.get).toHaveBeenCalledWith(`analytics:${MOCK_USER_ID}:2024-03`);
  });

  it("should include the requested month in the cache key", async () => {
    mockRedis.get.mockResolvedValue(null);
    mockDb.transaction.aggregate.mockResolvedValue(ZERO_SUM);
    mockDb.transaction.groupBy.mockResolvedValue([]);
    mockDb.transaction.findMany.mockResolvedValue([]);
    mockDb.category.findMany.mockResolvedValue([]);
    const req = new Request("http://localhost/api/analytics/summary?month=2023-12");
    await GET(req);
    expect(mockRedis.get).toHaveBeenCalledWith(`analytics:${MOCK_USER_ID}:2023-12`);
  });

  it("should return correct response shape with required analytics fields", async () => {
    mockRedis.get.mockResolvedValue(null);
    mockDb.transaction.aggregate.mockResolvedValue(ZERO_SUM);
    mockDb.transaction.groupBy.mockResolvedValue([]);
    mockDb.transaction.findMany.mockResolvedValue([]);
    mockDb.category.findMany.mockResolvedValue([]);
    const req = new Request("http://localhost/api/analytics/summary?month=2024-01");
    const res = await GET(req);
    const body = await res.json();
    expect(body).toHaveProperty("totalIncome");
    expect(body).toHaveProperty("totalExpenses");
    expect(body).toHaveProperty("netSavings");
    expect(body).toHaveProperty("savingsRate");
    expect(body).toHaveProperty("categoryBreakdown");
    expect(body).toHaveProperty("recentTransactions");
  });

  it("should fall through to Prisma queries when Redis throws on GET", async () => {
    mockRedis.get.mockRejectedValue(new Error("Redis unavailable"));
    mockDb.transaction.aggregate.mockResolvedValue(ZERO_SUM);
    mockDb.transaction.groupBy.mockResolvedValue([]);
    mockDb.transaction.findMany.mockResolvedValue([]);
    mockDb.category.findMany.mockResolvedValue([]);
    const req = new Request("http://localhost/api/analytics/summary?month=2024-01");
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(mockDb.transaction.aggregate).toHaveBeenCalled();
  });
});
