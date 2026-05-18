import { useState } from "react";
import { useCreateUser, type CreateUserInput } from "../lib/queries/users";
import { ApiError } from "../lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog } from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/native-select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

interface CreateUserDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FormState {
  email: string;
  password: string;
  displayName: string;
  role: "USER" | "ADMIN";
  error: string;
}

export function CreateUserDialog({ isOpen, onClose }: CreateUserDialogProps) {
  const [formState, setFormState] = useState<FormState>({
    email: "",
    password: "",
    displayName: "",
    role: "USER",
    error: "",
  });
  const createMutation = useCreateUser();
  const { t } = useTranslation();

  const handleDialogClose = () => {
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormState((prev) => ({ ...prev, error: "" }));

    if (!formState.email) {
      setFormState((prev) => ({
        ...prev,
        error: t("components.createUserDialog.errors.emailRequired", "Email is required"),
      }));
      return;
    }

    if (!formState.password) {
      setFormState((prev) => ({
        ...prev,
        error: t("components.createUserDialog.errors.passwordRequired", "Password is required"),
      }));
      return;
    }

    if (formState.password.length < 8) {
      setFormState((prev) => ({
        ...prev,
        error: t(
          "components.createUserDialog.errors.passwordLength",
          "Password must be at least 8 characters",
        ),
      }));
      return;
    }

    try {
      const input: CreateUserInput = {
        email: formState.email,
        password: formState.password,
        role: formState.role,
      };

      if (formState.displayName) {
        input.displayName = formState.displayName;
      }

      await createMutation.mutateAsync(input);
      onClose();
      setFormState({
        email: "",
        password: "",
        displayName: "",
        role: "USER",
        error: "",
      });
    } catch (err) {
      if (err instanceof ApiError) {
        const message =
          err.status === 409
            ? t("components.createUserDialog.errors.emailExists", "Email already exists")
            : err.message ||
              t("components.createUserDialog.errors.createFailed", "Failed to create user");
        setFormState((prev) => ({ ...prev, error: message }));
      } else {
        setFormState((prev) => ({
          ...prev,
          error: t("components.createUserDialog.errors.createFailed", "Failed to create user"),
        }));
      }
    }
  };

  const isSubmitting = createMutation.isPending;

  return (
    <Dialog isOpen={isOpen} onClose={handleDialogClose}>
      <h2 className="mb-6 text-xl font-semibold text-foreground">
        {t("components.createUserDialog.title", "Create New User")}
      </h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {formState.error && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{formState.error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="email">{t("components.createUserDialog.emailLabel", "Email")}</Label>
          <Input
            id="email"
            type="email"
            value={formState.email}
            onChange={(e) => setFormState((prev) => ({ ...prev, email: e.target.value }))}
            placeholder="user@example.com"
            disabled={isSubmitting}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">
            {t("components.createUserDialog.passwordLabel", "Password")}
          </Label>
          <Input
            id="password"
            type="password"
            value={formState.password}
            onChange={(e) => setFormState((prev) => ({ ...prev, password: e.target.value }))}
            placeholder={t(
              "components.createUserDialog.placeholders.password",
              "Minimum 8 characters",
            )}
            disabled={isSubmitting}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="displayName">
            {t("components.createUserDialog.displayNameLabel", "Display Name")}
          </Label>
          <Input
            id="displayName"
            type="text"
            value={formState.displayName}
            onChange={(e) => setFormState((prev) => ({ ...prev, displayName: e.target.value }))}
            placeholder={t(
              "components.createUserDialog.placeholders.displayName",
              "John Doe (optional)",
            )}
            disabled={isSubmitting}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="role">{t("components.createUserDialog.roleLabel", "Role")}</Label>
          <NativeSelect
            id="role"
            value={formState.role}
            onChange={(e) =>
              setFormState((prev) => ({ ...prev, role: e.target.value as "USER" | "ADMIN" }))
            }
            disabled={isSubmitting}
          >
            <option value="USER">{t("common.roles.user", "User")}</option>
            <option value="ADMIN">{t("common.roles.admin", "Admin")}</option>
          </NativeSelect>
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={isSubmitting} className="flex-1">
            {isSubmitting
              ? t("common.creating", "Creating…")
              : t("components.createUserDialog.createBtn", "Create User")}
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
