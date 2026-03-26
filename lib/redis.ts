/**
 * Upstash Redis singleton client.
 *
 * Use cases and key naming conventions:
 *
 * 1. Rate limiting  — key: `rate:{userId}`
 *    Sliding window counter (INCR + EXPIRE) capping each user to N requests
 *    per time window. On Redis failure the request is always allowed through.
 *
 * 2. Analytics caching  — key: `analytics:{userId}:{YYYY-MM}`
 *    Caches the result of the 6-query Postgres aggregation for 5 minutes (300 s).
 *    Invalidated whenever a transaction for that month is created, updated, or
 *    deleted.
 *
 * 3. User record caching  — key: `user:{clerkUserId}`
 *    Short-lived (60 s) cache of the Prisma user row returned by
 *    `getOrCreateUser`, avoiding repeated DB round-trips on every request.
 *    Invalidated after a successful settings PATCH.
 *
 * 4. Bill-notification deduplication  — key: `bill-notified:{userId}:{billId}:{YYYY-MM-DD}`
 *    TTL 86 400 s (one day). Prevents the same bill reminder from being sent
 *    more than once per day. Managed via `lib/notificationGuard.ts`.
 */

import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});
