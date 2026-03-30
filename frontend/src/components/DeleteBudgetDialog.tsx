import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DeleteBudgetDialogProps {
  isOpen: boolean;
  budgetId: string;
  categoryName: string;
  monthYear: string;
  isDeleting?: boolean;
  onConfirm: (budgetId: string) => void;
  onCancel: () => void;
}

export function DeleteBudgetDialog({
  isOpen,
  budgetId,
  categoryName,
  monthYear,
  isDeleting,
  onConfirm,
  onCancel,
}: DeleteBudgetDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Delete Budget?</CardTitle>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete the budget for <strong>{categoryName}</strong> in{" "}
            <strong>{monthYear}</strong>? This action cannot be undone.
          </p>

          <div className="flex gap-2">
            <Button
              variant="destructive"
              disabled={isDeleting}
              onClick={() => onConfirm(budgetId)}
              className="flex-1"
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </Button>
            <Button variant="outline" disabled={isDeleting} onClick={onCancel} className="flex-1">
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
