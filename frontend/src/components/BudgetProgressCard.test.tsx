import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BudgetCategoryGroup } from "./BudgetProgressCard";
import { Budget } from "../lib/queries/budgets";

const mockBudget: Budget = {
  id: "budget-1",
  categoryId: "cat-1",
  type: "SPECIFIC_MONTH_YEAR" as const,
  month: new Date().getMonth() + 1,
  year: new Date().getFullYear(),
  limitAmount: "500.00",
  active: true,
  currentSpending: "142.50",
  percentageUsed: 28.5,
  remainingAmount: "357.50",
  isOverBudget: false,
  createdAt: "2026-03-27T10:00:00.000Z",
  updatedAt: "2026-03-27T10:00:00.000Z",
};

const mockBudgetMonthly: Budget = {
  ...mockBudget,
  id: "budget-2",
  type: "MONTHLY",
  month: 0,
  year: 0,
  limitAmount: "600.00",
  currentSpending: "410.00",
  percentageUsed: 82,
  remainingAmount: "90.00",
};

const mockBudgetExceeded: Budget = {
  ...mockBudget,
  id: "budget-3",
  type: "DAILY",
  month: 0,
  year: 0,
  limitAmount: "20.00",
  currentSpending: "25.00",
  percentageUsed: 125,
  remainingAmount: "-5.00",
  isOverBudget: true,
};

describe("BudgetCategoryGroup", () => {
  const mockOnEdit = vi.fn();
  const mockOnDelete = vi.fn();

  beforeEach(() => {
    mockOnEdit.mockClear();
    mockOnDelete.mockClear();
  });

  it("renders category name as header", () => {
    render(
      <BudgetCategoryGroup
        categoryName="Groceries"
        budgets={[mockBudget]}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />,
    );

    expect(screen.getByText("Groceries")).toBeInTheDocument();
  });

  it("renders summary bar for most specific active budget", () => {
    render(
      <BudgetCategoryGroup
        categoryName="Groceries"
        budgets={[mockBudgetMonthly, mockBudget]}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />,
    );

    const summary = screen.getByTestId("category-summary");
    expect(summary).toBeInTheDocument();
    // SPECIFIC_MONTH_YEAR is more specific than MONTHLY, should show its data
    expect(summary).toHaveTextContent("$142.50");
    expect(summary).toHaveTextContent("of $500.00");
  });

  it("renders spending info in both summary and budget row", () => {
    render(
      <BudgetCategoryGroup
        categoryName="Groceries"
        budgets={[mockBudget]}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />,
    );

    // Appears in both summary and row
    expect(screen.getAllByText("$142.50").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("$500.00").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("$357.50 left")).toBeInTheDocument();
  });

  it("renders multiple budget rows in one group", () => {
    render(
      <BudgetCategoryGroup
        categoryName="Groceries"
        budgets={[mockBudget, mockBudgetMonthly, mockBudgetExceeded]}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />,
    );

    expect(screen.getByText("Monthly Budget")).toBeInTheDocument();
    expect(screen.getByText("Daily Budget")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(3);
    expect(screen.getAllByRole("button", { name: "Delete" })).toHaveLength(3);
  });

  it("renders progress bars with correct colors", () => {
    const { container } = render(
      <BudgetCategoryGroup
        categoryName="Groceries"
        budgets={[mockBudget, mockBudgetMonthly, mockBudgetExceeded]}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />,
    );

    // Blue (28.5%), yellow (82%), red (125%) + summary bar
    expect(container.querySelectorAll("div.bg-blue-500").length).toBeGreaterThanOrEqual(1);
    expect(container.querySelectorAll("div.bg-yellow-500").length).toBeGreaterThanOrEqual(1);
    expect(container.querySelectorAll("div.bg-red-500").length).toBeGreaterThanOrEqual(1);
  });

  it("shows 'Over' indicator when budget is exceeded", () => {
    render(
      <BudgetCategoryGroup
        categoryName="Groceries"
        budgets={[mockBudgetExceeded]}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />,
    );

    expect(screen.getByText("Over")).toBeInTheDocument();
  });

  it("caps progress bar at 100% when exceeded", () => {
    const { container } = render(
      <BudgetCategoryGroup
        categoryName="Groceries"
        budgets={[mockBudgetExceeded]}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />,
    );

    const redBars = container.querySelectorAll("div.bg-red-500");
    for (const bar of redBars) {
      expect(bar).toHaveStyle({ width: "100%" });
    }
  });

  it("calls onEdit with correct budget when Edit is clicked", () => {
    render(
      <BudgetCategoryGroup
        categoryName="Groceries"
        budgets={[mockBudget]}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />,
    );

    screen.getByRole("button", { name: "Edit" }).click();
    expect(mockOnEdit).toHaveBeenCalledWith(mockBudget);
  });

  it("calls onDelete with correct budget when Delete is clicked", () => {
    render(
      <BudgetCategoryGroup
        categoryName="Groceries"
        budgets={[mockBudget]}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />,
    );

    screen.getByRole("button", { name: "Delete" }).click();
    expect(mockOnDelete).toHaveBeenCalledWith(mockBudget);
  });

  it("disables Delete button for the budget being deleted", () => {
    render(
      <BudgetCategoryGroup
        categoryName="Groceries"
        budgets={[mockBudget, mockBudgetMonthly]}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        deletingBudgetId="budget-1"
      />,
    );

    const deleteButtons = screen.getAllByRole("button", { name: /Delete|…/ });
    expect(deleteButtons[0]).toBeDisabled();
    expect(deleteButtons[1]).not.toBeDisabled();
  });
});
