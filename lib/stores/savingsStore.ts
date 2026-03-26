"use client";

import { create } from "zustand";

export type SavingsGoal = {
  id: string;
  name: string;
  description: string | null;
  targetAmount: number;
  currentAmount: number;
  targetDate: string | null;
  icon: string;
  color: string;
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
};

type SavingsState = {
  goals: SavingsGoal[];
  isLoading: boolean;
  setGoals: (goals: SavingsGoal[]) => void;
  addGoal: (goal: SavingsGoal) => void;
  updateGoal: (id: string, updates: Partial<SavingsGoal>) => void;
  removeGoal: (id: string) => void;
  setLoading: (loading: boolean) => void;
};

export const useSavingsStore = create<SavingsState>((set) => ({
  goals: [],
  isLoading: false,

  setGoals: (goals) => set({ goals }),

  addGoal: (goal) =>
    set((state) => ({
      goals: [goal, ...state.goals],
    })),

  updateGoal: (id, updates) =>
    set((state) => ({
      goals: state.goals.map((g) => (g.id === id ? { ...g, ...updates } : g)),
    })),

  removeGoal: (id) =>
    set((state) => ({
      goals: state.goals.filter((g) => g.id !== id),
    })),

  setLoading: (loading) => set({ isLoading: loading }),
}));
