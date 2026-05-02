import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import type { User } from "../lib/queries/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2 } from "lucide-react";

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
  const dialogRef = useRef<HTMLDialogElement>(null);

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
      setTimeout(() => {
        handleClose();
      }, 1500);
    },
  });

  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setConfirmError(null);
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setConfirmError("Passwords do not match.");
      return;
    }

    if (user) {
      resetPassword({ id: user.id, newPassword });
    }
  };

  const handleClose = () => {
    setNewPassword("");
    setConfirmPassword("");
    setConfirmError(null);
    setSuccess(false);
    reset();
    onClose();
  };

  const errorMessage =
    error instanceof ApiError ? error.message : error ? "Failed to reset password." : null;

  return (
    <dialog
      ref={dialogRef}
      className="w-full max-w-md rounded-lg shadow-lg backdrop:bg-black/50 open:flex open:items-center open:justify-center"
      onClose={handleClose}
    >
      <div className="rounded-lg bg-background p-6 shadow-lg w-full">
        <h2 className="mb-2 text-xl font-semibold text-foreground">Reset Password</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Enter a new password for {user?.email}. This will immediately invalidate their current
          sessions.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reset-new-password">New password</Label>
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
            <Label htmlFor="reset-confirm-password">Confirm new password</Label>
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
            <Alert
              role="status"
              className="border-green-500/50 text-green-700 dark:text-green-400 [&>svg]:text-green-600"
            >
              <CheckCircle2 className="size-4" />
              <AlertDescription>Password reset successfully.</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2 mt-2">
            <Button type="submit" disabled={isPending || success} className="flex-1">
              {isPending ? "Resetting…" : "Reset Password"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isPending || success}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
