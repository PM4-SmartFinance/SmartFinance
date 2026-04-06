import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

export interface User {
  id: string;
  email: string;
  name?: string | null;
  role: string;
}

interface MeResponse {
  user: User;
}

const AUTH_QUERY = {
  queryKey: ["auth", "me"] as const,
  queryFn: () => api.get<MeResponse>("/auth/me"),
  retry: false,
} as const;

/**
 * Kicks off the auth check query so the result is cached before any
 * child component calls useAuth(). Must be rendered inside QueryClientProvider.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  useQuery(AUTH_QUERY);
  return <>{children}</>;
}

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
