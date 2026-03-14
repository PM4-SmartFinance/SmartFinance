import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";

interface DashboardSummary {
  totalTransactions: number;
  totalIncome: number;
  totalExpenses: number;
}

export function DashboardPage() {
  // Server state — TanStack Query owns data from the API
  const { data, isLoading, isError, error } = useQuery<DashboardSummary>({
    queryKey: ["dashboard", "summary"],
    queryFn: () => api.get<DashboardSummary>("/dashboard/summary"),
  });

  return (
    <main>
      <h1>Dashboard</h1>

      {isLoading && <p>Loading summary…</p>}
      {isError && (
        <p>Failed to load summary: {error instanceof ApiError ? error.message : "Unknown error"}</p>
      )}
      {data && (
        <ul>
          <li>Transactions: {data.totalTransactions}</li>
          <li>Income: {data.totalIncome}</li>
          <li>Expenses: {data.totalExpenses}</li>
        </ul>
      )}
    </main>
  );
}
