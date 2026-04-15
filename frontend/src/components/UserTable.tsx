import type { User } from "../lib/queries/users";
import { Button } from "@/components/ui/button";

interface UserTableProps {
  users: User[];
  currentUserId?: string | undefined;
  isLoading?: boolean;
  onEdit: (user: User) => void;
  onDeactivate: (user: User) => void;
  onDelete: (user: User) => void;
  sortBy?: "email" | "role" | "createdAt";
  sortOrder?: "asc" | "desc";
  onSort?: (column: "email" | "role" | "createdAt") => void;
}

export function UserTable({
  users,
  currentUserId,
  isLoading,
  onEdit,
  onDeactivate,
  onDelete,
  sortBy = "email",
  sortOrder = "asc",
  onSort,
}: UserTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          // eslint-disable-next-line @eslint-react/no-array-index-key
          <div key={`loading-${i}`} className="h-12 animate-pulse rounded bg-muted" />
        ))}
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        No users found. Create your first user to get started.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="border-b border-border bg-muted">
          <tr>
            <th scope="col" className="px-6 py-3 text-left">
              <button
                onClick={() => onSort?.("email")}
                className="flex items-center gap-2 font-semibold text-foreground hover:text-foreground/80"
              >
                Email
                {sortBy === "email" && <span>{sortOrder === "asc" ? "↑" : "↓"}</span>}
              </button>
            </th>
            <th scope="col" className="px-6 py-3 text-left font-semibold text-foreground">
              Name
            </th>
            <th scope="col" className="px-6 py-3 text-left">
              <button
                onClick={() => onSort?.("role")}
                className="flex items-center gap-2 font-semibold text-foreground hover:text-foreground/80"
              >
                Role
                {sortBy === "role" && <span>{sortOrder === "asc" ? "↑" : "↓"}</span>}
              </button>
            </th>
            <th scope="col" className="px-6 py-3 text-left font-semibold text-foreground">
              Status
            </th>
            <th scope="col" className="px-6 py-3 text-left">
              <button
                onClick={() => onSort?.("createdAt")}
                className="flex items-center gap-2 font-semibold text-foreground hover:text-foreground/80"
              >
                Created
                {sortBy === "createdAt" && <span>{sortOrder === "asc" ? "↑" : "↓"}</span>}
              </button>
            </th>
            <th scope="col" className="px-6 py-3 text-left font-semibold text-foreground">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {users.map((user) => (
            <tr key={user.id} className="hover:bg-muted/50">
              <td className="px-6 py-3 text-sm font-medium text-foreground">{user.email}</td>
              <td className="px-6 py-3 text-sm text-foreground">{user.name || "—"}</td>
              <td className="px-6 py-3 text-sm">
                <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                  {user.role}
                </span>
              </td>
              <td className="px-6 py-3 text-sm">
                <span
                  className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                    user.active ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                  }`}
                >
                  {user.active ? "Active" : "Deactivated"}
                </span>
              </td>
              <td className="px-6 py-3 text-sm text-muted-foreground">
                {new Date(user.createdAt).toLocaleDateString("en-US")}
              </td>
              <td className="px-6 py-3 text-sm">
                {user.role === "ADMIN" && user.id !== currentUserId ? (
                  <span className="text-xs text-muted-foreground">No actions available</span>
                ) : (
                  <div className="flex gap-2">
                    <Button onClick={() => onEdit(user)} variant="outline" size="sm">
                      Edit
                    </Button>
                    {user.active && (
                      <Button onClick={() => onDeactivate(user)} variant="destructive" size="sm">
                        Deactivate
                      </Button>
                    )}
                    <Button
                      onClick={() => onDelete(user)}
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </Button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
