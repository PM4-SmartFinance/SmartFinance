import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { api } from "../lib/api";
import type { Category, CategoryRule } from "../lib/queries/categories";

vi.mock("../lib/api", () => {
  class ApiError extends Error {
    status: number;

    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  }

  return {
    api: {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    },
    ApiError,
  };
});

import { CategoriesPage, formatDateId } from "./CategoriesPage";

let categories: Category[] = [
  {
    id: "cat-1",
    categoryName: "Groceries",
    userId: "user-1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "cat-2",
    categoryName: "Rent",
    userId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

let rules: CategoryRule[] = [
  {
    id: "rule-1",
    userId: "user-1",
    categoryId: "cat-1",
    pattern: "coop",
    matchType: "contains" as const,
    priority: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const mockGet = api.get as ReturnType<typeof vi.fn>;
const mockPost = api.post as ReturnType<typeof vi.fn>;
const mockPatch = api.patch as ReturnType<typeof vi.fn>;
const mockDelete = api.delete as ReturnType<typeof vi.fn>;

function renderWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CategoriesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("formatDateId", () => {
  it("formats a standard date in de-CH locale", () => {
    expect(formatDateId(20260412)).toMatch(/12.*4.*2026/);
  });

  it("formats January 1st correctly", () => {
    expect(formatDateId(20250101)).toMatch(/1.*1.*2025/);
  });

  it("formats December 31st correctly", () => {
    expect(formatDateId(20251231)).toMatch(/31.*12.*2025/);
  });

  it("handles single-digit month and day", () => {
    expect(formatDateId(20250307)).toMatch(/7.*3.*2025/);
  });
});

describe("CategoriesPage", () => {
  beforeEach(() => {
    categories = [
      {
        id: "cat-1",
        categoryName: "Groceries",
        userId: "user-1",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "cat-2",
        categoryName: "Rent",
        userId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    rules = [
      {
        id: "rule-1",
        userId: "user-1",
        categoryId: "cat-1",
        pattern: "coop",
        matchType: "contains",
        priority: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    mockGet.mockImplementation((path: string) => {
      if (path === "/categories") {
        return Promise.resolve({ categories });
      }
      if (path === "/category-rules") {
        return Promise.resolve({ rules });
      }
      return Promise.resolve({});
    });

    mockPost.mockImplementation((path: string, body: unknown) => {
      if (path === "/categories") {
        const payload = body as { categoryName: string };
        categories = [
          ...categories,
          {
            id: `cat-${categories.length + 1}`,
            categoryName: payload.categoryName,
            userId: "user-1",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ];
        return Promise.resolve(categories[categories.length - 1]);
      }

      if (path === "/category-rules") {
        const payload = body as {
          categoryId: string;
          pattern: string;
          matchType: "exact" | "contains";
          priority: number;
        };
        rules = [
          ...rules,
          {
            id: `rule-${rules.length + 1}`,
            userId: "user-1",
            ...payload,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ];
        return Promise.resolve({ rule: rules[rules.length - 1] });
      }

      if (path === "/category-rules/preview") {
        return Promise.resolve({
          matchCount: 7,
          matchedTransactions: [
            {
              id: "tx-1",
              merchantName: "Coop",
              amount: -12.5,
              dateId: 20260412,
            },
            {
              id: "tx-2",
              merchantName: "Coop City",
              amount: -8.75,
              dateId: 20260413,
            },
            {
              id: "tx-3",
              merchantName: "Coop Extra",
              amount: -5.25,
              dateId: 20260414,
            },
          ],
        });
      }

      return Promise.resolve({});
    });

    mockPatch.mockImplementation((path: string) => {
      if (path.startsWith("/categories/")) {
        return Promise.resolve({});
      }
      if (path.startsWith("/category-rules/")) {
        return Promise.resolve({});
      }
      return Promise.resolve({});
    });

    mockDelete.mockResolvedValue(undefined);
  });

  it("renders categories and existing rules", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Groceries")).toBeInTheDocument();
      expect(screen.getByText("Rent")).toBeInTheDocument();
      expect(screen.getByText("Global category (read-only)")).toBeInTheDocument();
      expect(screen.getByText("coop")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Back to Dashboard" })).toBeInTheDocument();
    });
  });

  it("creates a category and triggers refetch via invalidation", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Groceries")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Subscriptions" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith("/categories", { categoryName: "Subscriptions" });
    });

    await waitFor(() => {
      const categoryGetCalls = mockGet.mock.calls.filter((call) => call[0] === "/categories");
      expect(categoryGetCalls.length).toBeGreaterThan(1);
    });
  });

  it("shows matching transactions from live preview", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Groceries")).toBeInTheDocument();
    });

    const input = screen.getByLabelText("New rule pattern for Groceries");
    fireEvent.change(input, { target: { value: "co" } });

    await waitFor(() => {
      expect(screen.getByText("7 existing transactions would match.")).toBeInTheDocument();
      const matchingSection = screen
        .getByText("7 existing transactions would match.")
        .closest("div");
      expect(matchingSection).toBeTruthy();
      const transactionItems = within(matchingSection!).getAllByRole("listitem");
      expect(transactionItems).toHaveLength(3);
      expect(transactionItems[0]).toHaveTextContent("Coop");
      expect(transactionItems[1]).toHaveTextContent("Coop City");
      expect(transactionItems[2]).toHaveTextContent("Coop Extra");
    });
  });

  it("creates a rule and triggers refetch via invalidation", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Groceries")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("New rule pattern for Groceries"), {
      target: { value: "migros" },
    });
    const addRuleButtons = screen.getAllByRole("button", { name: "Add Rule" });
    expect(addRuleButtons.length).toBeGreaterThan(0);
    fireEvent.click(addRuleButtons[0]!);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith("/category-rules", {
        categoryId: "cat-1",
        pattern: "migros",
        matchType: "contains",
        priority: 0,
      });
    });

    await waitFor(() => {
      const ruleGetCalls = mockGet.mock.calls.filter((call) => call[0] === "/category-rules");
      expect(ruleGetCalls.length).toBeGreaterThan(1);
    });
  });

  it("calls preview endpoint live and updates the preview chip", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Groceries")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("New rule pattern for Groceries"), {
      target: { value: "coop" },
    });

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith("/category-rules/preview", {
        categoryId: "cat-1",
        pattern: "coop",
        matchType: "contains",
        priority: 0,
      });
      expect(screen.getByText("7 existing transactions would match.")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("New rule match type for Groceries"), {
      target: { value: "exact" },
    });

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith("/category-rules/preview", {
        categoryId: "cat-1",
        pattern: "coop",
        matchType: "exact",
        priority: 0,
      });
    });
  });

  it("shows inline preview error for invalid live preview requests", async () => {
    const { ApiError: MockApiError } = await import("../lib/api");
    mockPost.mockImplementation((path: string, body: unknown) => {
      if (path === "/categories") {
        const payload = body as { categoryName: string };
        categories = [
          ...categories,
          {
            id: `cat-${categories.length + 1}`,
            categoryName: payload.categoryName,
            userId: "user-1",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ];
        return Promise.resolve(categories[categories.length - 1]);
      }

      if (path === "/category-rules") {
        const payload = body as {
          categoryId: string;
          pattern: string;
          matchType: "exact" | "contains";
          priority: number;
        };
        rules = [
          ...rules,
          {
            id: `rule-${rules.length + 1}`,
            userId: "user-1",
            ...payload,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ];
        return Promise.resolve({ rule: rules[rules.length - 1] });
      }

      if (path === "/category-rules/preview") {
        return Promise.reject(new MockApiError(422, "Pattern must be at least 2 characters."));
      }

      return Promise.resolve({});
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Groceries")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("New rule pattern for Groceries"), {
      target: { value: "x" },
    });

    const groceriesCard = screen.getByText("Groceries").closest('[data-slot="card"]');
    expect(groceriesCard).toBeTruthy();

    await waitFor(() => {
      expect(
        within(groceriesCard!).getByText("Pattern must be at least 2 characters."),
      ).toBeInTheDocument();
    });
  });

  it("updates a category and invalidates categories and rules queries", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Groceries")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Edit category Groceries" }));
    fireEvent.change(screen.getByLabelText("Edit category Groceries"), {
      target: { value: "Food" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save category Groceries" }));

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith("/categories/cat-1", { categoryName: "Food" });
    });

    await waitFor(() => {
      const categoryGetCalls = mockGet.mock.calls.filter((call) => call[0] === "/categories");
      const ruleGetCalls = mockGet.mock.calls.filter((call) => call[0] === "/category-rules");
      expect(categoryGetCalls.length).toBeGreaterThan(1);
      expect(ruleGetCalls.length).toBeGreaterThan(1);
    });
  });

  it("deletes a rule and invalidates rules query", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("coop")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Delete rule rule-1" }));

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith("/category-rules/rule-1");
    });

    await waitFor(() => {
      const ruleGetCalls = mockGet.mock.calls.filter((call) => call[0] === "/category-rules");
      expect(ruleGetCalls.length).toBeGreaterThan(1);
    });
  });

  it("shows deletion warning near category when backend blocks deletion", async () => {
    const { ApiError: MockApiError } = await import("../lib/api");
    mockDelete.mockImplementation((path: string) => {
      if (path === "/categories/cat-1") {
        return Promise.reject(new MockApiError(409, "Category is in use"));
      }
      return Promise.resolve(undefined);
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Groceries")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Delete category Groceries" }));

    const groceriesCard = screen.getByText("Groceries").closest('[data-slot="card"]');
    expect(groceriesCard).toBeTruthy();

    await waitFor(() => {
      expect(within(groceriesCard!).getByText("Category is in use")).toBeInTheDocument();
    });
  });

  it("shows validation error when creating category with empty name", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Groceries")).toBeInTheDocument();
    });

    mockPost.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(screen.getByText("Category name is required.")).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("shows validation error when saving category edit with empty name", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Groceries")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Edit category Groceries" }));
    fireEvent.change(screen.getByLabelText("Edit category Groceries"), {
      target: { value: "   " },
    });
    mockPatch.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Save category Groceries" }));

    const groceriesCard = screen
      .getByLabelText("Edit category Groceries")
      .closest('[data-slot="card"]');
    expect(groceriesCard).toBeTruthy();

    await waitFor(() => {
      expect(within(groceriesCard!).getByText("Category name is required.")).toBeInTheDocument();
    });
    expect(mockPatch).not.toHaveBeenCalled();
  });

  it("shows validation error when adding rule with empty pattern", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Groceries")).toBeInTheDocument();
    });

    mockPost.mockClear();
    const addRuleButtons = screen.getAllByRole("button", { name: "Add Rule" });
    fireEvent.click(addRuleButtons[0]!);

    const groceriesCard = screen.getByText("Groceries").closest('[data-slot="card"]');
    expect(groceriesCard).toBeTruthy();

    await waitFor(() => {
      expect(within(groceriesCard!).getByText("Rule pattern is required.")).toBeInTheDocument();
    });
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("updates an existing rule via save", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("coop")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Edit rule rule-1" }));

    fireEvent.change(screen.getByLabelText("Rule pattern rule-1"), {
      target: { value: "migros" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save rule rule-1" }));

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith("/category-rules/rule-1", {
        pattern: "migros",
        matchType: "contains",
        priority: 1,
        categoryId: "cat-1",
      });
    });
  });

  it("shows validation error when saving rule with empty pattern", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("coop")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Edit rule rule-1" }));

    fireEvent.change(screen.getByLabelText("Rule pattern rule-1"), {
      target: { value: "" },
    });
    mockPatch.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Save rule rule-1" }));

    const groceriesCard = screen.getByText("Groceries").closest('[data-slot="card"]');
    expect(groceriesCard).toBeTruthy();

    await waitFor(() => {
      expect(within(groceriesCard!).getByText("Rule pattern is required.")).toBeInTheDocument();
    });
    expect(mockPatch).not.toHaveBeenCalled();
  });
});
