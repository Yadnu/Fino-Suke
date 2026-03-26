import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const MOCK_TRANSACTIONS = [
  {
    id: "txn_1",
    userId: "user_test123",
    amount: 50.0,
    type: "expense",
    categoryId: "cat_1",
    date: "2024-01-15T00:00:00.000Z",
    notes: "Lunch",
    tags: [],
    isRecurring: false,
    category: { id: "cat_1", name: "Food & Dining", icon: "🍔", color: "#f5c842" },
  },
];

const MOCK_ANALYTICS = {
  month: "2024-01",
  totalIncome: 5000,
  totalExpenses: 2000,
  netSavings: 3000,
  savingsRate: 60,
  incomeTrend: 5,
  expensesTrend: -3,
  categoryBreakdown: [],
  recentTransactions: MOCK_TRANSACTIONS,
};

const MOCK_BILLS = [
  {
    id: "bill_1",
    userId: "user_test123",
    name: "Netflix",
    amount: 15.99,
    frequency: "monthly",
    dueDay: 15,
    nextDueDate: "2024-02-15T00:00:00.000Z",
    categoryId: null,
    notes: null,
    isActive: true,
    category: null,
  },
];

export const handlers = [
  http.get("/api/transactions", () => {
    return HttpResponse.json({
      transactions: MOCK_TRANSACTIONS,
      total: 1,
      page: 1,
      limit: 20,
    });
  }),

  http.post("/api/transactions", () => {
    return HttpResponse.json(MOCK_TRANSACTIONS[0], { status: 201 });
  }),

  http.get("/api/analytics/summary", () => {
    return HttpResponse.json(MOCK_ANALYTICS);
  }),

  http.get("/api/bills", () => {
    return HttpResponse.json({ bills: MOCK_BILLS });
  }),

  http.post("/api/bills/:id/mark-paid", ({ params }) => {
    return HttpResponse.json({ ...MOCK_BILLS[0], id: params.id });
  }),

  http.get("/api/budgets", () => {
    return HttpResponse.json({ budgets: [], month: "2024-01" });
  }),

  http.get("/api/savings", () => {
    return HttpResponse.json({ goals: [] });
  }),

  http.get("/api/categories", () => {
    return HttpResponse.json({ categories: [] });
  }),

  http.get("/api/settings", () => {
    return HttpResponse.json({
      name: "Test User",
      email: "test@finosuke.app",
      currency: "USD",
      locale: "en-US",
      timezone: "UTC",
      avatar: null,
    });
  }),
];

export const server = setupServer(...handlers);
