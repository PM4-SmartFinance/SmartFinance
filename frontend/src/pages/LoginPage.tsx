import { useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const TEXT = {
  brand: "⬡ SmartFinance",
  title: "Sign in",
  description: "Enter your credentials to access your account",
  submit: "Sign in",
  submitting: "Signing in…",
  genericError: "Something went wrong. Please try again.",
  emailLabel: "Email",
  passwordLabel: "Password",
} as const;

export function LoginPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => api.post<{ ok: boolean }>("/auth/login", { email, password }),
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ["auth", "me"] });
      navigate("/");
    },
  });

  if (isLoading) return null;
  if (isAuthenticated) return <Navigate to="/" replace />;

  const errorMessage = error instanceof ApiError ? error.message : error ? TEXT.genericError : null;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    mutate();
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-muted/40">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="text-2xl font-bold tracking-wide mb-1">{TEXT.brand}</div>
          <CardTitle className="text-xl">{TEXT.title}</CardTitle>
          <CardDescription>{TEXT.description}</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {errorMessage && (
              <p
                role="alert"
                className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2"
              >
                {errorMessage}
              </p>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">{TEXT.emailLabel}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                disabled={isPending}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">{TEXT.passwordLabel}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                disabled={isPending}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <Button type="submit" className="w-full mt-1" disabled={isPending}>
              {isPending ? TEXT.submitting : TEXT.submit}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
