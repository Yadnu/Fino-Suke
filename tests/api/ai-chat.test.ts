import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ getAuthenticatedUser: vi.fn() }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: vi.fn() }));
vi.mock("@/lib/db", async () => ({
  default: (await import("../mocks/prisma")).mockPrismaClient,
}));
vi.mock("@/lib/redis", async () => ({
  redis: (await import("../mocks/redis")).mockRedisClient,
}));
vi.mock("@/lib/ai", () => ({ callAI: vi.fn() }));

import { POST } from "@/app/api/ai/chat/route";
import { getAuthenticatedUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { callAI } from "@/lib/ai";
import prisma from "@/lib/db";
import { resetPrismaMocks } from "../mocks/prisma";
import { resetRedisMocks } from "../mocks/redis";

const mockAuth = vi.mocked(getAuthenticatedUser);
const mockRateLimit = vi.mocked(rateLimit);
const mockCallAI = vi.mocked(callAI);
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

const makeReq = (body: unknown) =>
  new Request("http://localhost/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  resetPrismaMocks();
  resetRedisMocks();
  mockAuth.mockResolvedValue({ userId: USER_ID, user: MOCK_USER, clerkUserId: USER_ID });
  mockRateLimit.mockResolvedValue({ allowed: true, remaining: 19 });
});

// ── Auth & rate limit guards ──────────────────────────────────────────────────

describe("POST /api/ai/chat — auth & rate limit", () => {
  it("should return 401 when unauthenticated", async () => {
    mockAuth.mockRejectedValue(new Error("Unauthenticated"));
    const res = await POST(makeReq({ message: "Hello" }));
    expect(res.status).toBe(401);
  });

  it("should return 429 when rate limit exceeded", async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, remaining: 0 });
    const res = await POST(makeReq({ message: "Hello" }));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body).toMatchObject({ error: "Too many requests" });
  });
});

// ── Validation ────────────────────────────────────────────────────────────────

