import { type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ConfirmDeleteDialogProps {
  isOpen: boolean;
  title: string;
  description: ReactNode;
  error?: string | null;
  isDeleting?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  size?: "sm" | "md";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDeleteDialog({
  isOpen,
  title,
  description,
  error,
  isDeleting = false,
  confirmLabel,
  cancelLabel,
  size,
  onConfirm,
  onCancel,
}: ConfirmDeleteDialogProps) {
  const { t } = useTranslation();

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

      <div className="flex gap-2">
        <Button
          variant="destructive"
          disabled={isDeleting}
          onClick={onConfirm}
          className="flex-1"
        >
          {isDeleting
            ? t("common.deleting", "Deleting…")
            : (confirmLabel || t("common.delete", "Delete"))}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isDeleting}
          onClick={onCancel}
          className="flex-1"
        >
          {cancelLabel || t("common.cancel", "Cancel")}
        </Button>
      </div>
    </Dialog>
  );
}
