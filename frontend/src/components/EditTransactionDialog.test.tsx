import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditTransactionDialog } from "./EditTransactionDialog";
import type { Transaction } from "@/lib/queries/transactions";
import type { Category } from "@/lib/queries/categories";

// jsdom stubs for the native <dialog> element used by Dialog.
window.HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
  this.setAttribute("open", "");
});
window.HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
  this.removeAttribute("open");
});

const tx: Transaction = {
  id: "tx-1",
  amount: "-42.50",
  date: "2026-04-01",
  accountId: "acc-1",
  merchantId: "m-1",
  merchant: "Migros",
  categoryId: "cat-1",
  categoryName: "Groceries",
};

const categories: Category[] = [
  {
    id: "cat-1",
    categoryName: "Groceries",
    userId: "user-1",
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "cat-2",
    categoryName: "Transport",
    userId: "user-1",
    createdAt: "",
    updatedAt: "",
  },
];

describe("EditTransactionDialog (KAN-156)", () => {
  it("submits categoryId: null when 'No Category' is selected", async () => {
    const onSave = vi.fn();
    render(
      <EditTransactionDialog
        isOpen
        transaction={tx}
        categories={categories}
        isUpdating={false}
        error={null}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    );

    const select = screen.getByLabelText("Category") as HTMLSelectElement;
    await userEvent.selectOptions(select, "");

    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(onSave).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ id: "tx-1", categoryId: null }),
    );
  });

  it("submits the selected categoryId verbatim when a category is chosen", async () => {
    const onSave = vi.fn();
    render(
      <EditTransactionDialog
        isOpen
        transaction={tx}
        categories={categories}
        isUpdating={false}
        error={null}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    );

    await userEvent.selectOptions(screen.getByLabelText("Category"), "cat-2");
    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(onSave).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ id: "tx-1", categoryId: "cat-2" }),
    );
  });
});
