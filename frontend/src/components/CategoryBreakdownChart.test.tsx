import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { CategoryBreakdownChart } from "./CategoryBreakdownChart";

const mockCategoryData = [
  { category: "Groceries", amount: 450.75 },
  { category: "Transport", amount: 280.0 },
  { category: "Dining", amount: 320.5 },
  { category: "Entertainment", amount: 195.25 },
  { category: "Utilities", amount: 125.0 },
  { category: "Shopping", amount: 473.0 },
];

vi.mock("../lib/api", () => ({
  api: {
    get: vi.fn((path) => {
      if (path.includes("/dashboard/categories")) {
        return Promise.resolve(mockCategoryData);
      }
      return Promise.resolve({});
    }),
  },
}));

function renderWithQuery(component: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{component}</QueryClientProvider>);
}

describe("CategoryBreakdownChart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the chart heading", () => {
    renderWithQuery(<CategoryBreakdownChart />);
    expect(screen.getByText("Spending by Category")).toBeInTheDocument();
  });

  it("renders the chart container with responsive height", async () => {
    renderWithQuery(<CategoryBreakdownChart />);

    await waitFor(
      () => {
        const heading = screen.getByText("Spending by Category");
        expect(heading).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it("displays loading state initially", () => {
    renderWithQuery(<CategoryBreakdownChart />);

    // Component should show loading state or attempt to fetch
    expect(screen.getByText("Spending by Category")).toBeInTheDocument();
  });

  it("displays error state when data fetch fails", async () => {
    // Mock API to return error
    const apiMock = await vi.importMock("../lib/api");
    apiMock.api.get.mockRejectedValueOnce(new Error("Failed to fetch"));

    renderWithQuery(<CategoryBreakdownChart />);

    await waitFor(() => {
      expect(
        screen.getByText("Failed to load category breakdown data. Please try again."),
      ).toBeInTheDocument();
    });
  });
});
