import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CreateEditBudgetDialog } from "./CreateEditBudgetDialog";
import { Budget } from "../lib/queries/budgets";

// Mock the HTML dialog element methods since jsdom doesn't support them fully
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
    },
    ApiError: MockApiError,
  };
});

import { api, ApiError } from "../lib/api";

const mockGet = vi.mocked(api.get);
const mockPost = vi.mocked(api.post);
const mockPatch = vi.mocked(api.patch);

const mockBudget: Budget = {
  id: "budget-1",
  categoryId: "cat-1",
  type: "MONTHLY",
  month: 0,
  year: 0,
  limitAmount: "500.00",
  active: true,
  isActive: true,
  priority: 1,
  currentSpending: "142.50",
  percentageUsed: 28.5,
  remainingAmount: "357.50",
  isOverBudget: false,
  createdAt: "2026-03-27T10:00:00.000Z",
  updatedAt: "2026-03-27T10:00:00.000Z",
};

const mockCategories = [
  { id: "cat-1", categoryName: "Groceries", userId: null, createdAt: "", updatedAt: "" },
  { id: "cat-2", categoryName: "Transport", userId: null, createdAt: "", updatedAt: "" },
];

function renderDialog(
  props: React.ComponentProps<typeof CreateEditBudgetDialog>,
  queryClient?: QueryClient,
) {
  const qc =
    queryClient ??
    new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  return {
    ...render(
      <QueryClientProvider client={qc}>
        <CreateEditBudgetDialog {...props} />
      </QueryClientProvider>,
    ),
    queryClient: qc,
  };
}

