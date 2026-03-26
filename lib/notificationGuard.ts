import { redis } from "@/lib/redis";

const TTL = 86400;

/**
 * Returns true if a bill reminder should be sent for the given user/bill/day.
 * Prevents duplicate notifications within the same calendar day.
 */
export async function shouldNotify(
  userId: string,
  billId: string,
  today: string
): Promise<boolean> {
  try {
    const key = `bill-notified:${userId}:${billId}:${today}`;
    const exists = await redis.exists(key);
    return exists === 0;
  } catch {
    return true;
  }
}

/**
 * Marks a bill as notified for today, expiring after 24 hours.
 */
export async function markNotified(
  userId: string,
  billId: string,
  today: string
): Promise<void> {
  try {
    const key = `bill-notified:${userId}:${billId}:${today}`;
    await redis.set(key, "1", { ex: TTL });
  } catch {
    // silent fail
  }
}
