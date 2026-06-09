import { useState } from "react";
import { useCreateAccount, useUpdateAccount, type Account } from "../lib/queries/accounts";
import { ApiError } from "../lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

interface AccountFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  // When set the dialog edits this account; otherwise it creates a new one.
  account?: Account | null;
}

export function AccountFormDialog({ isOpen, onClose, account }: AccountFormDialogProps) {
  const isEdit = account != null;
  const { t } = useTranslation();
  const createMutation = useCreateAccount();
  const updateMutation = useUpdateAccount();

  // Seeded once from the account prop. The parent mounts a fresh dialog per open
  // (keyed by account id), so no effect is needed to re-sync on prop change.
  const [name, setName] = useState(() => account?.name ?? "");
  const [iban, setIban] = useState(() => account?.iban ?? "");
  const [accountNumber, setAccountNumber] = useState(() => account?.accountNumber ?? "");
  const [error, setError] = useState("");

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmedName = name.trim();
    const trimmedIban = iban.trim();
    if (!trimmedName) {
      setError(t("settingsAccounts.errors.nameRequired", "Name is required"));
      return;
    }
    if (!trimmedIban) {
      setError(t("settingsAccounts.errors.ibanRequired", "IBAN is required"));
      return;
    }

    const accountNumberValue = accountNumber.trim() === "" ? null : accountNumber.trim();

    try {
      if (isEdit) {
        await updateMutation.mutateAsync({
          id: account.id,
          input: { name: trimmedName, iban: trimmedIban, accountNumber: accountNumberValue },
        });
      } else {
        await createMutation.mutateAsync({
          name: trimmedName,
          iban: trimmedIban,
          accountNumber: accountNumberValue,
        });
      }
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError(
          t("settingsAccounts.errors.ibanExists", "An account with this IBAN already exists"),
        );
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(t("settingsAccounts.errors.saveFailed", "Failed to save account"));
      }
    }
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose}>
      <h2 className="mb-6 text-xl font-semibold text-foreground">
        {isEdit
          ? t("settingsAccounts.editTitle", "Edit Account")
          : t("settingsAccounts.createTitle", "New Account")}
      </h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="account-name">{t("settingsAccounts.nameLabel", "Name")}</Label>
          <Input
            id="account-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("settingsAccounts.namePlaceholder", "e.g. Main Account")}
            disabled={isSubmitting}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="account-iban">{t("settingsAccounts.ibanLabel", "IBAN")}</Label>
          <Input
            id="account-iban"
            type="text"
            value={iban}
            onChange={(e) => setIban(e.target.value)}
            placeholder="CH93 0076 2011 6238 5295 7"
            disabled={isSubmitting}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="account-number">
            {t("settingsAccounts.accountNumberLabel", "Account number (optional)")}
          </Label>
          <Input
            id="account-number"
            type="text"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            placeholder={t(
              "settingsAccounts.accountNumberPlaceholder",
              "Used to auto-match imports",
            )}
            disabled={isSubmitting}
          />
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={isSubmitting} className="flex-1">
            {isSubmitting
              ? t("common.saving", "Saving…")
              : isEdit
                ? t("common.save", "Save")
                : t("settingsAccounts.createBtn", "Create Account")}
          </Button>
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            {t("common.cancel", "Cancel")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
