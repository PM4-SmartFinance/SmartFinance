import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { User } from "../lib/queries/users";

export type { User };

interface MeResponse {
  user: User;
}

export const AUTH_QUERY = {
  queryKey: ["auth", "me"] as const,
  queryFn: () => api.get<MeResponse>("/auth/me"),
  retry: false,
} as const;

/**
 * Returns the current auth state derived from the cached GET /auth/me query.
 * Uses TanStack Query as the source of truth for server state — no Zustand sync needed.
 */
export function useAuth() {
  const { data, isPending } = useQuery(AUTH_QUERY);
  return {
    user: data?.user ?? null,
    isAuthenticated: !isPending && data !== undefined,
    isLoading: isPending,
  };
}
