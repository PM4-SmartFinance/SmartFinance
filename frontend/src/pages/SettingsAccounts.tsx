import { useState } from "react";
import {
  useAccounts,
  useUpdateAccount,
  useDeleteAccount,
  type Account,
} from "../lib/queries/accounts";
import { ApiError } from "../lib/api";
import { useAppStore } from "../store/appStore";
import { AccountFormDialog } from "../components/AccountFormDialog";
import { ConfirmDeleteDialog } from "../components/ConfirmDeleteDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Edit2, Power, Trash2 } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";

export function SettingsAccounts() {
  const { t } = useTranslation();
  const { data: accounts, isLoading, error } = useAccounts();
  const showAccountName = useAppStore((s) => s.showAccountName);
  const setShowAccountName = useAppStore((s) => s.setShowAccountName);
  const updateMutation = useUpdateAccount();
  const deleteMutation = useDeleteAccount();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  const handleToggleActive = async (account: Account) => {
    setToggleError(null);
    try {
      await updateMutation.mutateAsync({ id: account.id, input: { active: !account.active } });
    } catch (err) {
      setToggleError(
        err instanceof Error
          ? err.message
          : t("settingsAccounts.errors.toggleFailed", "Failed to update account"),
      );
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingAccount) return;
    try {
      await deleteMutation.mutateAsync(deletingAccount.id);
      setDeletingAccount(null);
    } catch {
      // Surfaced via deleteMutation.error below.
    }
  };

  const deleteErrorMessage =
    deleteMutation.error instanceof ApiError
      ? deleteMutation.error.status === 409
        ? t(
            "settingsAccounts.errors.deleteHasTransactions",
            "This account still has transactions. Deactivate it instead of deleting.",
          )
        : deleteMutation.error.message
      : deleteMutation.error
        ? t("settingsAccounts.errors.deleteFailed", "Failed to delete account")
        : null;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <h2 className="text-4xl font-bold text-foreground">
            {t("settingsAccounts.heading", "Accounts")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t(
              "settingsAccounts.description",
              "Manage your bank accounts. Deactivate an account to hide its transactions.",
            )}
          </p>
        </div>
        <Button size="sm" onClick={() => setIsCreateOpen(true)}>
          {t("settingsAccounts.createBtn", "Create Account")}
        </Button>
      </header>

      {/* Display preference — show the owning account's name on each transaction. */}
      <Card className="p-4">
        <Label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={showAccountName}
            onChange={(e) => setShowAccountName(e.target.checked)}
            className="rounded border border-input"
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground">
              {t("settingsAccounts.showAccountName.label", "Show account name on transactions")}
            </span>
            <span className="text-xs text-muted-foreground">
              {t(
                "settingsAccounts.showAccountName.description",
                "Adds an account column to the transactions list.",
              )}
            </span>
          </span>
        </Label>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>
            {t("settingsAccounts.errors.loadFailed", "Failed to load accounts. Please try again.")}
          </AlertDescription>
        </Alert>
      )}

      {toggleError && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{toggleError}</AlertDescription>
        </Alert>
      )}

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-4 p-6">
            {Array.from({ length: 3 }).map((_, i) => (
              // eslint-disable-next-line @eslint-react/no-array-index-key
              <div key={`loading-${i}`} className="h-12 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : !accounts || accounts.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            {t("settingsAccounts.emptyState", "No accounts yet. Create one to start importing.")}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-border bg-muted">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left font-semibold text-foreground">
                    {t("settingsAccounts.table.name", "Name")}
                  </th>
                  <th scope="col" className="px-6 py-3 text-left font-semibold text-foreground">
                    {t("settingsAccounts.table.iban", "IBAN")}
                  </th>
                  <th scope="col" className="px-6 py-3 text-left font-semibold text-foreground">
                    {t("settingsAccounts.table.status", "Status")}
                  </th>
                  <th scope="col" className="px-6 py-3 text-right font-semibold text-foreground">
                    {t("settingsAccounts.table.actions", "Actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {accounts.map((account) => (
                  <tr key={account.id} className="hover:bg-muted/50">
                    <td className="px-6 py-3 text-sm font-medium text-foreground">
                      {account.name}
                    </td>
                    <td className="px-6 py-3 text-sm text-muted-foreground">{account.iban}</td>
                    <td className="px-6 py-3 text-sm">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          account.active
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {account.active
                          ? t("settingsAccounts.status.active", "Active")
                          : t("settingsAccounts.status.inactive", "Inactive")}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingAccount(account)}
                          className="size-8 p-0"
                          title={t("common.edit", "Edit")}
                        >
                          <Edit2 className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleToggleActive(account)}
                          disabled={updateMutation.isPending}
                          className="size-8 p-0"
                          title={
                            account.active
                              ? t("settingsAccounts.deactivate", "Deactivate")
                              : t("settingsAccounts.activate", "Activate")
                          }
                        >
                          <Power className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            deleteMutation.reset();
                            setDeletingAccount(account);
                          }}
                          className="size-8 p-0 text-destructive hover:bg-destructive/10"
                          title={t("common.delete", "Delete")}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Mount a fresh dialog per open so the form re-seeds from the account. */}
      {isCreateOpen && <AccountFormDialog isOpen onClose={() => setIsCreateOpen(false)} />}

      {editingAccount && (
        <AccountFormDialog
          key={editingAccount.id}
          isOpen
          account={editingAccount}
          onClose={() => setEditingAccount(null)}
        />
      )}

      {deletingAccount && (
        <ConfirmDeleteDialog
          isOpen={deletingAccount !== null}
          title={t("settingsAccounts.deleteDialog.title", "Delete Account?")}
          description={
            <Trans
              i18nKey="settingsAccounts.deleteDialog.body"
              values={{ name: deletingAccount.name }}
              components={{ 1: <span className="font-medium" /> }}
            />
          }
          error={deleteErrorMessage}
          isDeleting={deleteMutation.isPending}
          onConfirm={() => void handleConfirmDelete()}
          onCancel={() => setDeletingAccount(null)}
        />
      )}
    </div>
  );
}
