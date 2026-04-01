import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface DeleteBudgetDialogProps {
  isOpen: boolean;
  budgetId: string;
  categoryName: string;
  monthYear: string;
  isDeleting?: boolean;
  error?: string;
  onConfirm: (budgetId: string) => void | Promise<void>;
  onCancel: () => void;
}

export function DeleteBudgetDialog({
  isOpen,
  budgetId,
  categoryName,
  monthYear,
  isDeleting,
  error,
  onConfirm,
  onCancel,
}: DeleteBudgetDialogProps) {
  const handleConfirmClick = () => {
    onConfirm(budgetId);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onCancel}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete Budget?</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete the budget for <strong>{categoryName}</strong> in{" "}
            <strong>{monthYear}</strong>? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {error && <div className="rounded bg-red-50 p-2 text-sm text-red-600">{error}</div>}

        <div className="flex gap-2">
          <Button
            variant="destructive"
            disabled={isDeleting}
            onClick={handleConfirmClick}
            className="flex-1"
          >
            {isDeleting ? "Deleting…" : "Delete"}
          </Button>
          <Button variant="outline" disabled={isDeleting} onClick={onCancel} className="flex-1">
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
