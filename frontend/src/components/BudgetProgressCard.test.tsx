import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BudgetProgressCard } from "./BudgetProgressCard";
import { Budget } from "../lib/queries/budgets";

let queryClient: QueryClient;

const mockBudget: Budget = {
  id: "budget-1",
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

const mockBudgetWarning: Budget = {
  ...mockBudget,
  currentSpending: "410.00",
  percentageUsed: 82,
  remainingAmount: "90.00",
};

const mockBudgetExceeded: Budget = {
  ...mockBudget,
  currentSpending: "550.00",
  percentageUsed: 110,
  remainingAmount: "-50.00",
  isOverBudget: true,
};

function renderWithQuery(component: React.ReactElement) {
  return render(<QueryClientProvider client={queryClient}>{component}</QueryClientProvider>);
}

describe("BudgetProgressCard", () => {
  const mockOnEdit = vi.fn();
  const mockOnDelete = vi.fn();

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockOnEdit.mockClear();
    mockOnDelete.mockClear();
  });

  it("renders the category name and month/year", () => {
    renderWithQuery(
      <BudgetProgressCard
        budget={mockBudget}
        categoryName="Groceries"
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />,
    );

    expect(screen.getByText("Groceries")).toBeInTheDocument();
    expect(screen.getByText("March 2026")).toBeInTheDocument();
  });

  it("displays spending information (spent, limit, remaining)", () => {
    renderWithQuery(
      <BudgetProgressCard
        budget={mockBudget}
        categoryName="Groceries"
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />,
    );

    expect(screen.getByText("$142.50")).toBeInTheDocument();
    expect(screen.getByText("$500.00")).toBeInTheDocument();
    expect(screen.getByText("$357.50 left")).toBeInTheDocument();
  });

  it("displays percentage used correctly", () => {
    renderWithQuery(
      <BudgetProgressCard
        budget={mockBudget}
        categoryName="Groceries"
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />,
    );

    expect(screen.getByText("29%")).toBeInTheDocument();
  });

  it("renders progress bar with correct width for normal state", () => {
    const { container } = renderWithQuery(
      <BudgetProgressCard
        budget={mockBudget}
        categoryName="Groceries"
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />,
    );

    const progressBar = container.querySelector("div.bg-blue-500");
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveStyle({ width: "28.5%" });
  });

  it("renders progress bar with yellow/orange color at 80% threshold", () => {
    const { container } = renderWithQuery(
      <BudgetProgressCard
        budget={mockBudgetWarning}
        categoryName="Groceries"
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />,
    );

    const progressBar = container.querySelector("div.bg-yellow-500");
    expect(progressBar).toBeInTheDocument();
  });

  it("displays warning state text when at 80%", () => {
    renderWithQuery(
      <BudgetProgressCard
        budget={mockBudgetWarning}
        categoryName="Groceries"
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />,
    );

    expect(screen.getByText("82%")).toBeInTheDocument();
  });

  it("renders progress bar with red color when budget is exceeded", () => {
    const { container } = renderWithQuery(
      <BudgetProgressCard
        budget={mockBudgetExceeded}
        categoryName="Groceries"
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />,
    );

    const progressBar = container.querySelector("div.bg-red-500");
    expect(progressBar).toBeInTheDocument();
  });

  it("displays 'Over Budget' message when budge is exceeded", () => {
    renderWithQuery(
      <BudgetProgressCard
        budget={mockBudgetExceeded}
        categoryName="Groceries"
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />,
    );

    expect(screen.getByText("Over Budget")).toBeInTheDocument();
  });

  it("caps progress bar at 100% when exceeded", () => {
    const { container } = renderWithQuery(
      <BudgetProgressCard
        budget={mockBudgetExceeded}
        categoryName="Groceries"
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />,
    );

    const progressBar = container.querySelector("div.bg-red-500");
    expect(progressBar).toHaveStyle({ width: "100%" });
  });

  it("renders Edit and Delete buttons", () => {
    renderWithQuery(
      <BudgetProgressCard
        budget={mockBudget}
        categoryName="Groceries"
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />,
    );

    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("calls onEdit when Edit button is clicked", () => {
    renderWithQuery(
      <BudgetProgressCard
        budget={mockBudget}
        categoryName="Groceries"
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />,
    );

    const editButton = screen.getByRole("button", { name: "Edit" });
    editButton.click();

    expect(mockOnEdit).toHaveBeenCalledWith(mockBudget);
  });

  it("calls onDelete when Delete button is clicked", () => {
    renderWithQuery(
      <BudgetProgressCard
        budget={mockBudget}
        categoryName="Groceries"
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />,
    );

    const deleteButton = screen.getByRole("button", { name: "Delete" });
    deleteButton.click();

    expect(mockOnDelete).toHaveBeenCalledWith(mockBudget);
  });

  it("disables Delete button when isDeleting is true", () => {
    renderWithQuery(
      <BudgetProgressCard
        budget={mockBudget}
        categoryName="Groceries"
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        isDeleting={true}
      />,
    );

    const deleteButton = screen.getByRole("button", { name: "Deleting…" });
    expect(deleteButton).toBeDisabled();
  });

  it("changes color states dynamically based on percentage", () => {
    const { container, rerender } = renderWithQuery(
      <BudgetProgressCard
        budget={mockBudget}
        categoryName="Groceries"
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />,
    );

    // Start with normal blue state
    expect(container.querySelector("div.bg-blue-500")).toBeInTheDocument();

    // Rerender with warning state
    rerender(
      <QueryClientProvider client={queryClient}>
        <BudgetProgressCard
          budget={mockBudgetWarning}
          categoryName="Groceries"
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      </QueryClientProvider>,
    );

    expect(container.querySelector("div.bg-yellow-500")).toBeInTheDocument();

    // Rerender with exceeded state
    rerender(
      <QueryClientProvider client={queryClient}>
        <BudgetProgressCard
          budget={mockBudgetExceeded}
          categoryName="Groceries"
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      </QueryClientProvider>,
    );

    expect(container.querySelector("div.bg-red-500")).toBeInTheDocument();
  });
});
