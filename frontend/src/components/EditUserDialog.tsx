import { useState } from "react";
import { useUpdateUser, type User, type UpdateUserInput } from "../lib/queries/users";
import { useAuth } from "../hooks/useAuth";
import { ApiError } from "../lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog } from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/native-select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

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
  const updateMutation = useUpdateUser();
  const { user: currentUser } = useAuth();
  const { t } = useTranslation();

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
        setFormState((prev) => ({
          ...prev,
          error: t("components.editUserDialog.errors.noChanges", "No changes to save"),
        }));
        return;
      }

      await updateMutation.mutateAsync({ id: user.id, input });
      onClose();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message ||
            t("components.editUserDialog.errors.updateFailed", "Failed to update user")
          : t("components.editUserDialog.errors.updateFailed", "Failed to update user");
      setFormState((prev) => ({ ...prev, error: message }));
    }
  };

  if (!user) {
    return null;
  }

  // Admins cannot change the role of other admins (except themselves)
  const canChangeRole = user.id === currentUser?.id || user.role !== "ADMIN";

  // Prevent admin self-demotion
  const canSaveDemotion = !(
    user.id === currentUser?.id &&
    currentUser?.role === "ADMIN" &&
    formState.role === "USER"
  );

  const isSubmitting = updateMutation.isPending;

  return (
    <Dialog key={user.id} isOpen={isOpen} onClose={handleDialogClose}>
      <h2 className="mb-6 text-xl font-semibold text-foreground">
        {t("components.editUserDialog.title", "Edit User: {{email}}", { email: user.email })}
      </h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {formState.error && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{formState.error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="role">{t("components.editUserDialog.roleLabel", "Role")}</Label>
          <NativeSelect
            id="role"
            value={formState.role}
            onChange={(e) =>
              setFormState((prev) => ({ ...prev, role: e.target.value as "USER" | "ADMIN" }))
            }
            disabled={isSubmitting || !canChangeRole}
          >
            <option value="USER">{t("components.createUserDialog.roles.user", "User")}</option>
            <option value="ADMIN">{t("components.createUserDialog.roles.admin", "Admin")}</option>
          </NativeSelect>
          {!canChangeRole && (
            <p className="text-xs text-muted-foreground">
              {t(
                "components.editUserDialog.warnings.cannotChangeAdmin",
                "Cannot change role of other admin users",
              )}
            </p>
          )}
          {!canSaveDemotion && (
            <p className="text-xs text-red-600">
              {t(
                "components.editUserDialog.warnings.cannotDemoteSelf",
                "Cannot demote yourself from admin",
              )}
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
            <span>{t("components.editUserDialog.activeLabel", "Active")}</span>
          </Label>
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={isSubmitting || !canSaveDemotion} className="flex-1">
            {isSubmitting ? t("common.saving", "Saving…") : t("common.saveChanges", "Save Changes")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleDialogClose}
            disabled={isSubmitting}
          >
            {t("common.cancel", "Cancel")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
