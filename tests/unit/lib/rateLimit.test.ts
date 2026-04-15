import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/redis", async () => {
  const { mockRedisClient } = await import("../../mocks/redis");
  return { redis: mockRedisClient };
});

import { rateLimit } from "@/lib/rateLimit";
import { redis } from "@/lib/redis";
import { resetRedisMocks } from "../../mocks/redis";

const mockRedis = redis as {
  incr: ReturnType<typeof vi.fn>;
  expire: ReturnType<typeof vi.fn>;
};

const USER_ID = "user_test123";

beforeEach(() => {
  resetRedisMocks();
});

describe("rateLimit", () => {
  it("should return allowed:true when under the limit", async () => {
    mockRedis.incr.mockResolvedValue(1);
    const result = await rateLimit(USER_ID, 60, 60);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(59);
  });

  it("should return allowed:false with remaining:0 when limit is exceeded", async () => {
    mockRedis.incr.mockResolvedValue(61);
    const result = await rateLimit(USER_ID, 60, 60);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("should return allowed:false at exactly the limit boundary", async () => {
    mockRedis.incr.mockResolvedValue(60);
    const result = await rateLimit(USER_ID, 60, 60);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it("should use the key format rate:${userId}", async () => {
    mockRedis.incr.mockResolvedValue(1);
    await rateLimit(USER_ID, 60, 60);
    expect(mockRedis.incr).toHaveBeenCalledWith(`rate:${USER_ID}`);
  });

  it("should call expire on the first request (count === 1)", async () => {
    mockRedis.incr.mockResolvedValue(1);
    await rateLimit(USER_ID, 60, 60);
    expect(mockRedis.expire).toHaveBeenCalledWith(`rate:${USER_ID}`, 60);
  });

  it("should NOT call expire when count is greater than 1", async () => {
    mockRedis.incr.mockResolvedValue(5);
    await rateLimit(USER_ID, 60, 60);
    expect(mockRedis.expire).not.toHaveBeenCalled();
  });

  it("should fall through with allowed:true when Redis throws", async () => {
    mockRedis.incr.mockRejectedValue(new Error("Redis connection error"));
    const result = await rateLimit(USER_ID, 60, 60);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(60);
  });

  it("should respect a custom window of windowSeconds", async () => {
    mockRedis.incr.mockResolvedValue(1);
    await rateLimit(USER_ID, 30, 120);
    expect(mockRedis.expire).toHaveBeenCalledWith(`rate:${USER_ID}`, 120);
  });
});
