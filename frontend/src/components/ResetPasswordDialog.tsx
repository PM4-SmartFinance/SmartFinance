import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import type { User } from "../lib/queries/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>
            Enter a new password for {user?.email}. This will immediately invalidate their current
            sessions.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-4">
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || success}>
              {isPending ? "Resetting\u2026" : "Reset Password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
