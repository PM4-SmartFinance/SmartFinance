import { create } from "zustand";

interface TransactionsStore {
  page: number;
  limit: number;
  sortBy: "date" | "amount" | "merchant";
  sortOrder: "asc" | "desc";
  startDate: string | null;
  endDate: string | null;
  categoryId: string | null;

  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  setSortBy: (field: "date" | "amount" | "merchant") => void;
  toggleSortOrder: () => void;
  setStartDate: (date: string | null) => void;
  setEndDate: (date: string | null) => void;
  setCategoryId: (categoryId: string | null) => void;
  resetFilters: () => void;
}

const INITIAL_STATE = {
  page: 1,
  limit: 20,
  sortBy: "date" as const,
  sortOrder: "desc" as const,
  startDate: null,
  endDate: null,
  categoryId: null,
};

export const useTransactionsStore = create<TransactionsStore>((set) => ({
  ...INITIAL_STATE,

  setPage: (page) => set({ page }),
  setLimit: (limit) => set({ limit, page: 1 }),
  setSortBy: (sortBy) =>
    set((state) => ({
      sortBy,
      sortOrder: state.sortBy === sortBy && state.sortOrder === "desc" ? "asc" : "desc",
    })),
  toggleSortOrder: () =>
    set((state) => ({
      sortOrder: state.sortOrder === "desc" ? "asc" : "desc",
    })),
  setStartDate: (startDate) => set({ startDate, page: 1 }),
  setEndDate: (endDate) => set({ endDate, page: 1 }),
  setCategoryId: (categoryId) => set({ categoryId, page: 1 }),
  resetFilters: () => set(INITIAL_STATE),
}));
