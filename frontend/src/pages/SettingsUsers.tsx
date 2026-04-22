import { useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useUsers, useUpdateUser, type User } from "../lib/queries/users";
import { useAuth } from "../hooks/useAuth";
import { api } from "../lib/api";
import { UserTable } from "../components/UserTable";
import { CreateUserDialog } from "../components/CreateUserDialog";
import { EditUserDialog } from "../components/EditUserDialog";
import { DeleteUserDialog } from "../components/DeleteUserDialog";
import { Button } from "@/components/ui/button";

type SortColumn = "email" | "role" | "createdAt";

export function SettingsUsers() {
  const [sortBy, setSortBy] = useState<SortColumn>("email");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const { data: response, isLoading, error } = useUsers(50, 0, sortBy, sortOrder);
  const { user: currentUser } = useAuth();
  const updateMutation = useUpdateUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { mutate: logout } = useMutation({
    mutationFn: () => api.post<{ ok: boolean }>("/auth/logout", {}),
    onSettled: () => {
      queryClient.clear();
      navigate("/login");
    },
  });

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setIsEditDialogOpen(true);
  };

  const handleDeactivate = async (user: User) => {
    try {
      await updateMutation.mutateAsync({ id: user.id, input: { active: false } });
      if (user.id === currentUser?.id) {
        logout();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to deactivate user";
      alert(message);
    }
  };

  const handleDelete = (user: User) => {
    setSelectedUser(user);
    setIsDeleteDialogOpen(true);
  };

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
            <h1 className="text-4xl font-bold text-foreground">Users</h1>
            <p className="text-sm text-muted-foreground">Manage platform users and access</p>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)} size="sm">
            Create User
          </Button>
        </header>

        {/* Error State */}
        {error && (
          <div className="mb-6 rounded bg-red-50 p-4 text-sm text-red-600">
            Failed to load users. Please try again.
          </div>
        )}

        {/* Users Table */}
        <UserTable
          users={users}
          currentUserId={currentUser?.id}
          isLoading={isLoading}
          onEdit={handleEdit}
          onDeactivate={handleDeactivate}
          onDelete={handleDelete}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={handleSort}
        />
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
      <DeleteUserDialog
        isOpen={isDeleteDialogOpen}
        user={selectedUser}
        onClose={() => {
          setIsDeleteDialogOpen(false);
          setSelectedUser(null);
        }}
        onDeleteSuccess={selectedUser?.id === currentUser?.id ? () => logout() : undefined}
      />
    </div>
  );
}
