import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ getAuthenticatedUser: vi.fn() }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: vi.fn() }));
vi.mock("@/lib/db", async () => ({
  default: (await import("../mocks/prisma")).mockPrismaClient,
}));
vi.mock("@/lib/redis", async () => ({
  redis: (await import("../mocks/redis")).mockRedisClient,
}));

import { GET, POST } from "@/app/api/budgets/route";
import { PATCH, DELETE } from "@/app/api/budgets/[id]/route";
import { getAuthenticatedUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import prisma from "@/lib/db";
import { resetPrismaMocks } from "../mocks/prisma";
import { resetRedisMocks } from "../mocks/redis";

const mockAuth = vi.mocked(getAuthenticatedUser);
const mockRateLimit = vi.mocked(rateLimit);
const mockDb = prisma as typeof import("../mocks/prisma").mockPrismaClient;

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

const MOCK_BUDGET = {
  id: "budget_1",
  userId: MOCK_USER_ID,
  name: "Food Budget",
  categoryId: "cat_1",
  amount: 500,
  period: "monthly",
  month: "2024-01",
  rollover: false,
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

// ── GET /api/budgets ─────────────────────────────────────────────────

describe("GET /api/budgets", () => {
  it("should return 401 when the user is not authenticated", async () => {
    mockAuth.mockRejectedValue(new Error("Unauthenticated"));
    const req = new Request("http://localhost/api/budgets");
    const res = await GET(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toMatchObject({ error: "Unauthorized" });
  });

  it("should return 429 when the rate limit is exceeded", async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, remaining: 0 });
    const req = new Request("http://localhost/api/budgets");
    const res = await GET(req);
    expect(res.status).toBe(429);
  });

  it("should return 200 with budgets array and month on success", async () => {
    mockDb.budget.findMany.mockResolvedValue([MOCK_BUDGET]);
    mockDb.transaction.groupBy.mockResolvedValue([]);
    const req = new Request("http://localhost/api/budgets?month=2024-01");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ budgets: expect.any(Array), month: "2024-01" });
  });

  it("should return only the current user's budgets", async () => {
    mockDb.budget.findMany.mockResolvedValue([MOCK_BUDGET]);
    mockDb.transaction.groupBy.mockResolvedValue([]);
    const req = new Request("http://localhost/api/budgets");
    await GET(req);
    expect(mockDb.budget.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: MOCK_USER_ID }),
      })
    );
  });

  it("should include the spent field calculated from transactions", async () => {
    mockDb.budget.findMany.mockResolvedValue([MOCK_BUDGET]);
    mockDb.transaction.groupBy.mockResolvedValue([
      { categoryId: "cat_1", _sum: { amount: 200 } },
    ]);
    const req = new Request("http://localhost/api/budgets?month=2024-01");
    const res = await GET(req);
    const body = await res.json();
    expect(body.budgets[0]).toHaveProperty("spent", 200);
  });
});

// ── POST /api/budgets ────────────────────────────────────────────────

describe("POST /api/budgets", () => {
  it("should return 401 when the user is not authenticated", async () => {
    mockAuth.mockRejectedValue(new Error("Unauthenticated"));
    const req = new Request("http://localhost/api/budgets", {
      method: "POST",
      body: JSON.stringify({ name: "Food", amount: 500, period: "monthly", month: "2024-01" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("should return 429 when the rate limit is exceeded", async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, remaining: 0 });
    const req = new Request("http://localhost/api/budgets", {
      method: "POST",
      body: JSON.stringify({ name: "Food", amount: 500, period: "monthly", month: "2024-01" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(429);
  });

  it("should return 201 with the created budget on success", async () => {
    mockDb.budget.create.mockResolvedValue(MOCK_BUDGET);
    const req = new Request("http://localhost/api/budgets", {
      method: "POST",
      body: JSON.stringify({ name: "Food", amount: 500, period: "monthly", month: "2024-01" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ name: "Food Budget" });
  });

  it("should return 400 when required fields are missing", async () => {
    const req = new Request("http://localhost/api/budgets", {
      method: "POST",
      body: JSON.stringify({ name: "Food" }), // missing amount, period, month
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should return 409 when a budget for the same category+month already exists", async () => {
    const conflictError = Object.assign(new Error("Unique constraint"), { code: "P2002" });
    mockDb.budget.create.mockRejectedValue(conflictError);
    const req = new Request("http://localhost/api/budgets", {
      method: "POST",
      body: JSON.stringify({ name: "Food", amount: 500, period: "monthly", month: "2024-01" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
  });
});

// ── PATCH /api/budgets/[id] ──────────────────────────────────────────

describe("PATCH /api/budgets/[id]", () => {
  it("should return 401 when the user is not authenticated", async () => {
    mockAuth.mockRejectedValue(new Error("Unauthenticated"));
    const req = new Request("http://localhost/api/budgets/budget_1", {
      method: "PATCH",
      body: JSON.stringify({ amount: 600 }),
    });
    const res = await PATCH(req, { params: { id: "budget_1" } });
    expect(res.status).toBe(401);
  });

  it("should reject modification of another user's budget (ownership check)", async () => {
    mockDb.budget.findFirst.mockResolvedValue(null);
    const req = new Request("http://localhost/api/budgets/budget_other", {
      method: "PATCH",
      body: JSON.stringify({ amount: 600 }),
    });
    const res = await PATCH(req, { params: { id: "budget_other" } });
    expect(res.status).toBe(404);
    expect(mockDb.budget.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: MOCK_USER_ID }),
      })
    );
  });

  it("should return 200 with the updated budget on success", async () => {
    mockDb.budget.findFirst.mockResolvedValue(MOCK_BUDGET);
    mockDb.budget.update.mockResolvedValue({ ...MOCK_BUDGET, amount: 600 });
    const req = new Request("http://localhost/api/budgets/budget_1", {
      method: "PATCH",
      body: JSON.stringify({ amount: 600 }),
    });
    const res = await PATCH(req, { params: { id: "budget_1" } });
    expect(res.status).toBe(200);
  });
});

// ── DELETE /api/budgets/[id] ─────────────────────────────────────────

describe("DELETE /api/budgets/[id]", () => {
  it("should return 401 when the user is not authenticated", async () => {
    mockAuth.mockRejectedValue(new Error("Unauthenticated"));
    const req = new Request("http://localhost/api/budgets/budget_1", { method: "DELETE" });
    const res = await DELETE(req, { params: { id: "budget_1" } });
    expect(res.status).toBe(401);
  });

  it("should reject deletion of another user's budget", async () => {
    mockDb.budget.findFirst.mockResolvedValue(null);
    const req = new Request("http://localhost/api/budgets/budget_other", { method: "DELETE" });
    const res = await DELETE(req, { params: { id: "budget_other" } });
    expect(res.status).toBe(404);
  });

  it("should return 200 with success:true after deletion", async () => {
    mockDb.budget.findFirst.mockResolvedValue(MOCK_BUDGET);
    mockDb.budget.delete.mockResolvedValue(MOCK_BUDGET);
    const req = new Request("http://localhost/api/budgets/budget_1", { method: "DELETE" });
    const res = await DELETE(req, { params: { id: "budget_1" } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ success: true });
  });
});
