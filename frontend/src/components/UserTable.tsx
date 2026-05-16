import type { User } from "../lib/queries/users";
import { Button } from "@/components/ui/button";
import { SortableColumnHeader } from "./SortableColumnHeader";
import { formatDate } from "@/lib/format";
import { useTranslation } from "react-i18next";

interface UserTableProps {
  users: User[];
  currentUserId?: string | undefined;
  isLoading?: boolean;
  onEdit: (user: User) => void;
  onDeactivate: (user: User) => void;
  onDelete: (user: User) => void;
  onResetPassword: (user: User) => void;
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
  onResetPassword,
  sortBy = "email",
  sortOrder = "asc",
  onSort,
}: UserTableProps) {
  const { t, i18n } = useTranslation();
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
        {t("components.userTable.empty", "No users found. Create your first user to get started.")}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="border-b border-border bg-muted">
          <tr>
            <SortableColumnHeader
              column="email"
              label={t("components.userTable.headers.email", "Email")}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={(col) => onSort?.(col)}
            />
            <th scope="col" className="px-6 py-3 text-left font-semibold text-foreground">
              {t("components.userTable.headers.name", "Name")}
            </th>
            <SortableColumnHeader
              column="role"
              label={t("components.userTable.headers.role", "Role")}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={(col) => onSort?.(col)}
            />
            <th scope="col" className="px-6 py-3 text-left font-semibold text-foreground">
              {t("components.userTable.headers.status", "Status")}
            </th>
            <SortableColumnHeader
              column="createdAt"
              label={t("components.userTable.headers.created", "Created")}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={(col) => onSort?.(col)}
            />
            <th scope="col" className="px-6 py-3 text-left font-semibold text-foreground">
              {t("components.userTable.headers.actions", "Actions")}
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
                  {user.role === "ADMIN"
                    ? t("components.createUserDialog.roles.admin", "Admin")
                    : t("components.createUserDialog.roles.user", "User")}
                </span>
              </td>
              <td className="px-6 py-3 text-sm">
                <span
                  className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                    user.active ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                  }`}
                >
                  {user.active
                    ? t("components.userTable.status.active", "Active")
                    : t("components.userTable.status.deactivated", "Deactivated")}
                </span>
              </td>
              <td className="px-6 py-3 text-sm text-muted-foreground">
                {formatDate(user.createdAt, i18n.resolvedLanguage)}
              </td>
              <td className="px-6 py-3 text-sm">
                {user.role === "ADMIN" && user.id !== currentUserId ? (
                  <span className="text-xs text-muted-foreground">
                    {t("components.userTable.noActions", "No actions available")}
                  </span>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => {
                        onEdit(user);
                      }}
                      variant="outline"
                      size="sm"
                    >
                      {t("common.edit", "Edit")}
                    </Button>
                    <Button
                      onClick={() => {
                        onResetPassword(user);
                      }}
                      variant="outline"
                      size="sm"
                    >
                      {t("components.userTable.actions.resetPassword", "Reset Password")}
                    </Button>
                    {user.active && (
                      <Button
                        onClick={() => {
                          void onDeactivate(user);
                        }}
                        variant="destructive"
                        size="sm"
                      >
                        {t("components.userTable.actions.deactivate", "Deactivate")}
                      </Button>
                    )}
                    <Button
                      onClick={() => {
                        onDelete(user);
                      }}
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      {t("common.delete", "Delete")}
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
