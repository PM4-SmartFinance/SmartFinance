import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { AlertCircle } from "lucide-react";

interface ConfirmDeleteDialogProps {
  isOpen: boolean;
  title: string;
  description: ReactNode;
  error?: string | null;
  isDeleting?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  size?: "sm" | "md";
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

export function ConfirmDeleteDialog({
  isOpen,
  title,
  description,
  error,
  isDeleting = false,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  size,
  onConfirm,
  onCancel,
}: ConfirmDeleteDialogProps) {
  const [reason, setReason] = useState("");
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

  if (isOpen && !prevIsOpen) {
    setPrevIsOpen(true);
    setReason("");
  } else if (!isOpen && prevIsOpen) {
    setPrevIsOpen(false);
  }

  return (
    <Dialog isOpen={isOpen} onClose={onCancel} {...(size ? { size } : {})}>
      <h2 className="mb-2 text-xl font-semibold text-foreground">{title}</h2>
      <div className="mb-6 text-sm text-muted-foreground">{description}</div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="mb-6 space-y-2">
        <Label htmlFor="delete-reason">Reason for deletion (Audit Log - Optional)</Label>
        <textarea
          id="delete-reason"
          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="e.g., Duplicate entry"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={isDeleting}
        />
      </div>

      <div className="flex gap-2">
        <Button
          variant="destructive"
          disabled={isDeleting}
          onClick={() => onConfirm(reason)}
          className="flex-1"
        >
          {isDeleting ? "Deleting…" : confirmLabel}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isDeleting}
          onClick={onCancel}
          className="flex-1"
        >
          {cancelLabel}
        </Button>
      </div>
    </Dialog>
  );
}
