# Finosuke — Phase 4 Completion Plan

## Status snapshot

| Area | Done so far | Remaining |
|------|-------------|-----------|
| CSV Import/Export | ✅ Complete | — |
| PWA | SW caching, offline fallback, install prompt, push notifications | SW update banner ✅, background sync |
| Multi-currency | Settings UI, UserSettingsContext, formatCurrency helpers, pages wired to useUserSettings | Exchange rate API, per-transaction currency field, conversion in analytics/dashboard |

---

## PWA

### ✅ SW update notification banner
- `components/layout/SwUpdateBanner.tsx` — listens for a waiting SW, shows a teal banner with "Reload now"
- `worker/index.ts` — handles `SKIP_WAITING` message to activate the new SW
- `components/layout/AppShell.tsx` — renders `<SwUpdateBanner />`

### ⬜ Background sync for offline mutations
- `lib/offlineQueue.ts` — IndexedDB helper: `enqueue(request)`, `dequeue()`, `getAll()`
- `worker/index.ts` — register `sync` tag `finosuke-mutations`; on `sync` event drain the queue and replay each stored request
- `hooks/useOfflineMutation.ts` — wraps `fetch` so failed writes (no network) are persisted to IndexedDB and a sync is registered; exposes `pendingCount`
- `components/layout/OfflineBanner.tsx` — extend to show `X pending changes` badge when `pendingCount > 0`
- Wire `useOfflineMutation` into the transaction add/edit/delete handlers

---

## Multi-currency

### ⬜ Exchange rate API + Redis cache
- `app/api/rates/route.ts` — `GET /api/rates?base=USD` fetches from Frankfurter (`api.frankfurter.app/latest?from={base}`), caches the response in Redis for 1 hour, returns `{ base, rates, updatedAt }`
- Add `/api/rates` to the SW `NetworkFirst` cache list in `next.config.mjs`

### ⬜ Currency conversion utilities
- `lib/currency.ts`
  - `convertAmount(amount, fromCurrency, toCurrency, rates)` — converts using fetched rates
  - `getDisplayAmount(amount, txCurrency, userCurrency, rates)` — returns amount in user's base currency
- Update `UserSettingsContext` to also fetch rates from `/api/rates` and expose them via context

### ⬜ Per-transaction currency (schema)
- `prisma/schema.prisma` — add `currency String @default("USD")` to `Transaction` model
- Run `npx prisma db push` (or generate migration)
- Update `app/api/transactions/route.ts` — accept and store `currency` on create/update; return it on read

### ⬜ Currency selector in transaction form
- `components/forms/TransactionForm.tsx` — add a `<Select>` for currency (same `CURRENCIES` list as settings); default to user's `currency` from `useUserSettings`
- Zod schema — add `currency: z.string().length(3)`

### ⬜ Convert to base currency in analytics & dashboard
- All pages/components that sum `amount` fields must convert each transaction's `currency` → user's base currency before summing
- Affected: `app/(protected)/analytics/page.tsx`, `app/(protected)/budget/page.tsx`, `app/(protected)/dashboard/*`, `components/dashboard/*`, `app/(protected)/expenses/page.tsx`, `app/(protected)/income/page.tsx`
- Strategy: pull rates from context, map each transaction through `getDisplayAmount`, then aggregate

---

## Finish line

- Update `README.md` — mark Phase 4 as ✅ Complete and Phase 5 as current
- Bump Phase 5 description: Bank Sync (Plaid), Advanced AI (tool-calling, spending insights)
