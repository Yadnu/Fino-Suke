import { redis } from "@/lib/redis";

/**
 * Sliding window rate limiter using INCR + EXPIRE.
 * On Redis failure, falls through with `allowed: true` so infra issues never
 * block legitimate requests.
 */
export async function rateLimit(
  userId: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number }> {
  const key = `rate:${userId}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, windowSeconds);
    }
    const remaining = Math.max(0, limit - count);
    return { allowed: count <= limit, remaining };
  } catch {
    return { allowed: true, remaining: limit };
  }
}
