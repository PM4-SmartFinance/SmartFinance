import { useState, useRef, useEffect } from "react";
import { useUpdateUser, type User, type UpdateUserInput } from "../lib/queries/users";
import { useAuth } from "../hooks/useAuth";
import { ApiError } from "../lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface EditUserDialogProps {
  isOpen: boolean;
  user: User | null;
  onClose: () => void;
}

interface FormState {
  role: "USER" | "ADMIN";
  active: boolean;
  error: string;
}

export function EditUserDialog({ isOpen, user, onClose }: EditUserDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const updateMutation = useUpdateUser();
  const { user: currentUser } = useAuth();

  const getInitialFormState = (): FormState => {
    if (!user) {
      return { role: "USER", active: true, error: "" };
    }
    return {
      role: user.role,
      active: user.active,
      error: "",
    };
  };

  const [formState, setFormState] = useState<FormState>(getInitialFormState);

  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [isOpen]);

  // Reset form state when editing a different user
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFormState(getInitialFormState());
  }, [user]);

  const handleDialogClose = () => {
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setFormState((prev) => ({ ...prev, error: "" }));

    try {
      const input: UpdateUserInput = {};

      if (formState.role !== user.role) {
        input.role = formState.role;
      }

      if (formState.active !== user.active) {
        input.active = formState.active;
      }

      if (Object.keys(input).length === 0) {
        setFormState((prev) => ({ ...prev, error: "No changes to save" }));
        return;
      }

      await updateMutation.mutateAsync({ id: user.id, input });
      onClose();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message || "Failed to update user" : "Failed to update user";
      setFormState((prev) => ({ ...prev, error: message }));
    }
  };

  if (!user) {
    return null;
  }

  // Admins cannot change the role of other admins (except themselves)
  const canChangeRole = user.id === currentUser?.id || user.role !== "ADMIN";

  const isSubmitting = updateMutation.isPending;

  return (
    <dialog
      ref={dialogRef}
      className="w-full max-w-md rounded-lg shadow-lg backdrop:bg-black/50 open:flex open:items-center open:justify-center"
      onClose={handleDialogClose}
    >
      <div className="rounded-lg bg-background p-6 shadow-lg">
        <h2 className="mb-6 text-xl font-semibold text-foreground">Edit User: {user.email}</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {formState.error && (
            <div className="rounded bg-red-50 p-2 text-sm text-red-600">{formState.error}</div>
          )}

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <select
              id="role"
              value={formState.role}
              onChange={(e) =>
                setFormState((prev) => ({ ...prev, role: e.target.value as "USER" | "ADMIN" }))
              }
              disabled={isSubmitting || !canChangeRole}
              className="w-full rounded border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="USER">User</option>
              <option value="ADMIN">Admin</option>
            </select>
            {!canChangeRole && (
              <p className="text-xs text-muted-foreground">
                Cannot change role of other admin users
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formState.active}
                onChange={(e) => setFormState((prev) => ({ ...prev, active: e.target.checked }))}
                disabled={isSubmitting}
                className="rounded border border-input"
              />
              <span>Active</span>
            </Label>
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting ? "Saving…" : "Save Changes"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleDialogClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