describe("POST /api/ai/chat — validation", () => {
  it("should return 400 when message is missing", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("should return 400 when message is empty string", async () => {
    const res = await POST(makeReq({ message: "" }));
    expect(res.status).toBe(400);
  });

  it("should return 400 when message exceeds 2000 characters", async () => {
    const res = await POST(makeReq({ message: "a".repeat(2001) }));
    expect(res.status).toBe(400);
  });

  it("should return 400 when history contains an invalid role", async () => {
    const res = await POST(
      makeReq({ message: "Hi", history: [{ role: "system", content: "x" }] })
    );
    expect(res.status).toBe(400);
  });

  it("should accept a valid message with no history", async () => {
    mockCallAI.mockResolvedValue({ type: "answer", content: "Hello!" });
    const res = await POST(makeReq({ message: "How much did I spend?" }));
    expect(res.status).toBe(200);
  });
});

// ── Plain answer flow ─────────────────────────────────────────────────────────

describe("POST /api/ai/chat — plain answer", () => {
  it("should return the AI answer on a successful question", async () => {
    mockCallAI.mockResolvedValue({
      type: "answer",
      content: "You spent $450 on food this month.",
    });
    const res = await POST(makeReq({ message: "How much on food?" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ type: "answer", content: expect.stringContaining("$450") });
  });

  it("should pass conversation history to callAI", async () => {
    mockCallAI.mockResolvedValue({ type: "answer", content: "Still $450." });
    const history = [{ role: "user", content: "Hi" }, { role: "assistant", content: "Hello!" }];
    await POST(makeReq({ message: "Follow up?", history }));
    expect(mockCallAI).toHaveBeenCalledWith(
      USER_ID,
      "Follow up?",
      history
    );
  });
});

// ── Action proposal flow ──────────────────────────────────────────────────────

describe("POST /api/ai/chat — action proposal", () => {
  it("should return action type and summary when AI proposes an action", async () => {
    mockCallAI.mockResolvedValue({
      type: "action",
      summary: "Create a $200 dining budget for 2024-01",
      proposedAction: {
        type: "create_budget",
        args: { name: "Dining", amount: 200, period: "monthly", month: "2024-01" },
      },
    });
    const res = await POST(makeReq({ message: "Create a $200 dining budget" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.type).toBe("action");
    expect(body.summary).toContain("$200");
  });
});

// ── Confirmed action execution ────────────────────────────────────────────────

describe("POST /api/ai/chat — confirmed action: create_transaction", () => {
  const MOCK_TX = {
    id: "tx_1",
    userId: USER_ID,
    amount: 50,
    type: "expense",
    categoryId: null,
    category: null,
    date: new Date("2024-01-20"),
    notes: "Coffee",
    tags: [],
    isRecurring: false,
    recurringId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("should create a transaction and return action_result on confirmation", async () => {
    mockDb.transaction.create.mockResolvedValue(MOCK_TX);
    const res = await POST(
      makeReq({
        message: "Confirmed",
        history: [],
        confirmedAction: {
          type: "create_transaction",
          args: { amount: 50, type: "expense", date: "2024-01-20", notes: "Coffee" },
          summary: "Create a $50 expense",
        },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.type).toBe("action_result");
    expect(body.summary).toContain("50");
    expect(mockDb.transaction.create).toHaveBeenCalled();
  });

  it("should scope the transaction to the authenticated user", async () => {
    mockDb.transaction.create.mockResolvedValue(MOCK_TX);
    await POST(
      makeReq({
        message: "Confirmed",
        confirmedAction: {
          type: "create_transaction",
          args: { amount: 50, type: "expense", date: "2024-01-20" },
          summary: "Create a $50 expense",
        },
      })
    );
    expect(mockDb.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: USER_ID }),
      })
    );
  });
});

describe("POST /api/ai/chat — confirmed action: create_budget", () => {
  const MOCK_BUDGET = {
    id: "budget_1",
    userId: USER_ID,
    name: "Dining",
    categoryId: null,
    amount: 200,
    period: "monthly",
    month: "2024-01",
    rollover: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("should create a budget and return action_result", async () => {
    mockDb.budget.create.mockResolvedValue(MOCK_BUDGET);
    const res = await POST(
      makeReq({
        message: "Confirmed",
        confirmedAction: {
          type: "create_budget",
          args: { name: "Dining", amount: 200, period: "monthly", month: "2024-01" },
          summary: "Create a $200 dining budget",
        },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.type).toBe("action_result");
    expect(mockDb.budget.create).toHaveBeenCalled();
  });
});

describe("POST /api/ai/chat — confirmed action: update_budget", () => {
  const MOCK_BUDGET = {
    id: "budget_1",
    userId: USER_ID,
    name: "Dining",
    categoryId: null,
    amount: 200,
    period: "monthly",
    month: "2024-01",
    rollover: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("should return 422 when the budget does not belong to the user", async () => {
    mockDb.budget.findFirst.mockResolvedValue(null);
    const res = await POST(
      makeReq({
        message: "Confirmed",
        confirmedAction: {
          type: "update_budget",
          args: { id: "budget_other", amount: 300 },
          summary: "Increase budget",
        },
      })
    );
    expect(res.status).toBe(422);
  });

  it("should update the budget and return action_result when it belongs to the user", async () => {
    mockDb.budget.findFirst.mockResolvedValue(MOCK_BUDGET);
    mockDb.budget.update.mockResolvedValue({ ...MOCK_BUDGET, amount: 300 });
    const res = await POST(
      makeReq({
        message: "Confirmed",
        confirmedAction: {
          type: "update_budget",
          args: { id: "budget_1", amount: 300 },
          summary: "Increase dining budget to $300",
        },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.type).toBe("action_result");
    // Ensure ownership check included userId
    expect(mockDb.budget.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: USER_ID }) })
    );
  });
});

describe("POST /api/ai/chat — confirmed action: create_savings_goal", () => {
  const MOCK_GOAL = {
    id: "goal_1",
    userId: USER_ID,
    name: "Emergency Fund",
    description: null,
    targetAmount: 10000,
    currentAmount: 0,
    targetDate: null,
    icon: "🎯",
    color: "#f5c842",
    isCompleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("should create a savings goal and return action_result", async () => {
    mockDb.savingsGoal.create.mockResolvedValue(MOCK_GOAL);
    const res = await POST(
      makeReq({
        message: "Confirmed",
        confirmedAction: {
          type: "create_savings_goal",
          args: { name: "Emergency Fund", targetAmount: 10000 },
          summary: "Create emergency fund goal",
        },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.type).toBe("action_result");
    expect(mockDb.savingsGoal.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: USER_ID }) })
    );
  });
});

describe("POST /api/ai/chat — confirmed action: create_bill", () => {
  const MOCK_BILL = {
    id: "bill_1",
    userId: USER_ID,
    name: "Netflix",
    amount: 15.99,
    frequency: "monthly",
    dueDay: 15,
    nextDueDate: new Date(),
    categoryId: null,
    category: null,
    notes: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("should create a bill with a computed nextDueDate and return action_result", async () => {
    mockDb.bill.create.mockResolvedValue(MOCK_BILL);
    const res = await POST(
      makeReq({
        message: "Confirmed",
        confirmedAction: {
          type: "create_bill",
          args: { name: "Netflix", amount: 15.99, frequency: "monthly", dueDay: 15 },
          summary: "Add Netflix bill",
        },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.type).toBe("action_result");
    expect(mockDb.bill.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: USER_ID, name: "Netflix", nextDueDate: expect.any(Date) }),
      })
    );
  });
});

// ── Invalid confirmedAction ───────────────────────────────────────────────────

describe("POST /api/ai/chat — invalid confirmedAction", () => {
  it("should return 422 when confirmedAction has an unknown type", async () => {
    const res = await POST(
      makeReq({
        message: "Confirmed",
        confirmedAction: {
          type: "delete_all_data",
          args: {},
          summary: "dangerous",
        },
      })
    );
    expect(res.status).toBe(422);
  });
});

// ── OpenAI unavailable ────────────────────────────────────────────────────────

describe("POST /api/ai/chat — OpenAI key missing", () => {
  it("should return 503 when OPENAI_API_KEY is not set", async () => {
    mockCallAI.mockRejectedValue(
      new Error("OPENAI_API_KEY environment variable is not set")
    );
    const res = await POST(makeReq({ message: "Hello" }));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toContain("OPENAI_API_KEY");
  });
});
