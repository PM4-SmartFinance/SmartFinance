import { useState } from "react";
import { useUsers, type User } from "../lib/queries/users";
import { UserTable } from "../components/UserTable";
import { CreateUserDialog } from "../components/CreateUserDialog";
import { EditUserDialog } from "../components/EditUserDialog";
import { Button } from "@/components/ui/button";

type SortColumn = "email" | "role" | "createdAt";

export function AdminUsersPage() {
  const [sortBy, setSortBy] = useState<SortColumn>("email");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const { data: response, isLoading, error } = useUsers();
  const users = response?.items ?? [];

  // Simple client-side sorting
  const sortedUsers = [...users].sort((a, b) => {
    let aValue: string | number = "";
    let bValue: string | number = "";

    if (sortBy === "email") {
      aValue = a.email.toLowerCase();
      bValue = b.email.toLowerCase();
    } else if (sortBy === "role") {
      aValue = a.role;
      bValue = b.role;
    } else if (sortBy === "createdAt") {
      aValue = new Date(a.createdAt).getTime();
      bValue = new Date(b.createdAt).getTime();
    }

    if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
    if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  const handleSort = (column: SortColumn) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
  };

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setIsEditDialogOpen(true);
  };

  const handleDeactivate = (user: User) => {
    setSelectedUser(user);
    setIsEditDialogOpen(true);
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Page Header */}
        <header className="mb-8 flex items-center justify-between">
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
          users={sortedUsers}
          isLoading={isLoading}
          onEdit={handleEdit}
          onDeactivate={handleDeactivate}
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
    </main>
  );
}
