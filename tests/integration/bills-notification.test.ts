/**
 * Integration tests:
 * Flow 4: Bill notification first visit → fires + Redis key set
 * Flow 5: Bill notification second visit same day → skipped, Redis key exists
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/redis", async () => ({
  redis: (await import("../mocks/redis")).mockRedisClient,
}));

import { shouldNotify, markNotified } from "@/lib/notificationGuard";
import { redis } from "@/lib/redis";
import { resetRedisMocks } from "../mocks/redis";

const mockRedis = redis as typeof import("../mocks/redis").mockRedisClient;

const USER_ID = "user_test123";
const BILL_ID = "bill_netflix";
const TODAY = "2024-01-15";
const DEDUP_KEY = `bill-notified:${USER_ID}:${BILL_ID}:${TODAY}`;

beforeEach(() => {
  resetRedisMocks();
});

describe("Flow 4: Bill notification — first visit (no prior notification)", () => {
  it("should return true from shouldNotify when the Redis key does not exist", async () => {
    mockRedis.exists.mockResolvedValue(0);
    const result = await shouldNotify(USER_ID, BILL_ID, TODAY);
    expect(result).toBe(true);
  });

  it("should check the correct dedup key in Redis", async () => {
    mockRedis.exists.mockResolvedValue(0);
    await shouldNotify(USER_ID, BILL_ID, TODAY);
    expect(mockRedis.exists).toHaveBeenCalledWith(DEDUP_KEY);
  });

  it("should set the Redis dedup key with 86400s TTL after sending notification", async () => {
    await markNotified(USER_ID, BILL_ID, TODAY);
    expect(mockRedis.set).toHaveBeenCalledWith(DEDUP_KEY, "1", { ex: 86400 });
  });

  it("should complete the full first-visit flow: check → notify → mark", async () => {
    // Step 1: Check if we should notify — key does not exist
    mockRedis.exists.mockResolvedValue(0);
    const canNotify = await shouldNotify(USER_ID, BILL_ID, TODAY);
    expect(canNotify).toBe(true);

    // Step 2: (notification sent by caller — tested separately)
    // Step 3: Mark as notified
    await markNotified(USER_ID, BILL_ID, TODAY);
    expect(mockRedis.set).toHaveBeenCalledWith(DEDUP_KEY, "1", { ex: 86400 });
  });
});

describe("Flow 5: Bill notification — second visit same day (already notified)", () => {
  it("should return false from shouldNotify when the Redis key exists", async () => {
    // Simulate that markNotified was already called earlier today
    mockRedis.exists.mockResolvedValue(1);
    const result = await shouldNotify(USER_ID, BILL_ID, TODAY);
    expect(result).toBe(false);
  });

  it("should NOT attempt to set the dedup key again on a second visit", async () => {
    mockRedis.exists.mockResolvedValue(1);
    await shouldNotify(USER_ID, BILL_ID, TODAY);
    // The caller is responsible for not calling markNotified if shouldNotify returns false
    // But at the guard level, redis.set should NOT be called by shouldNotify itself
    expect(mockRedis.set).not.toHaveBeenCalled();
  });

  it("should use a different key for a different bill on the same day", async () => {
    mockRedis.exists.mockResolvedValue(0);
    await shouldNotify(USER_ID, "bill_other", TODAY);
    expect(mockRedis.exists).toHaveBeenCalledWith(
      `bill-notified:${USER_ID}:bill_other:${TODAY}`
    );
  });

  it("should use a different key for the same bill on a different day", async () => {
    mockRedis.exists.mockResolvedValue(0);
    const nextDay = "2024-01-16";
    await shouldNotify(USER_ID, BILL_ID, nextDay);
    expect(mockRedis.exists).toHaveBeenCalledWith(
      `bill-notified:${USER_ID}:${BILL_ID}:${nextDay}`
    );
  });
});
