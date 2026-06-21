import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { RecentTransactionsWidget } from "./RecentTransactionsWidget";
import { api } from "../lib/api";

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
    api: { get: vi.fn() },
    ApiError: MockApiError,
  };
});

const mockGet = vi.mocked(api.get);

const META = { totalCount: 0, totalPages: 0, page: 1, limit: 5 };

function renderWidget() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <RecentTransactionsWidget />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RecentTransactionsWidget", () => {
  it("renders the title", () => {
    mockGet.mockResolvedValue({ data: [], meta: META });
    renderWidget();
    expect(screen.getByText("Recent Transactions")).toBeInTheDocument();
  });

  it("wraps the widget in a navigation link to /transactions", () => {
    mockGet.mockResolvedValue({ data: [], meta: META });
    renderWidget();
    const link = screen.getByRole("link", { name: "View transactions" });
    expect(link).toHaveAttribute("href", "/transactions");
  });

  describe("loading state", () => {
    it("shows skeleton placeholders", () => {
      mockGet.mockReturnValue(new Promise(() => {})); // never resolves
      const { container } = renderWidget();
      const skeletons = container.querySelectorAll(".animate-pulse");
      expect(skeletons).toHaveLength(5);
    });
  });

  describe("error state", () => {
    it("shows the error message when the query fails", async () => {
      mockGet.mockRejectedValue(new Error("Network error"));
      renderWidget();
      await waitFor(() =>
        expect(screen.getByRole("alert")).toHaveTextContent("Failed to load recent transactions."),
      );
    });

    it("renders a Retry button that triggers a refetch", async () => {
      // Reject twice to exhaust the per-query `retry: 1` so the error branch renders.
      mockGet.mockRejectedValueOnce(new Error("Network error"));
      mockGet.mockRejectedValueOnce(new Error("Network error"));
      mockGet.mockResolvedValue({ data: [], meta: META });
      renderWidget();
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument(),
      );
      await userEvent.click(screen.getByRole("button", { name: "Retry" }));
      await waitFor(() => expect(screen.getByText("No transactions yet.")).toBeInTheDocument());
    });
  });

  describe("empty state", () => {
    it("shows the empty message when there are no transactions", async () => {
      mockGet.mockResolvedValue({ data: [], meta: META });
      renderWidget();
      await waitFor(() => expect(screen.getByText("No transactions yet.")).toBeInTheDocument());
    });
  });

  describe("populated state", () => {
    const negativeTx = {
      id: "tx-1",
      amount: "-42.50",
      date: "2026-04-15",
      accountId: "acc-1",
      merchantId: "m-1",
      merchant: "Migros",
      categoryId: "cat-1",
      categoryName: "Groceries",
    };
    const positiveNullCategoryTx = {
      id: "tx-2",
      amount: "1250.00",
      date: "2026-04-10",
      accountId: "acc-1",
      merchantId: "m-2",
      merchant: "Salary",
      categoryId: null,
      categoryName: null,
    };
    const malformedTx = {
      id: "tx-3",
      amount: "not-a-number",
      date: "not-a-date",
      accountId: "acc-1",
      merchantId: "m-3",
      merchant: "Bad Row",
      categoryId: null,
      categoryName: "Misc",
    };

    it("renders one row per transaction", async () => {
      const txns = [negativeTx, positiveNullCategoryTx, malformedTx];
      mockGet.mockResolvedValue({ data: txns, meta: { ...META, totalCount: txns.length } });
      renderWidget();
      await waitFor(() => expect(screen.getByText("Migros")).toBeInTheDocument());
      expect(screen.getByText("Salary")).toBeInTheDocument();
      expect(screen.getByText("Bad Row")).toBeInTheDocument();
    });

    it("renders accessible column headers in a sr-only thead", async () => {
      mockGet.mockResolvedValue({ data: [negativeTx], meta: { ...META, totalCount: 1 } });
      renderWidget();
      await waitFor(() => expect(screen.getByText("Migros")).toBeInTheDocument());
      expect(screen.getByRole("columnheader", { name: "Date" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Merchant" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Category" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Amount" })).toBeInTheDocument();
    });

    it("renders negative amounts with a unicode minus sign", async () => {
      mockGet.mockResolvedValue({ data: [negativeTx], meta: { ...META, totalCount: 1 } });
      renderWidget();
      await waitFor(() => expect(screen.getByText("Migros")).toBeInTheDocument());
      expect(screen.getByText("CHF-42.50")).toBeInTheDocument();
    });

    it("renders positive amounts without a sign", async () => {
      mockGet.mockResolvedValue({
        data: [positiveNullCategoryTx],
        meta: { ...META, totalCount: 1 },
      });
      renderWidget();
      await waitFor(() => expect(screen.getByText("Salary")).toBeInTheDocument());
      expect(screen.getByText("CHF 1'250.00")).toBeInTheDocument();
    });

    it("renders a fallback for null categoryName", async () => {
      mockGet.mockResolvedValue({
        data: [positiveNullCategoryTx],
        meta: { ...META, totalCount: 1 },
      });
      renderWidget();
      await waitFor(() => expect(screen.getByText("Salary")).toBeInTheDocument());
      const row = screen.getByText("Salary").closest("tr")!;
      expect(row).toHaveTextContent("—");
    });

    it("renders a fallback when amount is not a finite number", async () => {
      mockGet.mockResolvedValue({ data: [malformedTx], meta: { ...META, totalCount: 1 } });
      renderWidget();
      await waitFor(() => expect(screen.getByText("Bad Row")).toBeInTheDocument());
      const row = screen.getByText("Bad Row").closest("tr")!;
      const cells = row.querySelectorAll("td");
      expect(cells[3]).toHaveTextContent("—");
      expect(row).not.toHaveTextContent("NaN");
    });

    it("renders a fallback when date is invalid", async () => {
      mockGet.mockResolvedValue({ data: [malformedTx], meta: { ...META, totalCount: 1 } });
      renderWidget();
      await waitFor(() => expect(screen.getByText("Bad Row")).toBeInTheDocument());
      const row = screen.getByText("Bad Row").closest("tr")!;
      const cells = row.querySelectorAll("td");
      expect(cells[0]).toHaveTextContent("—");
      expect(row).not.toHaveTextContent("Invalid Date");
    });

    it("formats valid dates without leaking the raw ISO string", async () => {
      mockGet.mockResolvedValue({ data: [negativeTx], meta: { ...META, totalCount: 1 } });
      renderWidget();
      await waitFor(() => expect(screen.getByText("Migros")).toBeInTheDocument());
      const row = screen.getByText("Migros").closest("tr")!;
      expect(row).not.toHaveTextContent("2026-04-15");
      expect(row).not.toHaveTextContent("Invalid Date");
    });
  });
});
