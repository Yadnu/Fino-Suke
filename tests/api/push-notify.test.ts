import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted ensures these are available when vi.mock() factory runs (which is hoisted)
const { mockSendNotification, mockGetWebPush, mockConfigureWebPush } = vi.hoisted(() => ({
  mockSendNotification: vi.fn(),
  mockGetWebPush: vi.fn(),
  mockConfigureWebPush: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAuthenticatedUser: vi.fn() }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: vi.fn() }));
vi.mock("@/lib/db", async () => ({
  default: (await import("../mocks/prisma")).mockPrismaClient,
}));
vi.mock("@/lib/redis", async () => ({
  redis: (await import("../mocks/redis")).mockRedisClient,
}));
vi.mock("@/lib/webPush", () => ({
  getWebPush: mockGetWebPush,
  configureWebPush: mockConfigureWebPush,
}));

import { POST } from "@/app/api/push/notify/route";
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

const MOCK_SUBSCRIPTION = {
  id: "sub_1",
  userId: MOCK_USER_ID,
  endpoint: "https://push.googleapis.com/v1/fake",
  p256dh: "BNmfakekey",
  auth: "fakeauth",
  createdAt: new Date(),
};

beforeEach(() => {
  resetPrismaMocks();
  resetRedisMocks();
  mockAuth.mockResolvedValue({ userId: MOCK_USER_ID, user: MOCK_USER });
  mockRateLimit.mockResolvedValue({ allowed: true, remaining: 19 });
  mockSendNotification.mockReset();
  mockGetWebPush.mockReset();
  mockConfigureWebPush.mockReset();
});

describe("POST /api/push/notify", () => {
  it("should return 401 when the user is not authenticated", async () => {
    mockAuth.mockRejectedValue(new Error("Unauthenticated"));
    const req = new Request("http://localhost/api/push/notify", {
      method: "POST",
      body: JSON.stringify({ title: "Test" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("should return 429 when the rate limit is exceeded (20/min)", async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, remaining: 0 });
    const req = new Request("http://localhost/api/push/notify", {
      method: "POST",
      body: JSON.stringify({ title: "Test" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(429);
  });

  it("should return 503 when VAPID is not configured", async () => {
    mockGetWebPush.mockReturnValue(null);
    const req = new Request("http://localhost/api/push/notify", {
      method: "POST",
      body: JSON.stringify({ title: "Test" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toContain("configured");
  });

  it("should return 400 when the title is missing", async () => {
    mockGetWebPush.mockReturnValue({ sendNotification: mockSendNotification });
    mockDb.pushSubscription.findMany.mockResolvedValue([]);
    const req = new Request("http://localhost/api/push/notify", {
      method: "POST",
      body: JSON.stringify({ body: "No title" }), // missing required title
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should return 400 when the title exceeds 120 characters", async () => {
    mockGetWebPush.mockReturnValue({ sendNotification: mockSendNotification });
    const req = new Request("http://localhost/api/push/notify", {
      method: "POST",
      body: JSON.stringify({ title: "A".repeat(121) }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should return sent:0 when the user has no push subscriptions", async () => {
    mockGetWebPush.mockReturnValue({ sendNotification: mockSendNotification });
    mockDb.pushSubscription.findMany.mockResolvedValue([]);
    const req = new Request("http://localhost/api/push/notify", {
      method: "POST",
      body: JSON.stringify({ title: "Hello" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sent).toBe(0);
  });

  it("should return sent count matching the number of subscriptions on success", async () => {
    mockGetWebPush.mockReturnValue({ sendNotification: mockSendNotification });
    mockSendNotification.mockResolvedValue(undefined);
    mockDb.pushSubscription.findMany.mockResolvedValue([MOCK_SUBSCRIPTION]);
    const req = new Request("http://localhost/api/push/notify", {
      method: "POST",
      body: JSON.stringify({ title: "Bill due", body: "Netflix is due tomorrow" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sent).toBe(1);
  });

  it("should delete stale subscriptions that respond with 404 or 410", async () => {
    const staleError = Object.assign(new Error("Gone"), { statusCode: 410 });
    mockGetWebPush.mockReturnValue({ sendNotification: mockSendNotification });
    mockSendNotification.mockRejectedValue(staleError);
    mockDb.pushSubscription.findMany.mockResolvedValue([MOCK_SUBSCRIPTION]);
    mockDb.pushSubscription.deleteMany.mockResolvedValue({ count: 1 });
    const req = new Request("http://localhost/api/push/notify", {
      method: "POST",
      body: JSON.stringify({ title: "Hello" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.removed).toBe(1);
    expect(mockDb.pushSubscription.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ["sub_1"] } }),
      })
    );
  });
});
