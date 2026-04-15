import { useState, useRef, useEffect } from "react";
import { useCreateUser, type CreateUserInput } from "../lib/queries/users";
import { ApiError } from "../lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CreateUserDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FormState {
  email: string;
  password: string;
  displayName: string;
  role: "USER" | "ADMIN";
  error: string;
}

export function CreateUserDialog({ isOpen, onClose }: CreateUserDialogProps) {
  const [formState, setFormState] = useState<FormState>({
    email: "",
    password: "",
    displayName: "",
    role: "USER",
    error: "",
  });
  const dialogRef = useRef<HTMLDialogElement>(null);
  const createMutation = useCreateUser();

  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [isOpen]);

  const handleDialogClose = () => {
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormState((prev) => ({ ...prev, error: "" }));

    if (!formState.email) {
      setFormState((prev) => ({ ...prev, error: "Email is required" }));
      return;
    }

    if (!formState.password) {
      setFormState((prev) => ({ ...prev, error: "Password is required" }));
      return;
    }

    if (formState.password.length < 8) {
      setFormState((prev) => ({ ...prev, error: "Password must be at least 8 characters" }));
      return;
    }

    try {
      const input: CreateUserInput = {
        email: formState.email,
        password: formState.password,
        role: formState.role,
      };

      if (formState.displayName) {
        input.displayName = formState.displayName;
      }

      await createMutation.mutateAsync(input);
      onClose();
      setFormState({
        email: "",
        password: "",
        displayName: "",
        role: "USER",
        error: "",
      });
    } catch (err) {
      if (err instanceof ApiError) {
        const message =
          err.status === 409 ? "Email already exists" : err.message || "Failed to create user";
        setFormState((prev) => ({ ...prev, error: message }));
      } else {
        setFormState((prev) => ({ ...prev, error: "Failed to create user" }));
      }
    }
  };

  const isSubmitting = createMutation.isPending;

  return (
    <dialog
      ref={dialogRef}
      className="w-full max-w-md rounded-lg shadow-lg backdrop:bg-black/50 open:flex open:items-center open:justify-center"
      onClose={handleDialogClose}
    >
      <div className="rounded-lg bg-background p-6 shadow-lg">
        <h2 className="mb-6 text-xl font-semibold text-foreground">Create New User</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {formState.error && (
            <div className="rounded bg-red-50 p-2 text-sm text-red-600">{formState.error}</div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formState.email}
              onChange={(e) => setFormState((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="user@example.com"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={formState.password}
              onChange={(e) => setFormState((prev) => ({ ...prev, password: e.target.value }))}
              placeholder="Minimum 8 characters"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              type="text"
              value={formState.displayName}
              onChange={(e) => setFormState((prev) => ({ ...prev, displayName: e.target.value }))}
              placeholder="John Doe (optional)"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <select
              id="role"
              value={formState.role}
              onChange={(e) =>
                setFormState((prev) => ({ ...prev, role: e.target.value as "USER" | "ADMIN" }))
              }
              disabled={isSubmitting}
              className="w-full rounded border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="USER">User</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting ? "Creating…" : "Create User"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleDialogClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
