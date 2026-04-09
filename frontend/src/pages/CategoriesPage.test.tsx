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

import { CategoriesPage } from "./CategoriesPage";

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
        return Promise.resolve({ matchCount: 7 });
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
      expect(screen.getByDisplayValue("coop")).toBeInTheDocument();
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

  it("calls match preview endpoint and shows result", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Groceries")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("New rule pattern for Groceries"), {
      target: { value: "coop" },
    });
    const previewButtons = screen.getAllByRole("button", { name: "Match Preview" });
    expect(previewButtons.length).toBeGreaterThan(0);
    fireEvent.click(previewButtons[0]!);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith("/category-rules/preview", {
        categoryId: "cat-1",
        pattern: "coop",
        matchType: "contains",
        priority: 0,
      });
      expect(screen.getByText("7 existing transactions would match.")).toBeInTheDocument();
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
      expect(screen.getByDisplayValue("coop")).toBeInTheDocument();
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
    mockDelete.mockImplementation((path: string) => {
      if (path === "/categories/cat-1") {
        const error = new Error("Category is in use");
        return Promise.reject(error);
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
});
