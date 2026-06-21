import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { CategoryBreakdownChart } from "./CategoryBreakdownChart";

vi.mock("recharts", () => {
  type TooltipStub = {
    itemStyle?: { color?: string };
    labelStyle?: { color?: string };
    contentStyle?: { backgroundColor?: string };
  };
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  const Null = () => null;
  return {
    ResponsiveContainer: Passthrough,
    BarChart: Passthrough,
    Bar: Passthrough,
    Cell: Null,
    XAxis: Null,
    YAxis: Null,
    CartesianGrid: Null,
    Tooltip: (props: TooltipStub) => (
      <div
        data-testid="recharts-tooltip"
        data-item-color={props.itemStyle?.color ?? ""}
        data-label-color={props.labelStyle?.color ?? ""}
        data-bg={props.contentStyle?.backgroundColor ?? ""}
      />
    ),
  };
});

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
          // Zero-spend category — must still appear in the chart data.
          { categoryId: "cat-5", categoryName: "Utilities", total: 0 },
          { categoryId: "cat-6", categoryName: "Shopping", total: 473.0 },
          // Synthetic Uncategorized bucket pinned last by the backend.
          {
            categoryId: null,
            categoryName: "Uncategorized",
            total: 88.5,
            isUncategorized: true,
          },
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

  it("shows the empty state when every category has zero spend and there is no uncategorized bucket", async () => {
    const apiMock = await vi.importMock("../lib/api");
    apiMock.api.get.mockImplementation((path: string) => {
      if (path.includes("/dashboard/categories")) {
        return Promise.resolve([
          { categoryId: "cat-1", categoryName: "Groceries", total: 0 },
          { categoryId: "cat-2", categoryName: "Transport", total: 0 },
        ]);
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

  it("renders the chart when only the Uncategorized bucket has spend", async () => {
    const apiMock = await vi.importMock("../lib/api");
    apiMock.api.get.mockImplementation((path: string) => {
      if (path.includes("/dashboard/categories")) {
        return Promise.resolve([
          { categoryId: "cat-1", categoryName: "Groceries", total: 0 },
          {
            categoryId: null,
            categoryName: "Uncategorized",
            total: 42,
            isUncategorized: true,
          },
        ]);
      }
      return Promise.resolve({});
    });

    renderWithQuery(<CategoryBreakdownChart />);

    // The empty-state copy must NOT appear — uncategorized spend is real spend.
    await waitFor(() => {
      expect(screen.getByRole("link", { name: /view categories/i })).toBeInTheDocument();
    });
    expect(
      screen.queryByText(
        "No category breakdown yet. Import transactions or a CSV to see spending by category.",
      ),
    ).not.toBeInTheDocument();
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

  it("renders as a clickable link to /categories", () => {
    renderWithQuery(<CategoryBreakdownChart />);
    const link = screen.getByRole("link", { name: /view categories/i });
    expect(link).toHaveAttribute("href", "/categories");
  });

  it("wraps the card content inside the link", () => {
    renderWithQuery(<CategoryBreakdownChart />);
    const link = screen.getByRole("link", { name: /view categories/i });
    expect(link).toContainElement(screen.getByText("Spending by Category"));
  });

  it("does not render link in error state", async () => {
    const apiMock = await vi.importMock("../lib/api");
    apiMock.api.get.mockRejectedValueOnce(new Error("Failed to fetch"));

    renderWithQuery(<CategoryBreakdownChart />);

    await waitFor(() => {
      expect(
        screen.getByText("Failed to load category breakdown data. Please try again."),
      ).toBeInTheDocument();
    });

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders link in empty state", async () => {
    const apiMock = await vi.importMock("../lib/api");
    apiMock.api.get.mockResolvedValueOnce([]);

    renderWithQuery(<CategoryBreakdownChart />);

    await waitFor(() => {
      const link = screen.getByRole("link", { name: /view categories/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "/categories");
    });
  });

  it("wires tooltip styles to theme tokens so dark-mode keeps contrast (KAN-151)", async () => {
    renderWithQuery(<CategoryBreakdownChart />);

    const tooltip = await screen.findByTestId("recharts-tooltip");
    expect(tooltip.dataset.itemColor).toBe("var(--foreground)");
    expect(tooltip.dataset.labelColor).toBe("var(--foreground)");
    expect(tooltip.dataset.bg).toBe("var(--card)");
  });

  it("supports keyboard navigation to /categories link", async () => {
    const user = userEvent.setup();
    renderWithQuery(<CategoryBreakdownChart />);

    const link = screen.getByRole("link", { name: /view categories/i });

    // Initially not focused
    expect(link).not.toHaveFocus();

    // Tab to focus the link
    await user.tab();
    expect(link).toHaveFocus();

    // Verify link has correct href
    expect(link).toHaveAttribute("href", "/categories");
  });
});
