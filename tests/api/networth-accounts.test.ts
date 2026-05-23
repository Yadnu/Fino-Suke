import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ getAuthenticatedUser: vi.fn() }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: vi.fn() }));
vi.mock("@/lib/db", async () => ({
  default: (await import("../mocks/prisma")).mockPrismaClient,
}));
vi.mock("@/lib/redis", async () => ({
  redis: (await import("../mocks/redis")).mockRedisClient,
}));

import { GET, POST } from "@/app/api/networth/accounts/route";
import { PATCH, DELETE } from "@/app/api/networth/accounts/[id]/route";
import { GET as GET_SUMMARY } from "@/app/api/networth/summary/route";
import { getAuthenticatedUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import prisma from "@/lib/db";
import { resetPrismaMocks } from "../mocks/prisma";
import { resetRedisMocks } from "../mocks/redis";

const mockAuth = vi.mocked(getAuthenticatedUser);
const mockRateLimit = vi.mocked(rateLimit);
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

const MOCK_ACCOUNT = {
  id: "nw_1",
  userId: USER_ID,
  name: "Checking Account",
  type: "asset",
  category: "cash",
  value: 5000,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const MOCK_LIABILITY = {
  id: "nw_2",
  userId: USER_ID,
  name: "Car Loan",
  type: "liability",
  category: "loan",
  value: 8000,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const makeReq = (url: string, body?: unknown) =>
  new Request(url, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

beforeEach(() => {
  resetPrismaMocks();
  resetRedisMocks();
  mockAuth.mockResolvedValue({ userId: USER_ID, user: MOCK_USER, clerkUserId: USER_ID });
  mockRateLimit.mockResolvedValue({ allowed: true, remaining: 59 });
  // Snapshot upsert is called after mutations — mock it to avoid errors
  mockDb.netWorthAccount.findMany.mockResolvedValue([]);
  mockDb.netWorthSnapshot.upsert.mockResolvedValue({} as never);
});

// ── GET /api/networth/accounts ────────────────────────────────────────────────

describe("GET /api/networth/accounts", () => {
  it("should return 401 when unauthenticated", async () => {
    mockAuth.mockRejectedValue(new Error("Unauthenticated"));
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("should return 429 when rate limit exceeded", async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, remaining: 0 });
    const res = await GET();
    expect(res.status).toBe(429);
  });

  it("should return 200 with accounts array on success", async () => {
    mockDb.netWorthAccount.findMany.mockResolvedValue([MOCK_ACCOUNT]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ accounts: expect.any(Array) });
  });

  it("should scope query to the authenticated user", async () => {
    mockDb.netWorthAccount.findMany.mockResolvedValue([]);
    await GET();
    expect(mockDb.netWorthAccount.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: USER_ID }),
      })
    );
  });
});

// ── POST /api/networth/accounts ───────────────────────────────────────────────

describe("POST /api/networth/accounts", () => {
  const VALID_ASSET = { name: "Savings", type: "asset", category: "cash", value: 10000 };
  const VALID_LIABILITY = { name: "Mortgage", type: "liability", category: "mortgage", value: 200000 };

  it("should return 401 when unauthenticated", async () => {
    mockAuth.mockRejectedValue(new Error("Unauthenticated"));
    const res = await POST(makeReq("http://localhost/api/networth/accounts", VALID_ASSET));
    expect(res.status).toBe(401);
  });

  it("should return 429 when rate limit exceeded", async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, remaining: 0 });
    const res = await POST(makeReq("http://localhost/api/networth/accounts", VALID_ASSET));
    expect(res.status).toBe(429);
  });

  it("should return 201 with the created asset on success", async () => {
    mockDb.netWorthAccount.create.mockResolvedValue(MOCK_ACCOUNT);
    const res = await POST(makeReq("http://localhost/api/networth/accounts", VALID_ASSET));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ name: "Checking Account" });
  });

  it("should return 201 with a created liability on success", async () => {
    mockDb.netWorthAccount.create.mockResolvedValue(MOCK_LIABILITY);
    const res = await POST(makeReq("http://localhost/api/networth/accounts", VALID_LIABILITY));
    expect(res.status).toBe(201);
  });

  it("should scope the created account to the authenticated user", async () => {
    mockDb.netWorthAccount.create.mockResolvedValue(MOCK_ACCOUNT);
    await POST(makeReq("http://localhost/api/networth/accounts", VALID_ASSET));
    expect(mockDb.netWorthAccount.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: USER_ID }),
      })
    );
  });

  it("should return 400 when name is missing", async () => {
    const res = await POST(makeReq("http://localhost/api/networth/accounts", { type: "asset", category: "cash", value: 100 }));
    expect(res.status).toBe(400);
  });

  it("should return 400 when an asset category is used with liability type", async () => {
    const res = await POST(makeReq("http://localhost/api/networth/accounts", {
      name: "Bad",
      type: "liability",
      category: "cash", // asset category
      value: 100,
    }));
    expect(res.status).toBe(400);
  });

  it("should return 400 when a liability category is used with asset type", async () => {
    const res = await POST(makeReq("http://localhost/api/networth/accounts", {
      name: "Bad",
      type: "asset",
      category: "credit_card", // liability category
      value: 100,
    }));
    expect(res.status).toBe(400);
  });

  it("should return 400 when value is negative", async () => {
    const res = await POST(makeReq("http://localhost/api/networth/accounts", { name: "X", type: "asset", category: "cash", value: -1 }));
    expect(res.status).toBe(400);
  });

  it("should call snapshot upsert after creating an account", async () => {
    mockDb.netWorthAccount.create.mockResolvedValue(MOCK_ACCOUNT);
    await POST(makeReq("http://localhost/api/networth/accounts", VALID_ASSET));
    expect(mockDb.netWorthSnapshot.upsert).toHaveBeenCalled();
  });
});

