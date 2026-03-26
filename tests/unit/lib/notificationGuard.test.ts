import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/redis", async () => {
  const { mockRedisClient } = await import("../../mocks/redis");
  return { redis: mockRedisClient };
});

import { shouldNotify, markNotified } from "@/lib/notificationGuard";
import { redis } from "@/lib/redis";
import { resetRedisMocks } from "../../mocks/redis";

const mockRedis = redis as {
  exists: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
};

const USER_ID = "user_test123";
const BILL_ID = "bill_abc";
const TODAY = "2024-01-15";
const EXPECTED_KEY = `bill-notified:${USER_ID}:${BILL_ID}:${TODAY}`;

beforeEach(() => {
  resetRedisMocks();
});

describe("shouldNotify", () => {
  it("should return true when the deduplication key does not exist in Redis", async () => {
    mockRedis.exists.mockResolvedValue(0);
    const result = await shouldNotify(USER_ID, BILL_ID, TODAY);
    expect(result).toBe(true);
  });

  it("should return false when the deduplication key already exists in Redis", async () => {
    mockRedis.exists.mockResolvedValue(1);
    const result = await shouldNotify(USER_ID, BILL_ID, TODAY);
    expect(result).toBe(false);
  });

  it("should use the key format bill-notified:${userId}:${billId}:${YYYY-MM-DD}", async () => {
    mockRedis.exists.mockResolvedValue(0);
    await shouldNotify(USER_ID, BILL_ID, TODAY);
    expect(mockRedis.exists).toHaveBeenCalledWith(EXPECTED_KEY);
  });

  it("should fail open (return true) when Redis throws", async () => {
    mockRedis.exists.mockRejectedValue(new Error("Redis timeout"));
    const result = await shouldNotify(USER_ID, BILL_ID, TODAY);
    expect(result).toBe(true);
  });
});

describe("markNotified", () => {
  it("should set the deduplication key with a 24-hour TTL", async () => {
    await markNotified(USER_ID, BILL_ID, TODAY);
    expect(mockRedis.set).toHaveBeenCalledWith(EXPECTED_KEY, "1", { ex: 86400 });
  });

  it("should use the key format bill-notified:${userId}:${billId}:${YYYY-MM-DD}", async () => {
    await markNotified(USER_ID, BILL_ID, TODAY);
    expect(mockRedis.set).toHaveBeenCalledWith(EXPECTED_KEY, "1", expect.any(Object));
  });

  it("should silently swallow Redis errors without throwing", async () => {
    mockRedis.set.mockRejectedValue(new Error("Redis offline"));
    await expect(markNotified(USER_ID, BILL_ID, TODAY)).resolves.toBeUndefined();
  });
});
