import { render, screen } from "@testing-library/react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { vi } from "vitest";
import { DashboardPage } from "./DashboardPage";

// Mock the api module
vi.mock("../lib/api", () => ({
  api: {
    get: vi.fn(() => Promise.resolve({})),
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
    defaultOptions: { queries: { retry: false } },
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
});
