import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ getAuthenticatedUser: vi.fn() }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: vi.fn() }));
vi.mock("@/lib/db", async () => ({
  default: (await import("../mocks/prisma")).mockPrismaClient,
}));
vi.mock("@/lib/redis", async () => ({
  redis: (await import("../mocks/redis")).mockRedisClient,
}));

import { GET, POST } from "@/app/api/transactions/route";
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

const MOCK_TRANSACTION = {
  id: "txn_1",
  userId: MOCK_USER_ID,
  amount: 50.0,
  type: "expense",
  categoryId: "cat_1",
  date: new Date("2024-01-15"),
  notes: "Lunch",
  tags: [],
  isRecurring: false,
  recurringId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  category: { id: "cat_1", name: "Food & Dining", icon: "🍔", color: "#f5c842" },
};

beforeEach(() => {
  resetPrismaMocks();
  resetRedisMocks();
  mockAuth.mockResolvedValue({ userId: MOCK_USER_ID, user: MOCK_USER });
  mockRateLimit.mockResolvedValue({ allowed: true, remaining: 59 });
});

// ── GET /api/transactions ────────────────────────────────────────────

describe("GET /api/transactions", () => {
  it("should return 401 when the user is not authenticated", async () => {
    mockAuth.mockRejectedValue(new Error("Unauthenticated"));
    const req = new Request("http://localhost/api/transactions");
    const res = await GET(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toMatchObject({ error: "Unauthorized" });
  });

  it("should return 429 when the rate limit is exceeded", async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, remaining: 0 });
    const req = new Request("http://localhost/api/transactions");
    const res = await GET(req);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body).toMatchObject({ error: "Too many requests" });
  });

  it("should return 200 with the correct response shape on success", async () => {
    mockDb.transaction.findMany.mockResolvedValue([MOCK_TRANSACTION]);
    mockDb.transaction.count.mockResolvedValue(1);
    const req = new Request("http://localhost/api/transactions");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ transactions: expect.any(Array), total: 1, page: 1, limit: 20 });
  });

  it("should return only the current user's transactions", async () => {
    mockDb.transaction.findMany.mockResolvedValue([MOCK_TRANSACTION]);
    mockDb.transaction.count.mockResolvedValue(1);
    const req = new Request("http://localhost/api/transactions");
    await GET(req);
    expect(mockDb.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: MOCK_USER_ID }),
      })
    );
  });

  it("should return 400 for an invalid type filter", async () => {
    const req = new Request("http://localhost/api/transactions?type=invalid");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("should apply pagination via page and limit query params", async () => {
    mockDb.transaction.findMany.mockResolvedValue([]);
    mockDb.transaction.count.mockResolvedValue(0);
    const req = new Request("http://localhost/api/transactions?page=2&limit=10");
    const res = await GET(req);
    const body = await res.json();
    expect(body.page).toBe(2);
    expect(body.limit).toBe(10);
  });
});

// ── POST /api/transactions ───────────────────────────────────────────

describe("POST /api/transactions", () => {
  it("should return 401 when the user is not authenticated", async () => {
    mockAuth.mockRejectedValue(new Error("Unauthenticated"));
    const req = new Request("http://localhost/api/transactions", {
      method: "POST",
      body: JSON.stringify({ amount: 50, type: "expense", date: "2024-01-15" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("should return 429 when the rate limit is exceeded", async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, remaining: 0 });
    const req = new Request("http://localhost/api/transactions", {
      method: "POST",
      body: JSON.stringify({ amount: 50, type: "expense", date: "2024-01-15" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(429);
  });

  it("should return 201 with the created transaction on success", async () => {
    mockDb.transaction.create.mockResolvedValue(MOCK_TRANSACTION);
    const req = new Request("http://localhost/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: 50, type: "expense", date: "2024-01-15" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ id: "txn_1", type: "expense" });
  });

  it("should return 400 when required fields are missing", async () => {
    const req = new Request("http://localhost/api/transactions", {
      method: "POST",
      body: JSON.stringify({ amount: 50 }), // missing type and date
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should return 400 when the amount is zero or negative", async () => {
    const req = new Request("http://localhost/api/transactions", {
      method: "POST",
      body: JSON.stringify({ amount: -10, type: "expense", date: "2024-01-15" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should call redis.del on the analytics cache key after creating a transaction", async () => {
    mockDb.transaction.create.mockResolvedValue(MOCK_TRANSACTION);
    const req = new Request("http://localhost/api/transactions", {
      method: "POST",
      body: JSON.stringify({ amount: 50, type: "expense", date: "2024-01-15" }),
    });
    await POST(req);
    expect(mockRedis.del).toHaveBeenCalledWith(`analytics:${MOCK_USER_ID}:2024-01`);
  });
});
