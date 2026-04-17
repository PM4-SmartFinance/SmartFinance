import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";

export type BudgetType =
  | "DAILY"
  | "MONTHLY"
  | "YEARLY"
  | "SPECIFIC_MONTH"
  | "SPECIFIC_YEAR"
  | "SPECIFIC_MONTH_YEAR";

export interface Budget {
  id: string;
  categoryId: string;
  type: BudgetType;
  month: number;
  year: number;
  limitAmount: string;
  active: boolean;
  currentSpending: string;
  percentageUsed: number;
  remainingAmount: string;
  isOverBudget: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBudgetInput {
  categoryId: string;
  type: BudgetType;
  limitAmount: number;
  month?: number;
  year?: number;
}

export interface UpdateBudgetInput {
  limitAmount: number;
}

const BUDGETS_QUERY_KEY = ["budgets"] as const;

export function useBudgets() {
  return useQuery({
    queryKey: BUDGETS_QUERY_KEY,
    queryFn: async () => {
      const response = await api.get<{ budgets: Budget[] }>("/budgets");
      return response.budgets;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useCreateBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateBudgetInput) => api.post<{ budget: Budget }>("/budgets", input),
    onSuccess: (response) => {
      queryClient.setQueryData<Budget[]>(BUDGETS_QUERY_KEY, (old) => {
        return old ? [response.budget, ...old] : [response.budget];
      });
    },
    onError: (error) => {
      console.error("[useCreateBudget]", error);
      queryClient.invalidateQueries({ queryKey: BUDGETS_QUERY_KEY });
    },
  });
}

export function useUpdateBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateBudgetInput }) =>
      api.patch<{ budget: Budget }>(`/budgets/${id}`, input),
    onSuccess: (response) => {
      queryClient.setQueryData<Budget[]>(BUDGETS_QUERY_KEY, (old) => {
        return old
          ? old.map((b) => (b.id === response.budget.id ? response.budget : b))
          : [response.budget];
      });
    },
    onError: (error) => {
      console.error("[useUpdateBudget]", error);
      queryClient.invalidateQueries({ queryKey: BUDGETS_QUERY_KEY });
    },
  });
}

export function useDeleteBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete(`/budgets/${id}`),
    onSuccess: (_, id) => {
      queryClient.setQueryData<Budget[]>(BUDGETS_QUERY_KEY, (old) => {
        return old ? old.filter((b) => b.id !== id) : [];
      });
    },
    onError: (error) => {
      console.error("[useDeleteBudget]", error);
      queryClient.invalidateQueries({ queryKey: BUDGETS_QUERY_KEY });
    },
  });
}

/** Human-readable label for a budget type + month/year combo */
export function getBudgetTypeLabel(type: BudgetType, month: number, year: number): string {
  switch (type) {
    case "DAILY":
      return "Daily Budget";
    case "MONTHLY":
      return "Monthly Budget";
    case "YEARLY":
      return "Yearly Budget";
    case "SPECIFIC_MONTH": {
      const name = new Date(2000, month - 1).toLocaleDateString("en-US", { month: "long" });
      return `${name} (recurring)`;
    }
    case "SPECIFIC_YEAR":
      return `${year}`;
    case "SPECIFIC_MONTH_YEAR": {
      const name = new Date(year, month - 1).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
      return name;
    }
  }
}
