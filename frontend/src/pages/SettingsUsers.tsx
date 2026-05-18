import { useState } from "react";
import { useUsers, useUpdateUser, useDeleteUser, type User } from "../lib/queries/users";
import { useAuth } from "../hooks/useAuth";
import { useLogout } from "../hooks/useLogout";
import { ApiError } from "../lib/api";
import { UserTable } from "../components/UserTable";
import { CreateUserDialog } from "../components/CreateUserDialog";
import { EditUserDialog } from "../components/EditUserDialog";
import { ConfirmDeleteDialog } from "../components/ConfirmDeleteDialog";
import { ResetPasswordDialog } from "../components/ResetPasswordDialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";

type SortColumn = "email" | "role" | "createdAt";

export function SettingsUsers() {
  const [sortBy, setSortBy] = useState<SortColumn>("email");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isResetPasswordDialogOpen, setIsResetPasswordDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);
  const { t } = useTranslation();

  const { data: response, isLoading, error } = useUsers(50, 0, sortBy, sortOrder);
  const { user: currentUser } = useAuth();
  const updateMutation = useUpdateUser();
  const deleteMutation = useDeleteUser();
  const { mutate: logout } = useLogout({ errorRedirectTo: "/login?logout_error=1" });

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setIsEditDialogOpen(true);
  };

  const handleResetPassword = (user: User) => {
    setSelectedUser(user);
    setIsResetPasswordDialogOpen(true);
  };

  const handleDeactivate = async (user: User) => {
    setDeactivateError(null);
    try {
      await updateMutation.mutateAsync({ id: user.id, input: { active: false } });
      if (user.id === currentUser?.id) {
        logout();
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : t("settingsUsers.errors.deactivateFailed", "Failed to deactivate user");
      setDeactivateError(message);
    }
  };

  const handleDelete = (user: User) => {
    setSelectedUser(user);
    setIsDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setSelectedUser(null);
    deleteMutation.reset();
  };

  const handleConfirmDelete = async () => {
    if (!selectedUser) return;
    try {
      await deleteMutation.mutateAsync(selectedUser.id);
      const wasSelf = selectedUser.id === currentUser?.id;
      handleCloseDeleteDialog();
      if (wasSelf) logout();
    } catch {
      // Error surfaced via deleteMutation.error
    }
  };

  const deleteErrorMessage =
    deleteMutation.error instanceof ApiError
      ? deleteMutation.error.message
      : deleteMutation.error
        ? t("settingsUsers.errors.deleteFailed", "Failed to delete user")
        : null;

  const users = response?.items ?? [];

  const handleSort = (column: SortColumn) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-6">
        {/* Page Header */}
        <header className="flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <h2 className="text-4xl font-bold text-foreground">
              {t("settingsUsers.heading", "Users")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("settingsUsers.description", "Manage platform users and access")}
            </p>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)} size="sm">
            {t("settingsUsers.createUserBtn", "Create User")}
          </Button>
        </header>

        {/* Error State */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="size-4" />
            <AlertDescription>
              {t("settingsUsers.errors.loadFailed", "Failed to load users. Please try again.")}
            </AlertDescription>
          </Alert>
        )}

        {deactivateError && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="size-4" />
            <AlertDescription>{deactivateError}</AlertDescription>
          </Alert>
        )}

        {/* Users Table */}
        {!error && (
          <UserTable
            users={users}
            currentUserId={currentUser?.id}
            isLoading={isLoading}
            onEdit={handleEdit}
            onDeactivate={handleDeactivate}
            onDelete={handleDelete}
            onResetPassword={handleResetPassword}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={handleSort}
          />
        )}
      </div>

      {/* Create User Dialog */}
      <CreateUserDialog isOpen={isCreateDialogOpen} onClose={() => setIsCreateDialogOpen(false)} />

      {/* Edit User Dialog */}
      <EditUserDialog
        isOpen={isEditDialogOpen}
        user={selectedUser}
        onClose={() => {
          setIsEditDialogOpen(false);
          setSelectedUser(null);
        }}
      />

      {/* Delete User Dialog */}
      {selectedUser && (
        <ConfirmDeleteDialog
          isOpen={isDeleteDialogOpen}
          title={t("settingsUsers.deleteDialog.title", "Delete User?")}
          description={
            <Trans
              i18nKey="settingsUsers.deleteDialog.body"
              values={{ email: selectedUser.email }}
              components={{ 1: <span className="font-medium" /> }}
            />
          }
          error={deleteErrorMessage}
          isDeleting={deleteMutation.isPending}
          onConfirm={() => void handleConfirmDelete()}
          onCancel={handleCloseDeleteDialog}
        />
      )}

      {/* Reset Password Dialog */}
      <ResetPasswordDialog
        isOpen={isResetPasswordDialogOpen}
        user={selectedUser}
        onClose={() => {
          setIsResetPasswordDialogOpen(false);
          setSelectedUser(null);
        }}
      />
    </div>
  );
}