describe("CreateEditBudgetDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ categories: mockCategories });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("stale form state (F-1)", () => {
    it("does not show stale form data when switching from edit to create mode", () => {
      const onClose = vi.fn();
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });

      const { rerender } = renderDialog({ isOpen: true, budget: mockBudget, onClose }, queryClient);

      expect(screen.getByDisplayValue("500.00")).toBeInTheDocument();

      // Close dialog
      rerender(
        <QueryClientProvider client={queryClient}>
          <CreateEditBudgetDialog isOpen={false} budget={mockBudget} onClose={onClose} />
        </QueryClientProvider>,
      );

      // Reopen in create mode
      rerender(
        <QueryClientProvider client={queryClient}>
          <CreateEditBudgetDialog isOpen={true} budget={null} onClose={onClose} />
        </QueryClientProvider>,
      );

      const limitInput = screen.getByLabelText("Spending Limit") as HTMLInputElement;
      expect(limitInput.value).toBe("");
    });

    it("updates form state when budget prop changes to different budget", () => {
      const onClose = vi.fn();
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });

      const newBudget = { ...mockBudget, id: "budget-2", limitAmount: "750.00" };

      const { rerender } = renderDialog({ isOpen: true, budget: mockBudget, onClose }, queryClient);

      expect(screen.getByDisplayValue("500.00")).toBeInTheDocument();

      rerender(
        <QueryClientProvider client={queryClient}>
          <CreateEditBudgetDialog isOpen={true} budget={newBudget} onClose={onClose} />
        </QueryClientProvider>,
      );

      expect(screen.getByDisplayValue("750.00")).toBeInTheDocument();
      expect(screen.queryByDisplayValue("500.00")).not.toBeInTheDocument();
    });
  });

  describe("form rendering", () => {
    it("shows edit form when budget is provided", () => {
      renderDialog({ isOpen: true, budget: mockBudget, onClose: vi.fn() });

      expect(screen.getByLabelText("Spending Limit")).toHaveValue(500);
    });

    it("shows create form when budget is null", () => {
      renderDialog({ isOpen: true, budget: null, onClose: vi.fn() });

      const limitInput = screen.getByLabelText("Spending Limit") as HTMLInputElement;
      expect(limitInput.value).toBe("");
    });
  });

  describe("validation", () => {
    it("shows error for empty limit amount", async () => {
      const user = userEvent.setup();
      renderDialog({ isOpen: true, budget: null, onClose: vi.fn() });

      await user.click(screen.getByRole("button", { name: "Create Budget" }));

      expect(screen.getByText("Please enter a valid limit amount")).toBeInTheDocument();
    });

    it("shows error for zero limit amount", async () => {
      const user = userEvent.setup();
      renderDialog({ isOpen: true, budget: null, onClose: vi.fn() });

      const limitInput = screen.getByLabelText("Spending Limit");
      await user.type(limitInput, "0");
      await user.click(screen.getByRole("button", { name: "Create Budget" }));

      expect(screen.getByText("Please enter a valid limit amount")).toBeInTheDocument();
    });

    it("shows error for missing category in create mode", async () => {
      const user = userEvent.setup();
      renderDialog({ isOpen: true, budget: null, onClose: vi.fn() });

      const limitInput = screen.getByLabelText("Spending Limit");
      await user.type(limitInput, "100");
      await user.click(screen.getByRole("button", { name: "Create Budget" }));

      expect(screen.getByText("Please select a category")).toBeInTheDocument();
    });

    it("shows error for missing month and year in specific mode", async () => {
      const user = userEvent.setup();
      renderDialog({ isOpen: true, budget: null, onClose: vi.fn() });

      await waitFor(() => expect(screen.getByText("Groceries")).toBeInTheDocument());

      const limitInput = screen.getByLabelText("Spending Limit");
      await user.type(limitInput, "100");
      await user.selectOptions(screen.getByLabelText("Category"), "cat-1");
      // Switch to specific mode
      await user.click(screen.getByRole("button", { name: "Specific" }));
      await user.click(screen.getByRole("button", { name: "Create Budget" }));

      expect(
        screen.getByText("Please select at least a month or year for specific budgets"),
      ).toBeInTheDocument();
    });
  });

  describe("submission", () => {
    it("calls api.post on create and closes dialog on success", async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();
      const createdBudget = { ...mockBudget, id: "new-budget" };
      mockPost.mockResolvedValue({ budget: createdBudget });

      renderDialog({ isOpen: true, budget: null, onClose });

      await waitFor(() => expect(screen.getByText("Groceries")).toBeInTheDocument());

      await user.selectOptions(screen.getByLabelText("Category"), "cat-1");
      await user.type(screen.getByLabelText("Spending Limit"), "500");
      await user.click(screen.getByRole("button", { name: "Create Budget" }));

      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(mockPost).toHaveBeenCalledWith("/budgets", {
        categoryId: "cat-1",
        type: "MONTHLY",
        limitAmount: 500,
      });
    });

    it("calls api.patch on edit and closes dialog on success", async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();
      const updatedBudget = { ...mockBudget, limitAmount: "750.00" };
      mockPatch.mockResolvedValue({ budget: updatedBudget });

      renderDialog({ isOpen: true, budget: mockBudget, onClose });

      const limitInput = screen.getByLabelText("Spending Limit");
      await user.clear(limitInput);
      await user.type(limitInput, "750");
      await user.click(screen.getByRole("button", { name: "Save Changes" }));

      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(mockPatch).toHaveBeenCalledWith("/budgets/budget-1", {
        categoryId: "cat-1",
        type: "MONTHLY",
        month: 0,
        year: 0,
        limitAmount: 750,
      });
    });

    it("displays ApiError message on failed create", async () => {
      const user = userEvent.setup();
      mockPost.mockRejectedValue(
        new ApiError(409, null, "Budget already exists for this category and type"),
      );

      renderDialog({ isOpen: true, budget: null, onClose: vi.fn() });

      await waitFor(() => expect(screen.getByText("Groceries")).toBeInTheDocument());

      await user.selectOptions(screen.getByLabelText("Category"), "cat-1");
      await user.type(screen.getByLabelText("Spending Limit"), "500");
      await user.click(screen.getByRole("button", { name: "Create Budget" }));

      await waitFor(() =>
        expect(
          screen.getByText("Budget already exists for this category and type"),
        ).toBeInTheDocument(),
      );
    });
  });
});
