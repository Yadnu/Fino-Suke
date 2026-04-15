/**
 * Integration test: Transaction create → Prisma called correctly → analytics cache invalidated
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

import { POST } from "@/app/api/transactions/route";
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
  mockRateLimit.mockResolvedValue({ allowed: true, remaining: 59 });
});

describe("Flow 1: Create transaction → Prisma called → analytics cache invalidated", () => {
  it("should create the transaction with the correct userId in Prisma", async () => {
    const txnDate = "2024-03-10";
    const createdTxn = {
      id: "txn_new",
      userId: USER_ID,
      amount: 120,
      type: "expense",
      categoryId: null,
      date: new Date(txnDate),
      notes: null,
      tags: [],
      isRecurring: false,
      recurringId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      category: null,
    };
    mockDb.transaction.create.mockResolvedValue(createdTxn);

    const req = new Request("http://localhost/api/transactions", {
      method: "POST",
      body: JSON.stringify({ amount: 120, type: "expense", date: txnDate }),
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
    expect(mockDb.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: USER_ID, amount: 120, type: "expense" }),
      })
    );
  });

  it("should call redis.del with the analytics key for the transaction's month", async () => {
    const createdTxn = {
      id: "txn_new",
      userId: USER_ID,
      amount: 120,
      type: "expense",
      categoryId: null,
      date: new Date("2024-03-10"),
      notes: null,
      tags: [],
      isRecurring: false,
      recurringId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      category: null,
    };
    mockDb.transaction.create.mockResolvedValue(createdTxn);

    const req = new Request("http://localhost/api/transactions", {
      method: "POST",
      body: JSON.stringify({ amount: 120, type: "expense", date: "2024-03-10" }),
    });
    await POST(req);

    expect(mockRedis.del).toHaveBeenCalledWith(`analytics:${USER_ID}:2024-03`);
  });

  it("should invalidate the analytics cache when a transaction is PATCH-updated", async () => {
    const existingTxn = {
      id: "txn_1",
      userId: USER_ID,
      amount: 50,
      type: "expense",
      categoryId: null,
      date: new Date("2024-03-15"),
      notes: null,
      tags: [],
      isRecurring: false,
      recurringId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      category: null,
    };
    mockDb.transaction.findFirst.mockResolvedValue(existingTxn);
    mockDb.transaction.update.mockResolvedValue({ ...existingTxn, amount: 75 });

    const req = new Request("http://localhost/api/transactions/txn_1", {
      method: "PATCH",
      body: JSON.stringify({ amount: 75 }),
    });
    await PATCH(req, { params: { id: "txn_1" } });

    expect(mockRedis.del).toHaveBeenCalledWith(
      expect.stringContaining(`analytics:${USER_ID}:`)
    );
  });

  it("should invalidate the analytics cache when a transaction is deleted", async () => {
    const existingTxn = {
      id: "txn_1",
      userId: USER_ID,
      amount: 50,
      type: "expense",
      categoryId: null,
      date: new Date("2024-03-15"),
      notes: null,
      tags: [],
      isRecurring: false,
      recurringId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      category: null,
    };
    mockDb.transaction.findFirst.mockResolvedValue(existingTxn);
    mockDb.transaction.delete.mockResolvedValue(existingTxn);

    const req = new Request("http://localhost/api/transactions/txn_1", { method: "DELETE" });
    await DELETE(req, { params: { id: "txn_1" } });

    expect(mockRedis.del).toHaveBeenCalledWith(`analytics:${USER_ID}:2024-03`);
  });
});
