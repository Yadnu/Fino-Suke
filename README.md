# Finosuke

A modern personal finance web app built with Next.js 14, TypeScript, Tailwind CSS, and PostgreSQL.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS with custom design system (Sora + DM Sans fonts)
- **Database**: PostgreSQL via Prisma ORM v7
- **Auth**: Clerk
- **State**: Zustand
- **Charts**: Recharts
- **Forms**: React Hook Form + Zod v4

## Getting Started

### 1. Configure environment variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
DATABASE_URL="postgresql://user:password@host:5432/finosuke?sslmode=require"

# Clerk — from https://dashboard.clerk.com
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# Upstash Redis — from https://console.upstash.com
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# Web Push — run: npx web-push generate-vapid-keys
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...

# OpenAI — required for AI Assistant
OPENAI_API_KEY=sk-...
# Optional — defaults to gpt-4o-mini
OPENAI_MODEL=gpt-4o-mini
```

### 2. Push database schema

```bash
npx prisma db push
```

### 3. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to `/auth/login`.

## App Structure

```
/dashboard        Main overview
/expenses         Expense & income tracking
/budget           Budget planning
/income           Income tracking
/savings          Savings goals
/bills            Bill reminders
/analytics        Reports & charts
/networth         Net worth tracker
/ai-assistant     AI Assistant (finance Q&A + write actions)
/settings         Account preferences
```

All routes above are live. Remaining roadmap items are labeled by phase below.

## Development Phases

| Phase | Features | Status |
|-------|----------|--------|
| Phase 1 | Auth, Expense Tracking, Budget Planning, Dashboard | ✅ Complete |
| Phase 2 | Income, Bills, Savings Goals, Analytics, Settings | ✅ Complete |
| Phase 3 | AI Assistant (Q&A + write actions), Net Worth Tracker | ✅ Complete |
| **Phase 4 (current)** | Multi-currency (~40%), PWA (~50%), CSV Import/Export (✅) | 🔄 In Progress |
| Phase 5 | Bank Sync (Plaid), Advanced AI | — |

## Design System

Dark-mode-first with warm gold (`#f5c842`) and teal (`#2dd4bf`) accents on a near-black background (`#0f0f11`).
