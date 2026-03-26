"use client";

import { create } from "zustand";

export type Transaction = {
  id: string;
  amount: number;
  type: "expense" | "income";
  categoryId: string | null;
  category?: { id: string; name: string; icon: string; color: string } | null;
  date: string;
  notes: string | null;
  tags: string[];
  isRecurring: boolean;
  createdAt: string;
};

type TransactionState = {
  transactions: Transaction[];
  isLoading: boolean;
  total: number;
  page: number;
  // Actions
  setTransactions: (transactions: Transaction[], total: number) => void;
  addTransaction: (transaction: Transaction) => void;
  updateTransaction: (id: string, updates: Partial<Transaction>) => void;
  removeTransaction: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setPage: (page: number) => void;
};

export const useTransactionStore = create<TransactionState>((set) => ({
  transactions: [],
  isLoading: false,
  total: 0,
  page: 1,

  setTransactions: (transactions, total) =>
    set({ transactions, total }),

  addTransaction: (transaction) =>
    set((state) => ({
      transactions: [transaction, ...state.transactions],
      total: state.total + 1,
    })),

  updateTransaction: (id, updates) =>
    set((state) => ({
      transactions: state.transactions.map((t) =>
        t.id === id ? { ...t, ...updates } : t
      ),
    })),

  removeTransaction: (id) =>
    set((state) => ({
      transactions: state.transactions.filter((t) => t.id !== id),
      total: Math.max(0, state.total - 1),
    })),

  setLoading: (loading) => set({ isLoading: loading }),
  setPage: (page) => set({ page }),
}));
