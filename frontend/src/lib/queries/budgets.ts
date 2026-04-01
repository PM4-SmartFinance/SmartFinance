import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";

export interface Budget {
  id: string;
  categoryId: string;
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
  month: number;
  year: number;
  limitAmount: number;
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
    onError: () => {
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
    onError: () => {
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
    onError: () => {
      queryClient.invalidateQueries({ queryKey: BUDGETS_QUERY_KEY });
    },
  });
}
