import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { SpendingTrendChart } from "./SpendingTrendChart";

const mockTrendData = {
  data: [
    { year: 2025, month: 12, income: 5000, expenses: 2150.25 },
    { year: 2026, month: 1, income: 6000, expenses: 2500.75 },
    { year: 2026, month: 2, income: 5500, expenses: 2800.0 },
  ],
};

vi.mock("../lib/api", () => ({
  api: {
    get: vi.fn((path) => {
      if (path.includes("/dashboard/trends")) {
        return Promise.resolve(mockTrendData);
      }
      return Promise.resolve({});
    }),
  },
}));

function renderWithQuery(component: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{component}</QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("SpendingTrendChart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the chart heading", () => {
    renderWithQuery(<SpendingTrendChart />);
    expect(screen.getByText("Monthly Spending Trend")).toBeInTheDocument();
  });

  it("renders the heading while data is loading", async () => {
    renderWithQuery(<SpendingTrendChart />);

    await waitFor(
      () => {
        const heading = screen.getByText("Monthly Spending Trend");
        expect(heading).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it("shows loading indicator before data arrives", () => {
    renderWithQuery(<SpendingTrendChart />);

    expect(screen.getByText("Loading chart…")).toBeInTheDocument();
  });

  it("displays error state when data fetch fails", async () => {
    // Mock API to return error
    const apiMock = await vi.importMock("../lib/api");
    apiMock.api.get.mockRejectedValueOnce(new Error("Failed to fetch"));

    renderWithQuery(<SpendingTrendChart />);

    await waitFor(() => {
      expect(
        screen.getByText("Failed to load spending trend data. Please try again."),
      ).toBeInTheDocument();
    });
  });

  it("renders as a clickable link to /transactions", () => {
    renderWithQuery(<SpendingTrendChart />);
    const link = screen.getByRole("link", { name: /monthly spending trend/i });
    expect(link).toHaveAttribute("href", "/transactions");
  });

  it("renders link in loading state", () => {
    renderWithQuery(<SpendingTrendChart />);
    const link = screen.getByRole("link", { name: /monthly spending trend/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/transactions");
  });

  it("renders link in error state", async () => {
    const apiMock = await vi.importMock("../lib/api");
    apiMock.api.get.mockRejectedValueOnce(new Error("Failed to fetch"));

    renderWithQuery(<SpendingTrendChart />);

    await waitFor(() => {
      const link = screen.getByRole("link", { name: /monthly spending trend/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "/transactions");
    });
  });

  it("supports keyboard navigation to /transactions link", async () => {
    const user = userEvent.setup();
    renderWithQuery(<SpendingTrendChart />);

    const link = screen.getByRole("link", { name: /monthly spending trend/i });

    // Initially not focused
    expect(link).not.toHaveFocus();

    // Tab to focus the link
    await user.tab();
    expect(link).toHaveFocus();

    // Verify link has correct href
    expect(link).toHaveAttribute("href", "/transactions");
  });
});
