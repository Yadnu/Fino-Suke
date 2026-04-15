import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ getAuthenticatedUser: vi.fn() }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: vi.fn() }));
vi.mock("@/lib/db", async () => ({
  default: (await import("../mocks/prisma")).mockPrismaClient,
}));
vi.mock("@/lib/redis", async () => ({
  redis: (await import("../mocks/redis")).mockRedisClient,
}));

import { GET, PATCH } from "@/app/api/settings/route";
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

beforeEach(() => {
  resetPrismaMocks();
  resetRedisMocks();
  mockAuth.mockResolvedValue({ userId: MOCK_USER_ID, user: MOCK_USER });
  mockRateLimit.mockResolvedValue({ allowed: true, remaining: 59 });
});

// ── GET /api/settings ────────────────────────────────────────────────

describe("GET /api/settings", () => {
  it("should return 401 when the user is not authenticated", async () => {
    mockAuth.mockRejectedValue(new Error("Unauthenticated"));
    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toMatchObject({ error: "Unauthorized" });
  });

  it("should return 429 when the rate limit is exceeded", async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, remaining: 0 });
    const res = await GET();
    expect(res.status).toBe(429);
  });

  it("should return 200 with user settings on success", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      name: "Test User",
      email: "test@finosuke.app",
      currency: "USD",
      locale: "en-US",
      timezone: "UTC",
    });
  });

  it("should not expose sensitive fields (avatar only, no Clerk tokens)", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body).not.toHaveProperty("password");
    expect(Object.keys(body)).toEqual(
      expect.arrayContaining(["name", "email", "currency", "locale", "timezone"])
    );
  });
});

// ── PATCH /api/settings ──────────────────────────────────────────────

describe("PATCH /api/settings", () => {
  it("should return 401 when the user is not authenticated", async () => {
    mockAuth.mockRejectedValue(new Error("Unauthenticated"));
    const req = new Request("http://localhost/api/settings", {
      method: "PATCH",
      body: JSON.stringify({ currency: "EUR" }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(401);
  });

  it("should return 429 when the rate limit is exceeded", async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, remaining: 0 });
    const req = new Request("http://localhost/api/settings", {
      method: "PATCH",
      body: JSON.stringify({ currency: "EUR" }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(429);
  });

  it("should return 200 with updated settings on success", async () => {
    const updatedUser = { ...MOCK_USER, currency: "EUR" };
    mockDb.user.update.mockResolvedValue(updatedUser);
    const req = new Request("http://localhost/api/settings", {
      method: "PATCH",
      body: JSON.stringify({ currency: "EUR" }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.currency).toBe("EUR");
  });

  it("should return 400 when the currency is not a 3-letter code", async () => {
    const req = new Request("http://localhost/api/settings", {
      method: "PATCH",
      body: JSON.stringify({ currency: "EURUSD" }), // too long
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it("should invalidate the user cache in Redis after a successful update", async () => {
    mockDb.user.update.mockResolvedValue({ ...MOCK_USER, currency: "EUR" });
    const req = new Request("http://localhost/api/settings", {
      method: "PATCH",
      body: JSON.stringify({ currency: "EUR" }),
    });
    await PATCH(req);
    expect(mockRedis.del).toHaveBeenCalledWith(`user:${MOCK_USER_ID}`);
  });
});
