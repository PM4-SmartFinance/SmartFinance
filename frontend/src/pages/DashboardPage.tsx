import { useNavigate } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthProvider";
import { api } from "../lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const TEXT = {
  heading: "Dashboard",
  subtitle: "View your financial overview at a glance",
  signOut: "Sign out",
  signingOut: "Signing out…",
} as const;

export function DashboardPage() {
  useAuth();
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
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* ── Page Header ── */}
        <header className="mb-8 flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <h1 className="text-4xl font-bold text-foreground">{TEXT.heading}</h1>
            <p className="text-sm text-muted-foreground">{TEXT.subtitle}</p>
          </div>
          <Button variant="outline" size="sm" disabled={isPending} onClick={() => logout()}>
            {isPending ? TEXT.signingOut : TEXT.signOut}
          </Button>
        </header>

        {/* ── Widget Grid ── */}
        <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {/* ── Widget 1: Account Balance ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xs font-semibold uppercase tracking-wider">
                Account Balance
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <div className="text-3xl font-bold">—</div>
              <div className="text-xs text-muted-foreground">Loading from API…</div>
            </CardContent>
          </Card>

          {/* ── Widget 2: Monthly Expenses ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xs font-semibold uppercase tracking-wider">
                Monthly Expenses
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <div className="text-3xl font-bold">—</div>
              <div className="text-xs text-muted-foreground">Loading from API…</div>
            </CardContent>
          </Card>

          {/* ── Widget 3: Income This Month ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xs font-semibold uppercase tracking-wider">
                Income This Month
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <div className="text-3xl font-bold">—</div>
              <div className="text-xs text-muted-foreground">Loading from API…</div>
            </CardContent>
          </Card>

          {/* ── Widget 4: Spending Chart (Full Width) ── */}
          <Card className="col-span-1 sm:col-span-2 lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-xs font-semibold uppercase tracking-wider">
                Monthly Spending Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex min-h-48 items-center justify-center rounded bg-muted/30 px-4 text-center">
                <div className="text-sm italic text-muted-foreground">
                  📊 Chart visualization (Bar/Line chart showing monthly spending over 12 months)
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Widget 5: Recent Transactions (Full Width) ── */}
          <Card className="col-span-1 sm:col-span-2 lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-xs font-semibold uppercase tracking-wider">
                Recent Transactions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex min-h-48 items-center justify-center rounded bg-muted/30 px-4 text-center">
                <div className="text-sm italic text-muted-foreground">
                  📋 Transaction list table (Date, Description, Category, Amount, Status)
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Widget 6: Budget Progress (Full Width) ── */}
          <Card className="col-span-1 sm:col-span-2 lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-xs font-semibold uppercase tracking-wider">
                Budget Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex min-h-48 items-center justify-center rounded bg-muted/30 px-4 text-center">
                <div className="text-sm italic text-muted-foreground">
                  📈 Budget progress bars (Category name, progress % bar, spent vs. limit)
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
