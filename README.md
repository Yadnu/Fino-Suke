# Finosuke

A modern personal finance web app built with Next.js 14, TypeScript, Tailwind CSS, and PostgreSQL.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS with custom design system (Sora + DM Sans fonts)
- **Database**: PostgreSQL via Prisma ORM v7
- **Auth**: NextAuth.js (credentials provider with bcrypt)
- **State**: Zustand
- **Charts**: Recharts
- **Forms**: React Hook Form + Zod v4

## Getting Started

### 1. Configure environment variables

Copy `.env.local` and fill in your values:

```bash
DATABASE_URL="postgresql://user:password@host:5432/finosuke?sslmode=require"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-32-char-random-secret"
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
/networth         Net worth tracker (Phase 3)
/ai-assistant     AI chatbot (Phase 3)
/settings         Account preferences
```

Phase 2 routes above are live. Remaining roadmap items are labeled by phase below.

## Development Phases

| Phase | Features |
|-------|----------|
| Phase 1 | Auth, Expense Tracking, Budget Planning, Dashboard |
| Phase 2 | Income, Bills, Savings Goals, Analytics, Settings |
| **Phase 3 (current)** | Net Worth, AI Insights, Chatbot, Gamification |
| Phase 4 | Multi-currency, PWA, CSV Import/Export |
| Phase 5 | Bank Sync (Plaid), Advanced AI |

## Design System

Dark-mode-first with warm gold (`#f5c842`) and teal (`#2dd4bf`) accents on a near-black background (`#0f0f11`).
