import { vi } from "vitest";

export const mockRedisClient = {
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue("OK"),
  del: vi.fn().mockResolvedValue(1),
  incr: vi.fn().mockResolvedValue(1),
  expire: vi.fn().mockResolvedValue(1),
  exists: vi.fn().mockResolvedValue(0),
};

export function resetRedisMocks() {
  mockRedisClient.get.mockReset().mockResolvedValue(null);
  mockRedisClient.set.mockReset().mockResolvedValue("OK");
  mockRedisClient.del.mockReset().mockResolvedValue(1);
  mockRedisClient.incr.mockReset().mockResolvedValue(1);
  mockRedisClient.expire.mockReset().mockResolvedValue(1);
  mockRedisClient.exists.mockReset().mockResolvedValue(0);
}
