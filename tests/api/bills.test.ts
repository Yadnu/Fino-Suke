import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ getAuthenticatedUser: vi.fn() }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: vi.fn() }));
vi.mock("@/lib/db", async () => ({
  default: (await import("../mocks/prisma")).mockPrismaClient,
}));
vi.mock("@/lib/redis", async () => ({
  redis: (await import("../mocks/redis")).mockRedisClient,
}));

import { GET, POST } from "@/app/api/bills/route";
import { PATCH, DELETE } from "@/app/api/bills/[id]/route";
import { POST as MARK_PAID } from "@/app/api/bills/[id]/mark-paid/route";
import { getAuthenticatedUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import prisma from "@/lib/db";
import { redis } from "@/lib/redis";
import { resetPrismaMocks } from "../mocks/prisma";
import { resetRedisMocks } from "../mocks/redis";
import { shouldNotify, markNotified } from "@/lib/notificationGuard";

// notificationGuard is NOT mocked here — we test it via the redis mock

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

const MOCK_BILL = {
  id: "bill_1",
  userId: MOCK_USER_ID,
  name: "Netflix",
  amount: 15.99,
  frequency: "monthly",
  dueDay: 15,
  nextDueDate: new Date("2024-02-15"),
  categoryId: null,
  notes: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  category: null,
};

beforeEach(() => {
  resetPrismaMocks();
  resetRedisMocks();
  mockAuth.mockResolvedValue({ userId: MOCK_USER_ID, user: MOCK_USER });
  mockRateLimit.mockResolvedValue({ allowed: true, remaining: 59 });
});

// ── GET /api/bills ───────────────────────────────────────────────────

describe("GET /api/bills", () => {
  it("should return 401 when the user is not authenticated", async () => {
    mockAuth.mockRejectedValue(new Error("Unauthenticated"));
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("should return 429 when the rate limit is exceeded", async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, remaining: 0 });
    const res = await GET();
    expect(res.status).toBe(429);
  });

  it("should return 200 with bills array on success", async () => {
    mockDb.bill.findMany.mockResolvedValue([MOCK_BILL]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ bills: expect.any(Array) });
  });

  it("should return only the current user's bills", async () => {
    mockDb.bill.findMany.mockResolvedValue([MOCK_BILL]);
    await GET();
    expect(mockDb.bill.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: MOCK_USER_ID }),
      })
    );
  });
});

// ── POST /api/bills ──────────────────────────────────────────────────

