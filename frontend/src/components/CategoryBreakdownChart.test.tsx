import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { CategoryBreakdownChart } from "./CategoryBreakdownChart";

vi.mock("../lib/api", () => ({
  ApiError: class MockApiError extends Error {
    status: number;

    constructor(status: number, message: string) {
      super(message);
      this.status = status;
      this.name = "ApiError";
    }
  },
  api: {
    get: vi.fn((path) => {
      if (path.includes("/dashboard/categories")) {
        return Promise.resolve([
          { categoryId: "cat-1", categoryName: "Groceries", total: 450.75 },
          { categoryId: "cat-2", categoryName: "Transport", total: 280.0 },
          { categoryId: "cat-3", categoryName: "Dining", total: 320.5 },
          { categoryId: "cat-4", categoryName: "Entertainment", total: 195.25 },
          { categoryId: "cat-5", categoryName: "Utilities", total: 125.0 },
          { categoryId: "cat-6", categoryName: "Shopping", total: 473.0 },
        ]);
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

describe("CategoryBreakdownChart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the chart heading", () => {
    renderWithQuery(<CategoryBreakdownChart />);
    expect(screen.getByText("Spending by Category")).toBeInTheDocument();
  });

  it("renders the heading while data is loading", async () => {
    renderWithQuery(<CategoryBreakdownChart />);

    await waitFor(
      () => {
        const heading = screen.getByText("Spending by Category");
        expect(heading).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it("shows loading indicator before data arrives", () => {
    renderWithQuery(<CategoryBreakdownChart />);

    expect(screen.getByText("Loading chart…")).toBeInTheDocument();
  });

  it("shows a neutral empty state when there is no category data yet", async () => {
    const apiMock = await vi.importMock("../lib/api");
    apiMock.api.get.mockImplementation((path: string) => {
      if (path.includes("/dashboard/categories")) {
        return Promise.resolve([]);
      }
      return Promise.resolve({});
    });

    renderWithQuery(<CategoryBreakdownChart />);

    await waitFor(() => {
      expect(
        screen.getByText(
          "No category breakdown yet. Import transactions or a CSV to see spending by category.",
        ),
      ).toBeInTheDocument();
    });
  });

  it("shows a neutral empty state when the backend has no breakdown endpoint yet", async () => {
    const apiMock = await vi.importMock("../lib/api");
    apiMock.api.get.mockRejectedValueOnce(new apiMock.ApiError(404, "Not Found"));

    renderWithQuery(<CategoryBreakdownChart />);

    await waitFor(() => {
      expect(
        screen.getByText(
          "No category breakdown yet. Import transactions or a CSV to see spending by category.",
        ),
      ).toBeInTheDocument();
    });
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
