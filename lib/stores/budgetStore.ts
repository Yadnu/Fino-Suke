"use client";

import { create } from "zustand";

export type Budget = {
  id: string;
  name: string;
  categoryId: string | null;
  category?: { id: string; name: string; icon: string; color: string } | null;
  amount: number;
  period: "weekly" | "monthly";
  month: string;
  rollover: boolean;
  spent?: number;
  createdAt: string;
};

type BudgetState = {
  budgets: Budget[];
  isLoading: boolean;
  // Actions
  setBudgets: (budgets: Budget[]) => void;
  addBudget: (budget: Budget) => void;
  updateBudget: (id: string, updates: Partial<Budget>) => void;
  removeBudget: (id: string) => void;
  setLoading: (loading: boolean) => void;
};

export const useBudgetStore = create<BudgetState>((set) => ({
  budgets: [],
  isLoading: false,

  setBudgets: (budgets) => set({ budgets }),

  addBudget: (budget) =>
    set((state) => ({
      budgets: [...state.budgets, budget],
    })),

  updateBudget: (id, updates) =>
    set((state) => ({
      budgets: state.budgets.map((b) =>
        b.id === id ? { ...b, ...updates } : b
      ),
    })),

  removeBudget: (id) =>
    set((state) => ({
      budgets: state.budgets.filter((b) => b.id !== id),
    })),

  setLoading: (loading) => set({ isLoading: loading }),
}));
