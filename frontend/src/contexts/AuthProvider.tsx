import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { AUTH_QUERY } from "../hooks/useAuth";

/**
 * Kicks off the auth check query so the result is cached before any
 * child component calls useAuth(). Must be rendered inside QueryClientProvider.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  useQuery(AUTH_QUERY);
  return <>{children}</>;
}
