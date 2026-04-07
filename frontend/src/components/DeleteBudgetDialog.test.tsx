import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DeleteBudgetDialog } from "./DeleteBudgetDialog";

window.HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
  this.setAttribute("open", "");
});
window.HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
  this.removeAttribute("open");
});

describe("DeleteBudgetDialog", () => {
  const defaultProps = {
    isOpen: true,
    budgetId: "budget-1",
    categoryName: "Groceries",
    monthYear: "March 2026",
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders category name and month/year in confirmation text", () => {
    render(<DeleteBudgetDialog {...defaultProps} />);

    expect(screen.getByText("Groceries")).toBeInTheDocument();
    expect(screen.getByText("March 2026")).toBeInTheDocument();
  });

  it("calls onConfirm with budgetId when Delete button is clicked", () => {
    render(<DeleteBudgetDialog {...defaultProps} />);

    screen.getByRole("button", { name: "Delete" }).click();

    expect(defaultProps.onConfirm).toHaveBeenCalledWith("budget-1");
  });

  it("calls onCancel when Cancel button is clicked", () => {
    render(<DeleteBudgetDialog {...defaultProps} />);

    screen.getByRole("button", { name: "Cancel" }).click();

    expect(defaultProps.onCancel).toHaveBeenCalledOnce();
  });

  it("disables both buttons and shows 'Deleting...' when isDeleting is true", () => {
    render(<DeleteBudgetDialog {...defaultProps} isDeleting={true} />);

    const deleteButton = screen.getByRole("button", { name: "Deleting\u2026" });
    const cancelButton = screen.getByRole("button", { name: "Cancel" });

    expect(deleteButton).toBeDisabled();
    expect(cancelButton).toBeDisabled();
  });

  it("renders error banner when error prop is provided", () => {
    render(<DeleteBudgetDialog {...defaultProps} error="Something went wrong" />);

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("does not render error banner when error prop is absent", () => {
    render(<DeleteBudgetDialog {...defaultProps} />);

    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });
});
