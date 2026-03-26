import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ getAuthenticatedUser: vi.fn() }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: vi.fn() }));
vi.mock("@/lib/db", async () => ({
  default: (await import("../mocks/prisma")).mockPrismaClient,
}));
vi.mock("@/lib/redis", async () => ({
  redis: (await import("../mocks/redis")).mockRedisClient,
}));

import { GET, POST } from "@/app/api/savings/route";
import { PATCH, DELETE } from "@/app/api/savings/[id]/route";
import { POST as DEPOSIT } from "@/app/api/savings/[id]/deposit/route";
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

const MOCK_GOAL = {
  id: "goal_1",
  userId: MOCK_USER_ID,
  name: "Emergency Fund",
  description: null,
  targetAmount: 10000,
  currentAmount: 2500,
  targetDate: null,
  icon: "🎯",
  color: "#f5c842",
  isCompleted: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  resetPrismaMocks();
  resetRedisMocks();
  mockAuth.mockResolvedValue({ userId: MOCK_USER_ID, user: MOCK_USER });
  mockRateLimit.mockResolvedValue({ allowed: true, remaining: 59 });
});

// ── GET /api/savings ─────────────────────────────────────────────────

describe("GET /api/savings", () => {
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

  it("should return 200 with goals array on success", async () => {
    mockDb.savingsGoal.findMany.mockResolvedValue([MOCK_GOAL]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ goals: expect.any(Array) });
  });

  it("should return only the current user's goals", async () => {
    mockDb.savingsGoal.findMany.mockResolvedValue([MOCK_GOAL]);
    await GET();
    expect(mockDb.savingsGoal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: MOCK_USER_ID }),
      })
    );
  });
});

// ── POST /api/savings ────────────────────────────────────────────────

