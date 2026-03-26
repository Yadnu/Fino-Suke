"use client";

import { create } from "zustand";

export type Bill = {
  id: string;
  name: string;
  amount: number;
  frequency: "monthly" | "weekly" | "yearly" | "once";
  dueDay: number;
  nextDueDate: string;
  categoryId: string | null;
  category?: { id: string; name: string; icon: string; color: string } | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type BillState = {
  bills: Bill[];
  isLoading: boolean;
  setBills: (bills: Bill[]) => void;
  addBill: (bill: Bill) => void;
  updateBill: (id: string, updates: Partial<Bill>) => void;
  removeBill: (id: string) => void;
  setLoading: (loading: boolean) => void;
};

export const useBillStore = create<BillState>((set) => ({
  bills: [],
  isLoading: false,

  setBills: (bills) => set({ bills }),

  addBill: (bill) =>
    set((state) => ({
      bills: [bill, ...state.bills],
    })),

  updateBill: (id, updates) =>
    set((state) => ({
      bills: state.bills.map((b) => (b.id === id ? { ...b, ...updates } : b)),
    })),

  removeBill: (id) =>
    set((state) => ({
      bills: state.bills.filter((b) => b.id !== id),
    })),

  setLoading: (loading) => set({ isLoading: loading }),
}));
