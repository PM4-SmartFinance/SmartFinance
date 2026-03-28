import { useNavigate } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthProvider";
import { api } from "../lib/api";
import { Button } from "@/components/ui/button";

const TEXT = {
  heading: "Dashboard",
  signOut: "Sign out",
  signingOut: "Signing out…",
  id: "ID:",
  email: "Email:",
  role: "Role:",
} as const;

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { mutate: logout, isPending } = useMutation({
    mutationFn: () => api.post<{ ok: boolean }>("/auth/logout", {}),
    onSuccess: () => {
      queryClient.clear();
      navigate("/login");
    },
  });

  return (
    <main className="min-h-screen p-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">{TEXT.heading}</h1>
        <Button variant="outline" size="sm" disabled={isPending} onClick={() => logout()}>
          {isPending ? TEXT.signingOut : TEXT.signOut}
        </Button>
      </div>

      {user && (
        <div className="space-y-1 text-sm">
          <p>
            <span className="font-medium">{TEXT.id}</span> {user.id}
          </p>
          <p>
            <span className="font-medium">{TEXT.email}</span> {user.email}
          </p>
          <p>
            <span className="font-medium">{TEXT.role}</span> {user.role}
          </p>
        </div>
      )}
    </main>
  );
}
