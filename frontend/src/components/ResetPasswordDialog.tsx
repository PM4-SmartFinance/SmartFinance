import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import type { User } from "../lib/queries/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog } from "@/components/ui/dialog";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ResetPasswordDialogProps {
  isOpen: boolean;
  user: User | null;
  onClose: () => void;
}

export function ResetPasswordDialog({ isOpen, user, onClose }: ResetPasswordDialogProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { t } = useTranslation();

  const {
    mutate: resetPassword,
    isPending,
    error,
    reset,
  } = useMutation({
    mutationFn: (input: { id: string; newPassword: string }) =>
      api.post<{ ok: boolean }>(`/users/${input.id}/reset-password`, {
        newPassword: input.newPassword,
      }),
    onSuccess: () => {
      setSuccess(true);
      closeTimerRef.current = setTimeout(() => {
        closeTimerRef.current = null;
        handleClose();
      }, 1500);
    },
  });

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, []);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setConfirmError(null);
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setConfirmError(
        t("components.resetPasswordDialog.errors.passwordMismatch", "Passwords do not match."),
      );
      return;
    }

    if (user) {
      resetPassword({ id: user.id, newPassword });
    }
  };

  const handleClose = () => {
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setNewPassword("");
    setConfirmPassword("");
    setConfirmError(null);
    setSuccess(false);
    reset();
    onClose();
  };

  const errorMessage =
    error instanceof ApiError
      ? error.message
      : error
        ? t("components.resetPasswordDialog.errors.resetFailed", "Failed to reset password.")
        : null;

  return (
    <Dialog isOpen={isOpen} onClose={handleClose}>
      <h2 className="mb-2 text-xl font-semibold text-foreground">
        {t("components.resetPasswordDialog.title", "Reset Password")}
      </h2>
      <p className="mb-6 text-sm text-muted-foreground">
        {t(
          "components.resetPasswordDialog.description",
          "Enter a new password for {{email}}. They will need to use the new password the next time they sign in.",
          { email: user?.email },
        )}
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reset-new-password">
            {t("components.resetPasswordDialog.newPasswordLabel", "New password")}
          </Label>
          <Input
            id="reset-new-password"
            type="password"
            value={newPassword}
            required
            minLength={8}
            autoComplete="new-password"
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={isPending || success}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reset-confirm-password">
            {t("components.resetPasswordDialog.confirmPasswordLabel", "Confirm new password")}
          </Label>
          <Input
            id="reset-confirm-password"
            type="password"
            value={confirmPassword}
            required
            autoComplete="new-password"
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setConfirmError(null);
            }}
            disabled={isPending || success}
          />
        </div>

        {(confirmError ?? errorMessage) && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{confirmError ?? errorMessage}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert variant="success" role="status">
            <CheckCircle2 className="size-4" />
            <AlertDescription>
              {t("components.resetPasswordDialog.successMessage", "Password reset successfully.")}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2 mt-2">
          <Button type="submit" disabled={isPending || success} className="flex-1">
            {isPending
              ? t("components.resetPasswordDialog.resettingBtn", "Resetting…")
              : t("components.resetPasswordDialog.resetBtn", "Reset Password")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isPending || success}
            className="flex-1"
          >
            {t("common.cancel", "Cancel")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
