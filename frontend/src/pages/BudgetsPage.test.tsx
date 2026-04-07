import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BudgetsPage } from "./BudgetsPage";
import { Budget } from "../lib/queries/budgets";

window.HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
  this.setAttribute("open", "");
});
window.HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
  this.removeAttribute("open");
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
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    },
    ApiError: MockApiError,
  };
});

import { api } from "../lib/api";

const mockGet = vi.mocked(api.get);

const baseBudget: Budget = {
  id: "b-1",
  categoryId: "cat-1",
  month: 3,
  year: 2026,
  limitAmount: "500.00",
  active: true,
  currentSpending: "142.50",
  percentageUsed: 28.5,
  remainingAmount: "357.50",
  isOverBudget: false,
  createdAt: "2026-03-27T10:00:00.000Z",
  updatedAt: "2026-03-27T10:00:00.000Z",
};

const secondBudget: Budget = {
  ...baseBudget,
  id: "b-2",
  categoryId: "cat-2",
  limitAmount: "300.00",
  currentSpending: "90.00",
  percentageUsed: 30,
  remainingAmount: "210.00",
};

const mockCategories = [
  { id: "cat-1", name: "Groceries", userId: null, createdAt: "", updatedAt: "" },
  { id: "cat-2", name: "Transport", userId: null, createdAt: "", updatedAt: "" },
];

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <BudgetsPage />
    </QueryClientProvider>,
  );
}

function mockApiRoutes(overrides?: {
  budgets?: Budget[] | Error;
  categories?: typeof mockCategories | Error;
}) {
  const budgets = overrides?.budgets ?? [baseBudget, secondBudget];
  const categories = overrides?.categories ?? mockCategories;

  mockGet.mockImplementation(((path: string) => {
    if (path === "/budgets") {
      return budgets instanceof Error ? Promise.reject(budgets) : Promise.resolve({ budgets });
    }
    if (path === "/categories") {
      return categories instanceof Error
        ? Promise.reject(categories)
        : Promise.resolve({ categories });
    }
    return Promise.resolve({});
  }) as typeof api.get);
}

describe("BudgetsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state while fetching budgets", () => {
    // Never resolve the budgets request
    mockGet.mockImplementation((path: string) => {
      if (path === "/categories") return Promise.resolve({ categories: mockCategories });
      return new Promise(() => {});
    });

    renderPage();

    expect(screen.getByText(/Loading budgets/)).toBeInTheDocument();
  });

  it("shows error state when budgets fetch fails", async () => {
    mockApiRoutes({ budgets: new Error("Network error") });

    renderPage();

    await waitFor(() => expect(screen.getByText("Failed to load budgets")).toBeInTheDocument());
  });

  it("shows empty state when no budgets exist", async () => {
    mockApiRoutes({ budgets: [] });

    renderPage();

    await waitFor(() => expect(screen.getByText(/No budgets yet/)).toBeInTheDocument());
  });

  it("renders correct number of budget cards", async () => {
    mockApiRoutes();

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText("Groceries").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Transport").length).toBeGreaterThanOrEqual(1);
    });

    // Two budget cards rendered (each has Edit + Delete buttons)
    expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(2);
  });

  it("falls back to categoryId when category is not found", async () => {
    const unknownCategoryBudget: Budget = {
      ...baseBudget,
      id: "b-unknown",
      categoryId: "cat-unknown",
    };
    mockApiRoutes({ budgets: [unknownCategoryBudget] });

    renderPage();

    await waitFor(() => expect(screen.getByText("cat-unknown")).toBeInTheDocument());
  });

  it("opens create dialog when Create Budget button is clicked", async () => {
    mockApiRoutes();

    renderPage();

    await waitFor(() => expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(2));

    const showModalMock = vi.mocked(window.HTMLDialogElement.prototype.showModal);
    const callsBefore = showModalMock.mock.calls.length;

    screen.getByRole("button", { name: "Create Budget" }).click();

    await waitFor(() => expect(showModalMock.mock.calls.length).toBeGreaterThan(callsBefore));
  });

  it("shows categories error when categories fetch fails", async () => {
    mockApiRoutes({ categories: new Error("Categories failed") });

    renderPage();

    await waitFor(() => expect(screen.getByText("Failed to load categories")).toBeInTheDocument());
  });
});
