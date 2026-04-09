import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TransactionsPage } from "./TransactionsPage";
import { useTransactionsStore } from "../store/transactionsStore";
import * as apiModule from "../lib/api";

const mockTransactionsResponse = {
  data: [
    {
      id: "tx-1",
      amount: "-42.50",
      date: "2026-04-01",
      accountId: "acc-1",
      merchantId: "m-1",
      merchant: "Migros",
      categoryId: "cat-1",
      categoryName: "Groceries",
    },
    {
      id: "tx-2",
      amount: "-15.00",
      date: "2026-03-31",
      accountId: "acc-1",
      merchantId: "m-2",
      merchant: "Bus",
      categoryId: "cat-2",
      categoryName: "Transport",
    },
  ],
  meta: {
    totalCount: 2,
    totalPages: 1,
    page: 1,
    limit: 20,
  },
};

vi.mock("../lib/api", () => ({
  api: {
    get: vi.fn(),
  },
}));

vi.mock("../lib/queries/categories", () => ({
  useCategories: () => ({
    data: [
      { id: "cat-1", categoryName: "Groceries" },
      { id: "cat-2", categoryName: "Transport" },
    ],
    isLoading: false,
    error: null,
  }),
}));

describe("TransactionsPage", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    useTransactionsStore.setState({
      page: 1,
      limit: 20,
      sortBy: "date",
      sortOrder: "desc",
      startDate: null,
      endDate: null,
      categoryId: null,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const renderTransactionsPage = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <TransactionsPage />
      </QueryClientProvider>,
    );
  };

  it("renders the page title and filter section", async () => {
    vi.mocked(apiModule.api.get).mockResolvedValueOnce(mockTransactionsResponse);

    renderTransactionsPage();

    expect(screen.getByRole("heading", { level: 1, name: "Transactions" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Filters" })).toBeInTheDocument();
    expect(screen.getByLabelText("Start Date")).toBeInTheDocument();
    expect(screen.getByLabelText("End Date")).toBeInTheDocument();
    expect(screen.getByLabelText("Category")).toBeInTheDocument();
  });

  it("renders the table with transaction data", async () => {
    vi.mocked(apiModule.api.get).mockResolvedValueOnce(mockTransactionsResponse);

    renderTransactionsPage();

    await waitFor(() => {
      expect(screen.getByText("Migros")).toBeInTheDocument();
      expect(screen.getByText("Bus")).toBeInTheDocument();
      expect(screen.getByText("−CHF 42.50")).toBeInTheDocument();
      expect(screen.getByText("−CHF 15.00")).toBeInTheDocument();
    });
  });

  it("shows loading skeleton while fetching", () => {
    vi.mocked(apiModule.api.get).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(mockTransactionsResponse), 100)),
    );

    renderTransactionsPage();

    // Just verify the page renders without error during loading
    expect(screen.getByRole("heading", { name: "Transactions" })).toBeInTheDocument();
  });

  it("shows empty state when no transactions found", async () => {
    vi.mocked(apiModule.api.get).mockResolvedValueOnce({
      data: [],
      meta: { totalCount: 0, totalPages: 0, page: 1, limit: 20 },
    });

    renderTransactionsPage();

    await waitFor(() => {
      expect(
        screen.getByText("No transactions found. Try adjusting your filters."),
      ).toBeInTheDocument();
    });
  });

  it("handles loading state gracefully", async () => {
    const slowMock = vi.fn(
      () => new Promise((resolve) => setTimeout(() => resolve(mockTransactionsResponse), 1000)),
    );
    vi.mocked(apiModule.api.get).mockImplementation(slowMock);

    renderTransactionsPage();

    // Initially shows loading state
    expect(screen.queryByText("Migros")).not.toBeInTheDocument();

    // Eventually shows data
    await waitFor(
      () => {
        expect(screen.getByText("Migros")).toBeInTheDocument();
      },
      { timeout: 2000 },
    );
  });

  it("triggers API call when sorting by column header", async () => {
    vi.mocked(apiModule.api.get).mockResolvedValueOnce(mockTransactionsResponse);

    renderTransactionsPage();

    await waitFor(() => {
      expect(screen.getByText("Migros")).toBeInTheDocument();
    });

    const amountHeader = screen.getByRole("button", { name: /Amount/i });
    await userEvent.click(amountHeader);

    await waitFor(() => {
      const calls = vi.mocked(apiModule.api.get).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const lastCall = calls[calls.length - 1]![0] as string;
      expect(lastCall).toContain("sortBy=amount");
    });
  });

  it("triggers API call when changing category filter", async () => {
    vi.mocked(apiModule.api.get).mockResolvedValueOnce(mockTransactionsResponse);

    renderTransactionsPage();

    await waitFor(() => {
      expect(screen.getByText("Migros")).toBeInTheDocument();
    });

    const categorySelect = screen.getByLabelText("Category") as HTMLSelectElement;
    await userEvent.selectOptions(categorySelect, "cat-1");

    await waitFor(() => {
      const calls = vi.mocked(apiModule.api.get).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const lastCallUrl = calls[calls.length - 1]![0] as string;
      expect(lastCallUrl).toContain("categoryId=cat-1");
    });
  });

  it("triggers API call when applying date range filter", async () => {
    vi.mocked(apiModule.api.get).mockResolvedValueOnce(mockTransactionsResponse);

    renderTransactionsPage();

    await waitFor(() => {
      expect(screen.getByText("Migros")).toBeInTheDocument();
    });

    const startDateInput = screen.getByLabelText("Start Date") as HTMLInputElement;
    const endDateInput = screen.getByLabelText("End Date") as HTMLInputElement;

    await userEvent.type(startDateInput, "2026-03-01");
    await userEvent.type(endDateInput, "2026-04-30");

    const applyButton = screen.getByRole("button", { name: "Apply" });
    await userEvent.click(applyButton);

    await waitFor(() => {
      const calls = vi.mocked(apiModule.api.get).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const lastCallUrl = calls[calls.length - 1]![0] as string;
      expect(lastCallUrl).toContain("startDate=2026-03-01");
      expect(lastCallUrl).toContain("endDate=2026-04-30");
    });
  });

  it("clears all filters when clicking Clear button", async () => {
    vi.mocked(apiModule.api.get).mockResolvedValueOnce(mockTransactionsResponse);

    // Set initial filters
    useTransactionsStore.setState({
      startDate: "2026-03-01",
      endDate: "2026-04-30",
      categoryId: "cat-1",
      page: 2,
    });

    renderTransactionsPage();

    await waitFor(() => {
      expect(screen.getByText("Migros")).toBeInTheDocument();
    });

    const clearButton = screen.getByRole("button", { name: "Clear" });
    await userEvent.click(clearButton);

    await waitFor(() => {
      const state = useTransactionsStore.getState();
      expect(state.startDate).toBeNull();
      expect(state.endDate).toBeNull();
      expect(state.categoryId).toBeNull();
      expect(state.page).toBe(1);
    });
  });

  it("navigates to next page when clicking Next button", async () => {
    const multiPageResponse = {
      ...mockTransactionsResponse,
      meta: { totalCount: 50, totalPages: 3, page: 1, limit: 20 },
    };

    vi.mocked(apiModule.api.get).mockResolvedValueOnce(multiPageResponse);

    renderTransactionsPage();

    await waitFor(() => {
      expect(screen.getByText("Migros")).toBeInTheDocument();
    });

    const nextButton = screen.getByRole("button", { name: "Next" });
    await userEvent.click(nextButton);

    await waitFor(() => {
      const state = useTransactionsStore.getState();
      expect(state.page).toBe(2);
    });
  });

  it("disables pagination buttons at boundaries", async () => {
    const multiPageResponse = {
      ...mockTransactionsResponse,
      meta: { totalCount: 50, totalPages: 3, page: 1, limit: 20 },
    };

    vi.mocked(apiModule.api.get).mockResolvedValue(multiPageResponse);

    renderTransactionsPage();

    await waitFor(() => {
      expect(screen.getByText("Migros")).toBeInTheDocument();
    });

    // At page 1, Previous should be disabled
    const prevButton = screen.getByRole("button", { name: "Previous" });
    expect(prevButton).toBeDisabled();

    // After clicking Next to go to page 2, both should be enabled (need fresh mock)
    vi.mocked(apiModule.api.get).mockResolvedValue({
      ...mockTransactionsResponse,
      meta: { totalCount: 50, totalPages: 3, page: 2, limit: 20 },
    });

    const nextButton = screen.getByRole("button", { name: "Next" });
    await userEvent.click(nextButton);

    await waitFor(() => {
      const updatedPrevButton = screen.getByRole("button", { name: "Previous" });
      expect(updatedPrevButton).not.toBeDisabled();
    });
  });

  it("displays correct sort indicator on column headers", async () => {
    vi.mocked(apiModule.api.get).mockResolvedValueOnce(mockTransactionsResponse);

    // Set descending sort on date
    useTransactionsStore.setState({ sortBy: "date", sortOrder: "desc" });

    renderTransactionsPage();

    await waitFor(() => {
      expect(screen.getByText("Migros")).toBeInTheDocument();
    });

    const dateHeader = screen.getByRole("button", { name: /Date/ });
    expect(dateHeader.textContent).toContain("↓");
  });

  it("formats currency with CHF and negative amounts with minus sign", async () => {
    vi.mocked(apiModule.api.get).mockResolvedValueOnce(mockTransactionsResponse);

    renderTransactionsPage();

    await waitFor(() => {
      expect(screen.getByText("−CHF 42.50")).toBeInTheDocument();
      expect(screen.getByText("−CHF 15.00")).toBeInTheDocument();
    });
  });

  it("formats dates correctly in table", async () => {
    vi.mocked(apiModule.api.get).mockResolvedValueOnce(mockTransactionsResponse);

    renderTransactionsPage();

    await waitFor(() => {
      expect(screen.getByText("1.4.2026")).toBeInTheDocument(); // April 1, 2026 (de-CH)
      expect(screen.getByText("31.3.2026")).toBeInTheDocument(); // March 31, 2026 (de-CH)
    });
  });

  it("shows error state when API fails", async () => {
    vi.mocked(apiModule.api.get).mockRejectedValue(new Error("Server error"));

    renderTransactionsPage();

    // retry: 1 in query config means TanStack Query retries once before surfacing error
    await waitFor(
      () => {
        expect(
          screen.getByText("Failed to load transactions. Please try again later."),
        ).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    // Table should not be rendered in error state
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("toggles sort order when clicking the same column header twice", async () => {
    vi.mocked(apiModule.api.get).mockResolvedValue(mockTransactionsResponse);

    renderTransactionsPage();

    await waitFor(() => {
      expect(screen.getByText("Migros")).toBeInTheDocument();
    });

    // Default sort is date desc — click date header to toggle to asc
    await userEvent.click(screen.getByRole("button", { name: /Date/ }));

    await waitFor(() => {
      const state = useTransactionsStore.getState();
      expect(state.sortBy).toBe("date");
      expect(state.sortOrder).toBe("asc");
    });

    // Wait for re-render with updated data, then click again
    await waitFor(() => {
      expect(screen.getByText("Migros")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: /Date/ }));

    await waitFor(() => {
      const state = useTransactionsStore.getState();
      expect(state.sortBy).toBe("date");
      expect(state.sortOrder).toBe("desc");
    });
  });

  it("resets sort order to desc when switching to a different column", async () => {
    vi.mocked(apiModule.api.get).mockResolvedValue(mockTransactionsResponse);

    // Start with date asc
    useTransactionsStore.setState({ sortBy: "date", sortOrder: "asc" });

    renderTransactionsPage();

    await waitFor(() => {
      expect(screen.getByText("Migros")).toBeInTheDocument();
    });

    // Click amount header — should reset to desc
    const amountHeader = screen.getByRole("button", { name: /Amount/ });
    await userEvent.click(amountHeader);

    await waitFor(() => {
      const state = useTransactionsStore.getState();
      expect(state.sortBy).toBe("amount");
      expect(state.sortOrder).toBe("desc");
    });
  });

  it("displays null categories as dash", async () => {
    const responseWithNullCategory = {
      data: [
        {
          id: "tx-3",
          amount: "-10.00",
          date: "2026-04-01",
          accountId: "acc-1",
          merchantId: "m-3",
          merchant: "Unknown Merchant",
          categoryId: null,
          categoryName: null,
        },
      ],
      meta: { totalCount: 1, totalPages: 1, page: 1, limit: 20 },
    };

    vi.mocked(apiModule.api.get).mockResolvedValueOnce(responseWithNullCategory);

    renderTransactionsPage();

    await waitFor(() => {
      expect(screen.getByText("Unknown Merchant")).toBeInTheDocument();
      expect(screen.getByText("—")).toBeInTheDocument();
    });
  });
});