describe("POST /api/savings", () => {
  it("should return 401 when the user is not authenticated", async () => {
    mockAuth.mockRejectedValue(new Error("Unauthenticated"));
    const req = new Request("http://localhost/api/savings", {
      method: "POST",
      body: JSON.stringify({ name: "Emergency Fund", targetAmount: 10000 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("should return 201 with the created goal on success", async () => {
    mockDb.savingsGoal.create.mockResolvedValue(MOCK_GOAL);
    const req = new Request("http://localhost/api/savings", {
      method: "POST",
      body: JSON.stringify({ name: "Emergency Fund", targetAmount: 10000 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ name: "Emergency Fund" });
  });

  it("should return 400 when the target amount is missing", async () => {
    const req = new Request("http://localhost/api/savings", {
      method: "POST",
      body: JSON.stringify({ name: "Emergency Fund" }), // missing targetAmount
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

// ── PATCH /api/savings/[id] ──────────────────────────────────────────

describe("PATCH /api/savings/[id]", () => {
  it("should return 401 when the user is not authenticated", async () => {
    mockAuth.mockRejectedValue(new Error("Unauthenticated"));
    const req = new Request("http://localhost/api/savings/goal_1", {
      method: "PATCH",
      body: JSON.stringify({ name: "New Name" }),
    });
    const res = await PATCH(req, { params: { id: "goal_1" } });
    expect(res.status).toBe(401);
  });

  it("should reject modification of another user's goal (cross-user check)", async () => {
    mockDb.savingsGoal.findFirst.mockResolvedValue(null);
    const req = new Request("http://localhost/api/savings/goal_other", {
      method: "PATCH",
      body: JSON.stringify({ name: "Hacked" }),
    });
    const res = await PATCH(req, { params: { id: "goal_other" } });
    expect(res.status).toBe(404);
    expect(mockDb.savingsGoal.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: MOCK_USER_ID }),
      })
    );
  });

  it("should return 200 with the updated goal on success", async () => {
    mockDb.savingsGoal.findFirst.mockResolvedValue(MOCK_GOAL);
    mockDb.savingsGoal.update.mockResolvedValue({ ...MOCK_GOAL, name: "New Name" });
    const req = new Request("http://localhost/api/savings/goal_1", {
      method: "PATCH",
      body: JSON.stringify({ name: "New Name" }),
    });
    const res = await PATCH(req, { params: { id: "goal_1" } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("New Name");
  });
});

// ── DELETE /api/savings/[id] ─────────────────────────────────────────

describe("DELETE /api/savings/[id]", () => {
  it("should return 401 when the user is not authenticated", async () => {
    mockAuth.mockRejectedValue(new Error("Unauthenticated"));
    const req = new Request("http://localhost/api/savings/goal_1", { method: "DELETE" });
    const res = await DELETE(req, { params: { id: "goal_1" } });
    expect(res.status).toBe(401);
  });

  it("should reject deletion of another user's goal", async () => {
    mockDb.savingsGoal.findFirst.mockResolvedValue(null);
    const req = new Request("http://localhost/api/savings/goal_other", { method: "DELETE" });
    const res = await DELETE(req, { params: { id: "goal_other" } });
    expect(res.status).toBe(404);
  });

  it("should return 200 with success:true after deletion", async () => {
    mockDb.savingsGoal.findFirst.mockResolvedValue(MOCK_GOAL);
    mockDb.savingsGoal.delete.mockResolvedValue(MOCK_GOAL);
    const req = new Request("http://localhost/api/savings/goal_1", { method: "DELETE" });
    const res = await DELETE(req, { params: { id: "goal_1" } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ success: true });
  });
});

// ── POST /api/savings/[id]/deposit ───────────────────────────────────

describe("POST /api/savings/[id]/deposit", () => {
  it("should return 401 when the user is not authenticated", async () => {
    mockAuth.mockRejectedValue(new Error("Unauthenticated"));
    const req = new Request("http://localhost/api/savings/goal_1/deposit", {
      method: "POST",
      body: JSON.stringify({ amount: 500 }),
    });
    const res = await DEPOSIT(req, { params: { id: "goal_1" } });
    expect(res.status).toBe(401);
  });

  it("should return 404 when the goal does not belong to the current user", async () => {
    mockDb.savingsGoal.findFirst.mockResolvedValue(null);
    const req = new Request("http://localhost/api/savings/goal_other/deposit", {
      method: "POST",
      body: JSON.stringify({ amount: 500 }),
    });
    const res = await DEPOSIT(req, { params: { id: "goal_other" } });
    expect(res.status).toBe(404);
  });

  it("should return 400 when deposit amount is zero or negative", async () => {
    mockDb.savingsGoal.findFirst.mockResolvedValue(MOCK_GOAL);
    const req = new Request("http://localhost/api/savings/goal_1/deposit", {
      method: "POST",
      body: JSON.stringify({ amount: 0 }),
    });
    const res = await DEPOSIT(req, { params: { id: "goal_1" } });
    expect(res.status).toBe(400);
  });

  it("should update currentAmount and return 200 on a valid deposit", async () => {
    mockDb.savingsGoal.findFirst.mockResolvedValue(MOCK_GOAL);
    const updated = { ...MOCK_GOAL, currentAmount: 3000, isCompleted: false };
    mockDb.savingsGoal.update.mockResolvedValue(updated);
    const req = new Request("http://localhost/api/savings/goal_1/deposit", {
      method: "POST",
      body: JSON.stringify({ amount: 500 }),
    });
    const res = await DEPOSIT(req, { params: { id: "goal_1" } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.currentAmount).toBe(3000);
  });

  it("should auto-complete the goal when currentAmount reaches targetAmount", async () => {
    // currentAmount=9500, deposit=500 → reaches targetAmount=10000
    const nearlyDoneGoal = { ...MOCK_GOAL, currentAmount: 9500, targetAmount: 10000 };
    mockDb.savingsGoal.findFirst.mockResolvedValue(nearlyDoneGoal);
    const completed = { ...nearlyDoneGoal, currentAmount: 10000, isCompleted: true };
    mockDb.savingsGoal.update.mockResolvedValue(completed);
    const req = new Request("http://localhost/api/savings/goal_1/deposit", {
      method: "POST",
      body: JSON.stringify({ amount: 500 }),
    });
    const res = await DEPOSIT(req, { params: { id: "goal_1" } });
    const body = await res.json();
    expect(body.isCompleted).toBe(true);
    // Verify update was called with isCompleted: true
    expect(mockDb.savingsGoal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isCompleted: true }),
      })
    );
  });
});
