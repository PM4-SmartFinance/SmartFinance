import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { vi } from "vitest";
import { DashboardPage } from "./DashboardPage";
import { useAuth } from "../hooks/useAuth";

const mockSummaryData = {
  totalIncome: 6500.0,
  totalExpenses: -2840.5,
  netBalance: 3659.5,
  transactionCount: 42,
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

vi.mock("../lib/api", () => {
  class MockApiError extends Error {
    status: number;
    body: unknown;
    constructor(status: number, body: unknown, message: string) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.body = body;
    }
  }
  return {
    api: {
      get: mockGet,
      post: vi.fn(() => Promise.resolve({ ok: true })),
      upload: vi.fn(),
    },
    ApiError: MockApiError,
  };
});

// Mock auth hook — using vi.fn so individual tests can override the role
vi.mock("../hooks/useAuth", () => ({
  useAuth: vi.fn(() => ({
    user: {
      id: "123",
      email: "test@example.com",
      role: "USER",
      name: null,
      active: true,
      createdAt: "2024-01-01T00:00:00.000Z",
    },
  })),
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
    expect(screen.getAllByText("Net Balance").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Total Expenses").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Total Income").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Monthly Spending Trend").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Spending by Category").length).toBeGreaterThanOrEqual(1);
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
      expect(screen.getByText("CHF 3'659.50")).toBeInTheDocument();
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
    expect(screen.getAllByText("Net Balance").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Monthly Spending Trend").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Spending by Category").length).toBeGreaterThanOrEqual(1);
  });

  it("nav links route to correct pages", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
    });

    expect(screen.getByRole("link", { name: "Transactions" })).toHaveAttribute(
      "href",
      "/transactions",
    );
    expect(screen.getByRole("link", { name: "Budgets" })).toHaveAttribute("href", "/budgets");
    expect(screen.getByRole("link", { name: "Categories" })).toHaveAttribute("href", "/categories");
    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute("href", "/profile");
  });

  it("full-card 'Recent Transactions' widget links to /transactions", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("CHF 3'659.50")).toBeInTheDocument();
    });

    const recentTransactionsLink = screen.getByRole("link", { name: /recent transactions/i });
    expect(recentTransactionsLink).toHaveAttribute("href", "/transactions");
  });

  it("full-card 'Budget Progress' widget links to /budgets", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("CHF 3'659.50")).toBeInTheDocument();
    });

    const budgetProgressLink = screen.getByRole("link", { name: /budget progress/i });
    expect(budgetProgressLink).toHaveAttribute("href", "/budgets");
  });
});

describe("DashboardPage — admin navigation", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      user: {
        id: "admin-1",
        email: "admin@example.com",
        role: "ADMIN",
        name: null,
        active: true,
        createdAt: "2024-01-01T00:00:00.000Z",
      },
      isAuthenticated: true,
      isLoading: false,
    });

    mockGet.mockImplementation((path: string) => {
      if (path.includes("/dashboard/summary")) return Promise.resolve(mockSummaryData);
      if (path.includes("/dashboard/trends")) return Promise.resolve(mockTrendData);
      if (path.includes("/dashboard/categories")) return Promise.resolve(mockCategoryData);
      if (path.includes("/budgets")) return Promise.resolve({ budgets: [] });
      return Promise.resolve({});
    });
  });

  afterEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      user: {
        id: "123",
        email: "test@example.com",
        role: "USER",
        name: null,
        active: true,
        createdAt: "2024-01-01T00:00:00.000Z",
      },
      isAuthenticated: true,
      isLoading: false,
    });
  });

  it("shows 'Users' nav link for ADMIN role linking to /admin/users", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 0 } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Users" })).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: "Users" })).toHaveAttribute("href", "/admin/users");
  });

  it("does not show 'Users' nav link for USER role", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: {
        id: "123",
        email: "user@example.com",
        role: "USER",
        name: null,
        active: true,
        createdAt: "2024-01-01T00:00:00.000Z",
      },
      isAuthenticated: true,
      isLoading: false,
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 0 } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("link", { name: "Users" })).not.toBeInTheDocument();
  });
});
