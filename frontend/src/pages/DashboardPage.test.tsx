import { render, screen } from "@testing-library/react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { DashboardPage } from "./DashboardPage";

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

  it("renders all six widget cards", () => {
    renderWithProviders();
    expect(screen.getByText("Account Balance")).toBeInTheDocument();
    expect(screen.getByText("Monthly Expenses")).toBeInTheDocument();
    expect(screen.getByText("Income This Month")).toBeInTheDocument();
    expect(screen.getByText("Monthly Spending Trend")).toBeInTheDocument();
    expect(screen.getByText("Recent Transactions")).toBeInTheDocument();
    expect(screen.getByText("Budget Progress")).toBeInTheDocument();
  });

  it("renders the sign out button", () => {
    renderWithProviders();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });
});
