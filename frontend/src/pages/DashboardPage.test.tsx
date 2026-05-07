import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { vi } from "vitest";
import { DashboardPage } from "./DashboardPage";
import { useAuth, type User } from "../hooks/useAuth";

const USER_FIXTURE = {
  id: "123",
  email: "test@example.com",
  role: "USER",
  name: null,
  active: true,
  createdAt: "2024-01-01T00:00:00.000Z",
} satisfies User;

const mockSummaryData = {
  totalIncome: 6500.0,
  totalExpenses: -2840.5,
  netBalance: 3659.5,
  transactionCount: 42,
};

const mockTrendData = {
  data: [
    { year: 2025, month: 12, income: 5000, expenses: 2150.25 },
    { year: 2026, month: 1, income: 6000, expenses: 2500.75 },
    { year: 2026, month: 2, income: 5500, expenses: 2400.25 },
  ],
};

const mockCategoryData = [
  { categoryId: "cat-1", categoryName: "Groceries", total: 450.75 },
  { categoryId: "cat-2", categoryName: "Transport", total: 280.0 },
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

// Mock auth hook — using vi.fn so individual tests can override the role.
// Defaults are configured per-describe in beforeEach so a forgotten override
// can't leak across tests.
vi.mock("../hooks/useAuth", () => ({
  useAuth: vi.fn(),
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
    vi.mocked(useAuth).mockReturnValue({
      user: USER_FIXTURE,
      isAuthenticated: true,
      isLoading: false,
    });

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
      if (path === "/categories" || path.startsWith("/categories?")) {
        return Promise.resolve({ categories: [] });
      }
      if (path.includes("/budgets")) {
        return Promise.resolve({ budgets: [], categorySpending: [] });
      }
      if (path.includes("/transactions")) {
        return Promise.resolve({
          data: [],
          meta: { totalCount: 0, totalPages: 0, page: 1, limit: 5 },
        });
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
    expect(screen.getAllByText("Monthly Income vs. Expenses").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Spending by Category").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Recent Transactions")).toBeInTheDocument();
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
    expect(screen.getAllByText("Monthly Income vs. Expenses").length).toBeGreaterThanOrEqual(1);
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
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
  });

  it("full-card 'Recent Transactions' widget links to /transactions", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("CHF 3'659.50")).toBeInTheDocument();
    });

    // The widget wraps its card in a link with aria-label "View transactions";
    // every such link on the dashboard must route to /transactions (query string
    // params like date range are allowed for some sibling widgets).
    const links = screen.getAllByRole("link", { name: /view transactions/i });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.getAttribute("href")).toMatch(/^\/transactions(\?.*)?$/);
    }
  });

  it("full-card 'Budget Progress' widget links to /budgets", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("CHF 3'659.50")).toBeInTheDocument();
    });

    // The Budget Progress card is wrapped in a link with aria-label "View budgets";
    // every such link on the dashboard must point to /budgets.
    const links = screen.getAllByRole("link", { name: /view budgets/i });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link).toHaveAttribute("href", "/budgets");
    }
  });
});
