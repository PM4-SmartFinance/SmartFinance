import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";

window.HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
  this.setAttribute("open", "");
});
window.HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
  this.removeAttribute("open");
});

describe("ConfirmDeleteDialog", () => {
  const defaultProps = {
    isOpen: true,
    title: "Delete Item?",
    description: "This action cannot be undone.",
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the title and description", () => {
    render(<ConfirmDeleteDialog {...defaultProps} />);
    expect(screen.getByText("Delete Item?")).toBeInTheDocument();
    expect(screen.getByText("This action cannot be undone.")).toBeInTheDocument();
  });

  it("renders ReactNode descriptions", () => {
    render(
      <ConfirmDeleteDialog
        {...defaultProps}
        description={
          <>
            Permanently delete <strong>thing-x</strong>?
          </>
        }
      />,
    );
    expect(screen.getByText("thing-x")).toBeInTheDocument();
  });

  it("calls onConfirm when the destructive button is clicked", async () => {
    const user = userEvent.setup();
    render(<ConfirmDeleteDialog {...defaultProps} />);
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(defaultProps.onConfirm).toHaveBeenCalledOnce();
  });

  it("calls onCancel when the cancel button is clicked", async () => {
    const user = userEvent.setup();
    render(<ConfirmDeleteDialog {...defaultProps} />);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(defaultProps.onCancel).toHaveBeenCalledOnce();
  });

  it("disables both buttons and shows 'Deleting…' when isDeleting", () => {
    render(<ConfirmDeleteDialog {...defaultProps} isDeleting />);
    expect(screen.getByRole("button", { name: "Deleting…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });

  it("renders an error alert when error is provided", () => {
    render(<ConfirmDeleteDialog {...defaultProps} error="Something went wrong" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
  });

  it("does not render an error alert when no error", () => {
    render(<ConfirmDeleteDialog {...defaultProps} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("respects custom confirm and cancel labels", () => {
    render(<ConfirmDeleteDialog {...defaultProps} confirmLabel="Remove" cancelLabel="Keep" />);
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep" })).toBeInTheDocument();
  });
});
