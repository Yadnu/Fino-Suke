"use client";

import { create } from "zustand";
import type { NetWorthHistoryItem, NetWorthTotals } from "@/lib/networth";

export type NetWorthAccount = {
  id: string;
  userId: string;
  name: string;
  type: string;
  category: string;
  value: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type NetWorthState = {
  accounts: NetWorthAccount[];
  totals: NetWorthTotals;
  history: NetWorthHistoryItem[];
  isLoading: boolean;
  setData: (accounts: NetWorthAccount[], totals: NetWorthTotals, history: NetWorthHistoryItem[]) => void;
  addAccount: (account: NetWorthAccount) => void;
  updateAccount: (id: string, updates: Partial<NetWorthAccount>) => void;
  removeAccount: (id: string) => void;
  setLoading: (loading: boolean) => void;
};

const ZERO_TOTALS: NetWorthTotals = { totalAssets: 0, totalLiabilities: 0, netWorth: 0 };

export const useNetWorthStore = create<NetWorthState>((set) => ({
  accounts: [],
  totals: ZERO_TOTALS,
  history: [],
  isLoading: false,

  setData: (accounts, totals, history) => set({ accounts, totals, history }),

  addAccount: (account) =>
    set((state) => ({ accounts: [...state.accounts, account] })),

  updateAccount: (id, updates) =>
    set((state) => ({
      accounts: state.accounts.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    })),

  removeAccount: (id) =>
    set((state) => ({ accounts: state.accounts.filter((a) => a.id !== id) })),

  setLoading: (loading) => set({ isLoading: loading }),
}));
