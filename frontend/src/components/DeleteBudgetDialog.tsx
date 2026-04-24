import { Button } from "@/components/ui/button";
import { useDialog } from "../hooks/useDialog";

interface DeleteBudgetDialogProps {
  isOpen: boolean;
  budgetId: string;
  categoryName: string;
  budgetLabel: string;
  isDeleting?: boolean;
  error?: string;
  onConfirm: (budgetId: string) => void | Promise<void>;
  onCancel: () => void;
}

export function DeleteBudgetDialog({
  isOpen,
  budgetId,
  categoryName,
  budgetLabel,
  isDeleting,
  error,
  onConfirm,
  onCancel,
}: DeleteBudgetDialogProps) {
  const dialogRef = useDialog(isOpen);

  const handleConfirmClick = () => {
    onConfirm(budgetId);
  };

  const handleDialogClose = () => {
    onCancel();
  };

  return (
    <dialog
      ref={dialogRef}
      className="m-auto w-full max-w-sm rounded-lg shadow-lg backdrop:bg-black/50 open:flex open:items-center open:justify-center"
      onClose={handleDialogClose}
    >
      <div className="w-full rounded-lg bg-background p-6 shadow-lg">
        <h2 className="mb-4 text-xl font-semibold text-foreground">Delete Budget?</h2>

        {error && <div className="mb-4 rounded bg-red-50 p-2 text-sm text-red-600">{error}</div>}

        <p className="mb-6 text-sm text-muted-foreground">
          Are you sure you want to delete the <strong>{budgetLabel}</strong> budget for{" "}
          <strong>{categoryName}</strong>? This action cannot be undone.
        </p>

        <div className="flex gap-2">
          <Button
            variant="destructive"
            disabled={isDeleting}
            onClick={handleConfirmClick}
            className="flex-1"
          >
            {isDeleting ? "Deleting…" : "Delete"}
          </Button>
          <Button
            variant="outline"
            disabled={isDeleting}
            onClick={handleDialogClose}
            className="flex-1"
          >
            Cancel
          </Button>
        </div>
      </div>
    </dialog>
  );
}
