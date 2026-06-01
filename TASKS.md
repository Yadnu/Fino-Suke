# Phase 4 — Remaining Tasks

Each task below is designed to be implemented in a single agent session. Complete them in order, as later tasks depend on earlier ones.

---

## Task 1 — PWA: Background Sync (offline queue infrastructure)

**Goal:** Add IndexedDB-backed offline queue and update the service worker to drain it on reconnect.

**Files to create/edit:**

### Create `lib/offlineQueue.ts`
IndexedDB helper with three exported functions:
- `enqueue(request: { url: string; method: string; body: string; headers: Record<string, string> }): Promise<void>` — stores the request in an IndexedDB object store named `offline-queue`
- `dequeue(): Promise<StoredRequest | null>` — removes and returns the oldest entry
- `getAll(): Promise<StoredRequest[]>` — returns all pending entries without removing them

Use a db name of `finosuke-offline` and store name `requests`. Each entry should have an auto-increment `id`, plus the request fields and a `timestamp`.

### Edit `worker/index.ts`
- Register a background sync tag `finosuke-mutations` after a failed fetch (if `self.registration.sync` is available)
- Add a `sync` event listener: when the tag is `finosuke-mutations`, call `getAll()` from `offlineQueue`, replay each request with `fetch`, and call `dequeue()` for each successful one

---

## Task 2 — PWA: useOfflineMutation hook + OfflineBanner badge

**Goal:** Provide a React hook that wraps fetch for mutation calls, queuing them when offline, and surface the pending count in the UI.

**Depends on:** Task 1 (lib/offlineQueue.ts must exist)

**Files to create/edit:**

### Create `hooks/useOfflineMutation.ts`
- Export `useOfflineMutation()` hook
- Returns `{ mutate, pendingCount }` where:
  - `mutate(url, options)` — tries `fetch(url, options)`; on network failure, calls `enqueue()` from `lib/offlineQueue.ts` and attempts `navigator.serviceWorker.ready.then(sw => sw.sync.register('finosuke-mutations'))`
  - `pendingCount: number` — reads `getAll()` from `lib/offlineQueue.ts` on mount and after each `mutate` call; updates via `useState`

### Edit `components/layout/OfflineBanner.tsx`
- Import `useOfflineMutation` and read `pendingCount`
- When `pendingCount > 0`, show a badge/line such as `{pendingCount} change(s) pending sync` alongside (or below) the existing offline indicator

---

## Task 3 — PWA: Wire useOfflineMutation into transaction handlers

**Goal:** Replace direct `fetch` calls in transaction add/edit/delete with `useOfflineMutation`.

**Depends on:** Task 2 (useOfflineMutation must exist)

**Files to edit:**
- Find all components/pages that perform transaction POST/PATCH/DELETE (likely `components/forms/TransactionForm.tsx` and any inline handlers on the transactions list page)
- Replace `fetch('/api/transactions', ...)` calls with `mutate('/api/transactions', ...)` from `useOfflineMutation()`
- Ensure the existing success/error toast/callback logic is preserved

---

## Task 4 — Multi-currency: Exchange rate API + Redis cache

**Goal:** Add a `/api/rates` endpoint that proxies Frankfurter and caches results in Redis for 1 hour.

**Files to create/edit:**

### Create `app/api/rates/route.ts`
```
GET /api/rates?base=USD
```
- Fetch from `https://api.frankfurter.app/latest?from={base}`
- Cache the result in Redis with key `rates:{base}` and TTL of 3600 seconds
- Return `{ base, rates, updatedAt }` — where `updatedAt` is ISO timestamp
- Use the existing Redis client already used elsewhere in the project (check `lib/redis.ts` or similar)

### Edit `next.config.mjs`
- Add `/api/rates` to the service worker's `NetworkFirst` cache list (wherever `/api/transactions` or similar routes are listed)

---

## Task 5 — Multi-currency: Currency conversion utilities + context

**Goal:** Add pure conversion helpers and expose exchange rates from UserSettingsContext.

**Depends on:** Task 4 (rates API must exist)

**Files to create/edit:**

### Create `lib/currency.ts`
Export two functions:
- `convertAmount(amount: number, fromCurrency: string, toCurrency: string, rates: Record<string, number>): number`
  - If `fromCurrency === toCurrency` return `amount` unchanged
  - Convert via: `amount / rates[fromCurrency] * rates[toCurrency]` (assuming rates are relative to a common base, adjust if Frankfurter returns base-relative rates)
- `getDisplayAmount(amount: number, txCurrency: string, userCurrency: string, rates: Record<string, number>): number`
  - Convenience wrapper around `convertAmount`

### Edit `UserSettingsContext` (wherever it lives, likely `context/UserSettingsContext.tsx`)
- Add a `rates: Record<string, number>` field to the context value
- On mount (and when `settings.currency` changes), fetch from `/api/rates?base=${settings.currency}` and store in state
- Expose `rates` via the context value

---

## Task 6 — Multi-currency: Per-transaction currency (schema + API)

**Goal:** Add a `currency` field to the Transaction model and plumb it through the API.

**Files to edit:**

### Edit `prisma/schema.prisma`
- Add `currency String @default("USD")` to the `Transaction` model

### Run migration
After editing schema, run:
```
npx prisma db push
```

### Edit `app/api/transactions/route.ts`
- **POST** (create): read `currency` from request body, pass it to `prisma.transaction.create`
- **PATCH/PUT** (update): read `currency` from request body, include in `prisma.transaction.update`
- **GET** (read): ensure `currency` is included in the returned fields (Prisma returns all scalar fields by default, so this may need no change)

---

## Task 7 — Multi-currency: Currency selector in TransactionForm

**Goal:** Add a currency dropdown to the transaction form, defaulting to the user's base currency.

**Depends on:** Task 5 (UserSettingsContext must expose `settings.currency`) and Task 6 (API accepts `currency`)

**Files to edit:**

### Edit `components/forms/TransactionForm.tsx` (or equivalent)
- Import `useUserSettings` and read `settings.currency` as default
- Add a `<Select>` field for currency using the same `CURRENCIES` constant already used in the settings page
- Default value: `settings.currency`
- Add to the Zod validation schema: `currency: z.string().length(3)`
- Include `currency` in the form submission payload

---

## Task 8 — Multi-currency: Convert to base currency in analytics & dashboard

**Goal:** Ensure all pages that aggregate transaction amounts convert each transaction to the user's base currency before summing.

**Depends on:** Tasks 5, 6, 7 (rates in context, currency on transactions)

**Files to edit:**
- `app/(protected)/analytics/page.tsx`
- `app/(protected)/budget/page.tsx`
- `app/(protected)/dashboard/*` and `components/dashboard/*`
- `app/(protected)/expenses/page.tsx`
- `app/(protected)/income/page.tsx`

**Strategy for each file:**
1. Import `useUserSettings` and destructure `rates`
2. Import `getDisplayAmount` from `lib/currency.ts`
3. Wherever transactions are mapped/reduced to sum `amount`, wrap each amount: `getDisplayAmount(tx.amount, tx.currency ?? 'USD', settings.currency, rates)`
4. Preserve existing null/loading states — if `rates` is empty (`{}`), treat all amounts as already in base currency (no-op conversion)

---

## Task 9 — Finish line: Update README

**Goal:** Mark Phase 4 complete and describe Phase 5.

**Files to edit:**

### Edit `README.md`
- Find the Phase 4 entry and mark it ✅ Complete
- Add or update Phase 5: **Bank Sync & Advanced AI** — Plaid integration for bank sync, tool-calling AI for spending insights
