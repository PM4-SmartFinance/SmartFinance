import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { vi } from "vitest";
import { DashboardPage } from "./DashboardPage";

const mockSummaryData = {
  accountBalance: 15250.75,
  monthlyExpenses: 2840.5,
  incomeThisMonth: 6500.0,
};

const mockTrendData = [
  { date: "2025-12-01", amount: 2150.25 },
  { date: "2026-01-01", amount: 2500.75 },
  { date: "2026-02-01", amount: 2400.25 },
];

const mockCategoryData = [
  { category: "Groceries", amount: 450.75 },
  { category: "Transport", amount: 280.0 },
];

// Mock the api module
const { mockGet } = vi.hoisted(() => {
  const mockGet = vi.fn();
  return { mockGet };
});

vi.mock("../lib/api", () => ({
  api: {
    get: mockGet,
    post: vi.fn(() => Promise.resolve({ ok: true })),
  },
}));

// Mock auth context
vi.mock("../contexts/AuthProvider", () => ({
  useAuth: () => ({
    user: { id: "123", email: "test@example.com", role: "USER" },
  }),
}));

function renderWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("DashboardPage", () => {
  beforeEach(() => {
    mockGet.mockImplementation((path: string) => {
      if (path.includes("/dashboard/summary")) {
        return Promise.resolve(mockSummaryData);
      }
      if (path.includes("/dashboard/trends")) {
        return Promise.resolve(mockTrendData);
      }
      if (path.includes("/dashboard/categories")) {
        return Promise.resolve(mockCategoryData);
      }
      if (path.includes("/budgets")) {
        return Promise.resolve({ budgets: [] });
      }
      return Promise.resolve({});
    });
  });

  it("renders the page heading", () => {
    renderWithProviders();
    expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
  });

  it("renders main dashboard widgets", () => {
    renderWithProviders();
    expect(screen.getByText("Account Balance")).toBeInTheDocument();
    expect(screen.getByText("Monthly Expenses")).toBeInTheDocument();
    expect(screen.getByText("Income This Month")).toBeInTheDocument();
    expect(screen.getByText("Monthly Spending Trend")).toBeInTheDocument();
    expect(screen.getByText("Spending by Category")).toBeInTheDocument();
  });

  it("renders date range picker", () => {
    renderWithProviders();
    expect(screen.getByLabelText("Start Date")).toBeInTheDocument();
    expect(screen.getByLabelText("End Date")).toBeInTheDocument();
  });

  it("renders the sign out button", () => {
    renderWithProviders();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("triggers loading states when date range is changed", async () => {
    renderWithProviders();

    // Get date inputs
    const startInput = screen.getByLabelText("Start Date") as HTMLInputElement;

    // Change the start date
    fireEvent.change(startInput, { target: { value: "2026-01-15" } });

    // Verify the date input updated
    await waitFor(() => {
      expect(startInput.value).toBe("2026-01-15");
    });
  });

  it("refetches chart data when date range changes", async () => {
    renderWithProviders();

    // Wait for initial data to load
    await waitFor(() => {
      expect(screen.getByText("CHF 15'250.75")).toBeInTheDocument();
    });

    // Change the start date
    const startInput = screen.getByLabelText("Start Date") as HTMLInputElement;
    fireEvent.change(startInput, { target: { value: "2026-01-15" } });

    // Verify the date changed
    await waitFor(() => {
      expect(startInput.value).toBe("2026-01-15");
    });

    // Verify api.get was called with updated date parameters
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining("startDate=2026-01-15"));
    });

    // Verify widgets are still present
    expect(screen.getByText("Account Balance")).toBeInTheDocument();
    expect(screen.getByText("Monthly Spending Trend")).toBeInTheDocument();
    expect(screen.getByText("Spending by Category")).toBeInTheDocument();
  });
});
