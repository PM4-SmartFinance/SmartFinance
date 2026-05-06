import { QueryClient, QueryCache } from "@tanstack/react-query";
import { ApiError } from "./api";

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return;
      console.error("Query failed", { queryKey: query.queryKey, error });
    },
  }),
  defaultOptions: {
    queries: {
      // Don't retry on 401/403 — these are auth failures, not transient errors
      retry: (failureCount, error) => {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          return false;
        }
        return failureCount < 2;
      },
      staleTime: 30_000,
    },
  },
});
