import { useRef, useEffect } from "react";
import { useDeleteUser, type User } from "../lib/queries/users";
import { ApiError } from "../lib/api";
import { Button } from "@/components/ui/button";

interface DeleteUserDialogProps {
  isOpen: boolean;
  user: User | null;
  onClose: () => void;
  onDeleteSuccess?: (() => void) | undefined;
}

export function DeleteUserDialog({
  isOpen,
  user,
  onClose,
  onDeleteSuccess,
}: DeleteUserDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const deleteMutation = useDeleteUser();

  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [isOpen]);

  const handleDelete = async () => {
    if (!user) return;
    try {
      await deleteMutation.mutateAsync(user.id);
      onClose();
      onDeleteSuccess?.();
    } catch {
      // Error is handled by the mutation
    }
  };

  if (!user) {
    return null;
  }

  const isDeleting = deleteMutation.isPending;
  const errorMessage =
    deleteMutation.error instanceof ApiError
      ? deleteMutation.error.message
      : deleteMutation.error
        ? "Failed to delete user"
        : null;

  return (
    <dialog
      ref={dialogRef}
      className="w-full max-w-md rounded-lg shadow-lg backdrop:bg-black/50 open:flex open:items-center open:justify-center"
      onClose={onClose}
      key={user?.id}
    >
      <div className="rounded-lg bg-background p-6 shadow-lg">
        <h2 className="mb-2 text-xl font-semibold text-foreground">Delete User?</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Permanently delete <span className="font-medium">{user.email}</span>? This action cannot
          be undone.
        </p>

        {errorMessage && (
          <div className="mb-4 rounded bg-red-50 p-2 text-sm text-red-600">{errorMessage}</div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={handleDelete}
            disabled={isDeleting}
            variant="destructive"
            className="flex-1"
          >
            {isDeleting ? "Deleting…" : "Delete"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isDeleting}
            className="flex-1"
          >
            Cancel
          </Button>
        </div>
      </div>
    </dialog>
  );
}