describe("POST /api/bills", () => {
  it("should return 401 when the user is not authenticated", async () => {
    mockAuth.mockRejectedValue(new Error("Unauthenticated"));
    const req = new Request("http://localhost/api/bills", {
      method: "POST",
      body: JSON.stringify({ name: "Netflix", amount: 15.99, frequency: "monthly", dueDay: 15 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("should return 429 when the rate limit is exceeded", async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, remaining: 0 });
    const req = new Request("http://localhost/api/bills", {
      method: "POST",
      body: JSON.stringify({ name: "Netflix", amount: 15.99, frequency: "monthly", dueDay: 15 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(429);
  });

  it("should return 201 with the created bill on success", async () => {
    mockDb.bill.create.mockResolvedValue(MOCK_BILL);
    const req = new Request("http://localhost/api/bills", {
      method: "POST",
      body: JSON.stringify({ name: "Netflix", amount: 15.99, frequency: "monthly", dueDay: 15 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ name: "Netflix" });
  });

  it("should return 400 when required fields are missing", async () => {
    const req = new Request("http://localhost/api/bills", {
      method: "POST",
      body: JSON.stringify({ name: "Netflix" }), // missing amount, frequency, dueDay
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

// ── PATCH /api/bills/[id] ────────────────────────────────────────────

describe("PATCH /api/bills/[id]", () => {
  it("should return 401 when the user is not authenticated", async () => {
    mockAuth.mockRejectedValue(new Error("Unauthenticated"));
    const req = new Request("http://localhost/api/bills/bill_1", {
      method: "PATCH",
      body: JSON.stringify({ amount: 18.99 }),
    });
    const res = await PATCH(req, { params: { id: "bill_1" } });
    expect(res.status).toBe(401);
  });

  it("should return 404 when the bill does not belong to the current user", async () => {
    mockDb.bill.findFirst.mockResolvedValue(null);
    const req = new Request("http://localhost/api/bills/bill_other", {
      method: "PATCH",
      body: JSON.stringify({ amount: 18.99 }),
    });
    const res = await PATCH(req, { params: { id: "bill_other" } });
    expect(res.status).toBe(404);
    // Ownership check: query must include userId
    expect(mockDb.bill.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: MOCK_USER_ID }),
      })
    );
  });

  it("should return 200 with the updated bill on success", async () => {
    mockDb.bill.findFirst.mockResolvedValue(MOCK_BILL);
    mockDb.bill.update.mockResolvedValue({ ...MOCK_BILL, amount: 18.99 });
    const req = new Request("http://localhost/api/bills/bill_1", {
      method: "PATCH",
      body: JSON.stringify({ amount: 18.99 }),
    });
    const res = await PATCH(req, { params: { id: "bill_1" } });
    expect(res.status).toBe(200);
  });
});

// ── DELETE /api/bills/[id] ───────────────────────────────────────────

describe("DELETE /api/bills/[id]", () => {
  it("should return 401 when the user is not authenticated", async () => {
    mockAuth.mockRejectedValue(new Error("Unauthenticated"));
    const req = new Request("http://localhost/api/bills/bill_1", { method: "DELETE" });
    const res = await DELETE(req, { params: { id: "bill_1" } });
    expect(res.status).toBe(401);
  });

  it("should reject deletion of another user's bill", async () => {
    mockDb.bill.findFirst.mockResolvedValue(null);
    const req = new Request("http://localhost/api/bills/bill_other", { method: "DELETE" });
    const res = await DELETE(req, { params: { id: "bill_other" } });
    expect(res.status).toBe(404);
  });

  it("should return 200 with success:true after deletion", async () => {
    mockDb.bill.findFirst.mockResolvedValue(MOCK_BILL);
    mockDb.bill.delete.mockResolvedValue(MOCK_BILL);
    const req = new Request("http://localhost/api/bills/bill_1", { method: "DELETE" });
    const res = await DELETE(req, { params: { id: "bill_1" } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ success: true });
  });
});

// ── POST /api/bills/[id]/mark-paid ───────────────────────────────────

describe("POST /api/bills/[id]/mark-paid", () => {
  it("should return 401 when the user is not authenticated", async () => {
    mockAuth.mockRejectedValue(new Error("Unauthenticated"));
    const req = new Request("http://localhost/api/bills/bill_1/mark-paid", { method: "POST" });
    const res = await MARK_PAID(req, { params: { id: "bill_1" } });
    expect(res.status).toBe(401);
  });

  it("should return 404 when the bill does not belong to the current user", async () => {
    mockDb.bill.findFirst.mockResolvedValue(null);
    const req = new Request("http://localhost/api/bills/bill_other/mark-paid", { method: "POST" });
    const res = await MARK_PAID(req, { params: { id: "bill_other" } });
    expect(res.status).toBe(404);
  });

  it("should advance nextDueDate by one month for a monthly bill", async () => {
    const billDate = new Date("2024-01-15");
    const billWithDate = { ...MOCK_BILL, nextDueDate: billDate, frequency: "monthly" };
    mockDb.bill.findFirst.mockResolvedValue(billWithDate);
    const updatedBill = { ...billWithDate, nextDueDate: new Date("2024-02-15") };
    mockDb.bill.update.mockResolvedValue(updatedBill);
    const req = new Request("http://localhost/api/bills/bill_1/mark-paid", { method: "POST" });
    const res = await MARK_PAID(req, { params: { id: "bill_1" } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(new Date(body.nextDueDate).getMonth()).toBe(1); // February (0-indexed)
  });
});

// ── Notification Deduplication (via notificationGuard) ───────────────

describe("Notification deduplication (notificationGuard)", () => {
  it("should NOT fire a notification if the bill-notified key already exists in Redis", async () => {
    // redis.exists returns 1 = key already set = already notified today
    mockRedis.exists.mockResolvedValue(1);
    const result = await shouldNotify(MOCK_USER_ID, "bill_1", "2024-01-15");
    expect(result).toBe(false);
    expect(mockRedis.set).not.toHaveBeenCalled();
  });

  it("should fire a notification and set the Redis key if the key does not exist", async () => {
    mockRedis.exists.mockResolvedValue(0);
    const canNotify = await shouldNotify(MOCK_USER_ID, "bill_1", "2024-01-15");
    expect(canNotify).toBe(true);
    // Now mark as notified
    await markNotified(MOCK_USER_ID, "bill_1", "2024-01-15");
    expect(mockRedis.set).toHaveBeenCalledWith(
      `bill-notified:${MOCK_USER_ID}:bill_1:2024-01-15`,
      "1",
      { ex: 86400 }
    );
  });

  it("should use the dedup key format bill-notified:${userId}:${billId}:${YYYY-MM-DD}", async () => {
    mockRedis.exists.mockResolvedValue(0);
    await shouldNotify(MOCK_USER_ID, "bill_1", "2024-01-15");
    expect(mockRedis.exists).toHaveBeenCalledWith(
      `bill-notified:${MOCK_USER_ID}:bill_1:2024-01-15`
    );
  });

  it("should set the dedup key with an 86400s (24h) TTL", async () => {
    await markNotified(MOCK_USER_ID, "bill_1", "2024-01-15");
    expect(mockRedis.set).toHaveBeenCalledWith(
      expect.stringContaining("bill-notified:"),
      "1",
      { ex: 86400 }
    );
  });
});
