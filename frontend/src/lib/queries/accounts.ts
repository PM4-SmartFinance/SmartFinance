import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";

export interface Account {
  id: string;
  name: string;
  iban: string;
  accountNumber: string | null;
  active: boolean;
}

export interface CreateAccountInput {
  name: string;
  iban: string;
  accountNumber?: string | null;
}

export interface UpdateAccountInput {
  name?: string;
  iban?: string;
  accountNumber?: string | null;
  active?: boolean;
}

interface AccountsResponse {
  accounts: Account[];
}

interface AccountResponse {
  account: Account;
}

export const ACCOUNTS_QUERY_KEY = ["accounts"] as const;

export const accountsQueryConfig = {
  queryKey: ACCOUNTS_QUERY_KEY,
  queryFn: () => api.get<AccountsResponse>("/accounts"),
} as const;

export function useAccounts() {
  return useQuery({
    ...accountsQueryConfig,
    select: (data) => data.accounts,
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAccountInput) => api.post<AccountResponse>("/accounts", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ACCOUNTS_QUERY_KEY });
    },
  });
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateAccountInput }) =>
      api.patch<AccountResponse>(`/accounts/${id}`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ACCOUNTS_QUERY_KEY });
      // Activating/deactivating an account changes which transactions are shown
      // and therefore the dashboard/budget aggregates derived from them.
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/accounts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ACCOUNTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
    },
  });
}