// ── PATCH /api/networth/accounts/[id] ────────────────────────────────────────

describe("PATCH /api/networth/accounts/[id]", () => {
  const makeReqPatch = (body: unknown) =>
    new Request("http://localhost/api/networth/accounts/nw_1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  it("should return 401 when unauthenticated", async () => {
    mockAuth.mockRejectedValue(new Error("Unauthenticated"));
    const res = await PATCH(makeReqPatch({ value: 6000 }), { params: { id: "nw_1" } });
    expect(res.status).toBe(401);
  });

  it("should return 404 when the account does not exist", async () => {
    mockDb.netWorthAccount.findFirst.mockResolvedValue(null);
    const res = await PATCH(makeReqPatch({ value: 6000 }), { params: { id: "nw_1" } });
    expect(res.status).toBe(404);
  });

  it("should return 404 when the account belongs to a different user", async () => {
    mockDb.netWorthAccount.findFirst.mockResolvedValue(null); // findFirst scoped by userId returns null
    const res = await PATCH(makeReqPatch({ value: 6000 }), { params: { id: "nw_other" } });
    expect(res.status).toBe(404);
  });

  it("should return 200 with updated account on success", async () => {
    mockDb.netWorthAccount.findFirst.mockResolvedValue(MOCK_ACCOUNT);
    mockDb.netWorthAccount.update.mockResolvedValue({ ...MOCK_ACCOUNT, value: 6000 });
    const res = await PATCH(makeReqPatch({ value: 6000 }), { params: { id: "nw_1" } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ value: 6000 });
  });

  it("should call snapshot upsert after updating an account", async () => {
    mockDb.netWorthAccount.findFirst.mockResolvedValue(MOCK_ACCOUNT);
    mockDb.netWorthAccount.update.mockResolvedValue({ ...MOCK_ACCOUNT, value: 6000 });
    await PATCH(makeReqPatch({ value: 6000 }), { params: { id: "nw_1" } });
    expect(mockDb.netWorthSnapshot.upsert).toHaveBeenCalled();
  });
});

// ── DELETE /api/networth/accounts/[id] ───────────────────────────────────────

describe("DELETE /api/networth/accounts/[id]", () => {
  const makeReqDelete = () =>
    new Request("http://localhost/api/networth/accounts/nw_1", { method: "DELETE" });

  it("should return 401 when unauthenticated", async () => {
    mockAuth.mockRejectedValue(new Error("Unauthenticated"));
    const res = await DELETE(makeReqDelete(), { params: { id: "nw_1" } });
    expect(res.status).toBe(401);
  });

  it("should return 404 when the account does not exist", async () => {
    mockDb.netWorthAccount.findFirst.mockResolvedValue(null);
    const res = await DELETE(makeReqDelete(), { params: { id: "nw_1" } });
    expect(res.status).toBe(404);
  });

  it("should return 200 with success true on deletion", async () => {
    mockDb.netWorthAccount.findFirst.mockResolvedValue(MOCK_ACCOUNT);
    mockDb.netWorthAccount.delete.mockResolvedValue(MOCK_ACCOUNT);
    const res = await DELETE(makeReqDelete(), { params: { id: "nw_1" } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ success: true });
  });

  it("should call snapshot upsert after deleting an account", async () => {
    mockDb.netWorthAccount.findFirst.mockResolvedValue(MOCK_ACCOUNT);
    mockDb.netWorthAccount.delete.mockResolvedValue(MOCK_ACCOUNT);
    await DELETE(makeReqDelete(), { params: { id: "nw_1" } });
    expect(mockDb.netWorthSnapshot.upsert).toHaveBeenCalled();
  });
});

// ── GET /api/networth/summary ─────────────────────────────────────────────────

describe("GET /api/networth/summary", () => {
  it("should return 401 when unauthenticated", async () => {
    mockAuth.mockRejectedValue(new Error("Unauthenticated"));
    const res = await GET_SUMMARY();
    expect(res.status).toBe(401);
  });

  it("should return 429 when rate limit exceeded", async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, remaining: 0 });
    const res = await GET_SUMMARY();
    expect(res.status).toBe(429);
  });

  it("should return 200 with totals, accounts, and history on success", async () => {
    mockDb.netWorthAccount.findMany.mockResolvedValue([MOCK_ACCOUNT, MOCK_LIABILITY]);
    mockDb.netWorthSnapshot.findMany.mockResolvedValue([]);
    const res = await GET_SUMMARY();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      totals: { totalAssets: 5000, totalLiabilities: 8000, netWorth: -3000 },
      accounts: expect.any(Array),
      history: expect.any(Array),
    });
  });
});
