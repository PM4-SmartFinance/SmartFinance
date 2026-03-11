import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import { useAppStore } from "../store/appStore";

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

  // Client state — Zustand owns UI-only flags
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);

  return (
    <main>
      <h1>Dashboard</h1>

      <button type="button" onClick={toggleSidebar}>
        Sidebar: {sidebarOpen ? "open" : "closed"}
      </button>

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
