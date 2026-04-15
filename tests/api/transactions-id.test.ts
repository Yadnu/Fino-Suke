import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ getAuthenticatedUser: vi.fn() }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: vi.fn() }));
vi.mock("@/lib/db", async () => ({
  default: (await import("../mocks/prisma")).mockPrismaClient,
}));
vi.mock("@/lib/redis", async () => ({
  redis: (await import("../mocks/redis")).mockRedisClient,
}));

import { PATCH, DELETE } from "@/app/api/transactions/[id]/route";
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

const OWNER_ID = "user_test123";
const OTHER_USER_ID = "user_other456";
const MOCK_USER = {
  id: OWNER_ID,
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
  userId: OWNER_ID,
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
  category: null,
};

beforeEach(() => {
  resetPrismaMocks();
  resetRedisMocks();
  mockAuth.mockResolvedValue({ userId: OWNER_ID, user: MOCK_USER });
  mockRateLimit.mockResolvedValue({ allowed: true, remaining: 59 });
});

// ── PATCH /api/transactions/[id] ────────────────────────────────────

describe("PATCH /api/transactions/[id]", () => {
  it("should return 401 when the user is not authenticated", async () => {
    mockAuth.mockRejectedValue(new Error("Unauthenticated"));
    const req = new Request("http://localhost/api/transactions/txn_1", {
      method: "PATCH",
      body: JSON.stringify({ amount: 75 }),
    });
    const res = await PATCH(req, { params: { id: "txn_1" } });
    expect(res.status).toBe(401);
  });

  it("should return 429 when the rate limit is exceeded", async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, remaining: 0 });
    const req = new Request("http://localhost/api/transactions/txn_1", {
      method: "PATCH",
      body: JSON.stringify({ amount: 75 }),
    });
    const res = await PATCH(req, { params: { id: "txn_1" } });
    expect(res.status).toBe(429);
  });

  it("should return 404 when the transaction does not exist for this user", async () => {
    mockDb.transaction.findFirst.mockResolvedValue(null);
    const req = new Request("http://localhost/api/transactions/txn_1", {
      method: "PATCH",
      body: JSON.stringify({ amount: 75 }),
    });
    const res = await PATCH(req, { params: { id: "txn_1" } });
    expect(res.status).toBe(404);
  });

  it("should reject cross-user access — does not return another user's transaction", async () => {
    // Simulates: authenticated as OWNER_ID, but findFirst returns null because
    // the transaction belongs to OTHER_USER_ID and the query includes userId filter
    mockDb.transaction.findFirst.mockResolvedValue(null);
    const req = new Request("http://localhost/api/transactions/txn_other", {
      method: "PATCH",
      body: JSON.stringify({ amount: 75 }),
    });
    const res = await PATCH(req, { params: { id: "txn_other" } });
    expect(res.status).toBe(404);
    // Verify the ownership check query includes userId
    expect(mockDb.transaction.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: OWNER_ID }),
      })
    );
  });

  it("should return 200 with the updated transaction on success", async () => {
    mockDb.transaction.findFirst.mockResolvedValue(MOCK_TRANSACTION);
    const updatedTxn = { ...MOCK_TRANSACTION, amount: 75 };
    mockDb.transaction.update.mockResolvedValue(updatedTxn);
    const req = new Request("http://localhost/api/transactions/txn_1", {
      method: "PATCH",
      body: JSON.stringify({ amount: 75 }),
    });
    const res = await PATCH(req, { params: { id: "txn_1" } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.amount).toBe(75);
  });

  it("should invalidate the analytics cache after a successful update", async () => {
    mockDb.transaction.findFirst.mockResolvedValue(MOCK_TRANSACTION);
    mockDb.transaction.update.mockResolvedValue(MOCK_TRANSACTION);
    const req = new Request("http://localhost/api/transactions/txn_1", {
      method: "PATCH",
      body: JSON.stringify({ amount: 75 }),
    });
    await PATCH(req, { params: { id: "txn_1" } });
    expect(mockRedis.del).toHaveBeenCalledWith(
      expect.stringContaining(`analytics:${OWNER_ID}:`)
    );
  });
});

// ── DELETE /api/transactions/[id] ───────────────────────────────────

describe("DELETE /api/transactions/[id]", () => {
  it("should return 401 when the user is not authenticated", async () => {
    mockAuth.mockRejectedValue(new Error("Unauthenticated"));
    const req = new Request("http://localhost/api/transactions/txn_1", {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: { id: "txn_1" } });
    expect(res.status).toBe(401);
  });

  it("should return 429 when the rate limit is exceeded", async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, remaining: 0 });
    const req = new Request("http://localhost/api/transactions/txn_1", {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: { id: "txn_1" } });
    expect(res.status).toBe(429);
  });

  it("should return 404 when the transaction does not exist", async () => {
    mockDb.transaction.findFirst.mockResolvedValue(null);
    const req = new Request("http://localhost/api/transactions/txn_1", {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: { id: "txn_1" } });
    expect(res.status).toBe(404);
  });

  it("should reject deletion of another user's transaction", async () => {
    mockDb.transaction.findFirst.mockResolvedValue(null);
    const req = new Request("http://localhost/api/transactions/txn_other", {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: { id: "txn_other" } });
    expect(res.status).toBe(404);
    expect(mockDb.transaction.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: OWNER_ID }),
      })
    );
  });

  it("should return 200 with success:true after deletion", async () => {
    mockDb.transaction.findFirst.mockResolvedValue(MOCK_TRANSACTION);
    mockDb.transaction.delete.mockResolvedValue(MOCK_TRANSACTION);
    const req = new Request("http://localhost/api/transactions/txn_1", {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: { id: "txn_1" } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ success: true });
  });

  it("should invalidate the analytics cache after deleting a transaction", async () => {
    mockDb.transaction.findFirst.mockResolvedValue(MOCK_TRANSACTION);
    mockDb.transaction.delete.mockResolvedValue(MOCK_TRANSACTION);
    const req = new Request("http://localhost/api/transactions/txn_1", {
      method: "DELETE",
    });
    await DELETE(req, { params: { id: "txn_1" } });
    expect(mockRedis.del).toHaveBeenCalledWith(
      expect.stringContaining(`analytics:${OWNER_ID}:`)
    );
  });
});
