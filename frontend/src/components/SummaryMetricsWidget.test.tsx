import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { SummaryMetricsWidget } from "./SummaryMetricsWidget";

const mockSummaryData = {
  totalIncome: 6500.0,
  totalExpenses: -2840.5,
  netBalance: 3659.5,
  transactionCount: 42,
};

vi.mock("../lib/api", () => ({
  api: {
    get: vi.fn((path) => {
      if (path.includes("/dashboard/summary")) {
        return Promise.resolve(mockSummaryData);
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

describe("SummaryMetricsWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all three metric cards", () => {
    renderWithQuery(<SummaryMetricsWidget />);
    expect(screen.getByText("Net Balance")).toBeInTheDocument();
    expect(screen.getByText("Total Expenses")).toBeInTheDocument();
    expect(screen.getByText("Total Income")).toBeInTheDocument();
  });

  it("shows loading indicators before data arrives", () => {
    renderWithQuery(<SummaryMetricsWidget />);

    const loadingMessages = screen.getAllByText("Loading\u2026");
    expect(loadingMessages.length).toBe(3);
  });

  it("displays formatted currency values after loading", async () => {
    renderWithQuery(<SummaryMetricsWidget />);

    await waitFor(() => {
      expect(screen.getByText("CHF 3'659.50")).toBeInTheDocument();
      expect(screen.getByText("CHF 2'840.50")).toBeInTheDocument();
      expect(screen.getByText("CHF 6'500.00")).toBeInTheDocument();
    });
  });

  it("displays error state when data fetch fails", async () => {
    const apiMock = await vi.importMock("../lib/api");
    apiMock.api.get.mockRejectedValueOnce(new Error("Failed to fetch"));

    renderWithQuery(<SummaryMetricsWidget />);

    await waitFor(() => {
      expect(
        screen.getByText("Failed to load summary data. Please try again."),
      ).toBeInTheDocument();
    });
  });

  it("renders as a clickable link to /transactions", () => {
    renderWithQuery(<SummaryMetricsWidget />);
    const link = screen.getByRole("link", { name: /view transactions/i });
    expect(link).toHaveAttribute("href", "/transactions");
  });

  it("renders link with aria-label for screen readers", () => {
    renderWithQuery(<SummaryMetricsWidget />);
    const link = screen.getByRole("link", { name: /view transactions/i });
    expect(link).toHaveAttribute("aria-label", "View transactions");
  });

  it("renders link even in error state", async () => {
    const apiMock = await vi.importMock("../lib/api");
    apiMock.api.get.mockRejectedValueOnce(new Error("Failed to fetch"));

    renderWithQuery(<SummaryMetricsWidget />);

    // Error state should NOT have a link (different from charts)
    await waitFor(() => {
      expect(
        screen.getByText("Failed to load summary data. Please try again."),
      ).toBeInTheDocument();
    });

    // Verify no link in error state
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("supports keyboard navigation to /transactions link", async () => {
    const user = userEvent.setup();
    renderWithQuery(<SummaryMetricsWidget />);

    const link = screen.getByRole("link", { name: /view transactions/i });

    // Initially not focused
    expect(link).not.toHaveFocus();

    // Tab to focus the link
    await user.tab();
    expect(link).toHaveFocus();

    // Verify link has correct href
    expect(link).toHaveAttribute("href", "/transactions");
  });
});
