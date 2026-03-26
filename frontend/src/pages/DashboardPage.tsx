import { useNavigate } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthProvider";
import { api } from "../lib/api";
import { Button } from "@/components/ui/button";

const TEXT = {
  heading: "Dashboard",
  subtitle: "View your financial overview at a glance",
  signOut: "Sign out",
  signingOut: "Signing out…",
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
          <article className="rounded-lg border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Account Balance
            </h2>
            <div className="flex flex-col gap-2">
              <div className="text-3xl font-bold text-card-foreground">—</div>
              <div className="text-xs text-muted-foreground">Loading from API…</div>
            </div>
          </article>

          {/* ── Widget 2: Monthly Expenses ── */}
          <article className="rounded-lg border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Monthly Expenses
            </h2>
            <div className="flex flex-col gap-2">
              <div className="text-3xl font-bold text-card-foreground">—</div>
              <div className="text-xs text-muted-foreground">Loading from API…</div>
            </div>
          </article>

          {/* ── Widget 3: Income This Month ── */}
          <article className="rounded-lg border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Income This Month
            </h2>
            <div className="flex flex-col gap-2">
              <div className="text-3xl font-bold text-card-foreground">—</div>
              <div className="text-xs text-muted-foreground">Loading from API…</div>
            </div>
          </article>

          {/* ── Widget 4: Spending Chart (Full Width) ── */}
          <article className="col-span-1 min-h-48 rounded-lg border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md sm:col-span-2 lg:col-span-3">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Monthly Spending Trend
            </h2>
            <div className="flex items-center justify-center rounded bg-muted/30 px-4 py-8 text-center">
              <div className="text-sm italic text-muted-foreground">
                📊 Chart visualization (Bar/Line chart showing monthly spending over 12 months)
              </div>
            </div>
          </article>

          {/* ── Widget 5: Recent Transactions (Full Width) ── */}
          <article className="col-span-1 min-h-48 rounded-lg border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md sm:col-span-2 lg:col-span-3">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Recent Transactions
            </h2>
            <div className="flex items-center justify-center rounded bg-muted/30 px-4 py-8 text-center">
              <div className="text-sm italic text-muted-foreground">
                📋 Transaction list table (Date, Description, Category, Amount, Status)
              </div>
            </div>
          </article>

          {/* ── Widget 6: Budget Progress (Full Width) ── */}
          <article className="col-span-1 min-h-48 rounded-lg border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md sm:col-span-2 lg:col-span-3">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Budget Progress
            </h2>
            <div className="flex items-center justify-center rounded bg-muted/30 px-4 py-8 text-center">
              <div className="text-sm italic text-muted-foreground">
                📈 Budget progress bars (Category name, progress % bar, spent vs. limit)
              </div>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
