import { useNavigate, Link } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../hooks/useAuth";
import { api } from "../lib/api";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "../components/DateRangePicker";
import { SummaryMetricsWidget } from "../components/SummaryMetricsWidget";
import { BudgetWidget } from "../components/BudgetWidget";
import { SpendingTrendChart } from "../components/SpendingTrendChart";
import { CategoryBreakdownChart } from "../components/CategoryBreakdownChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CsvImportCard } from "../components/CsvImportCard";

const TEXT = {
  heading: "Dashboard",
  subtitle: "View your financial overview at a glance",
  greeting: "Welcome back",
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
    onError: () => {
      // Clear client state and navigate to login even if server call fails
      // This ensures the user gets back to login screen with feedback
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
            <p className="text-sm text-muted-foreground">
              {user ? `${TEXT.greeting}, ${user.email}` : TEXT.subtitle}
            </p>
          </div>
          <nav className="flex items-center gap-1">
            {[
              { to: "/transactions", label: "Transactions" },
              { to: "/budgets", label: "Budgets" },
              { to: "/categories", label: "Categories" },
              { to: "/profile", label: "Profile" },
              ...(user?.role === "ADMIN" ? [{ to: "/admin/users", label: "Users" }] : []),
            ].map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className="inline-flex h-8 items-center rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                {label}
              </Link>
            ))}
            <Button variant="outline" size="sm" disabled={isPending} onClick={() => logout()}>
              {isPending ? TEXT.signingOut : TEXT.signOut}
            </Button>
          </nav>
        </header>

        {/* ── Date Range Picker ── */}
        <DateRangePicker />

        {/* ── Summary Metrics ── */}
        <section className="mb-8">
          <SummaryMetricsWidget />
        </section>

        {/* ── Budgets ── */}
        <section className="mb-8">
          <BudgetWidget />
        </section>

        {/* ── Charts Grid ── */}
        <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          <SpendingTrendChart />
          <CategoryBreakdownChart />

          {/* ── Recent Transactions (Full Width) ── */}
          <Link to="/transactions" className="col-span-1 sm:col-span-2 lg:col-span-3">
            <Card className="transition-colors hover:border-foreground/20">
              <CardHeader>
                <CardTitle className="text-xs font-semibold uppercase tracking-wider">
                  Recent Transactions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex min-h-48 items-center justify-center rounded bg-muted/30 px-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    View and manage all your transactions
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* ── Budget Progress (Full Width) ── */}
          <Link to="/budgets" className="col-span-1 sm:col-span-2 lg:col-span-3">
            <Card className="transition-colors hover:border-foreground/20">
              <CardHeader>
                <CardTitle className="text-xs font-semibold uppercase tracking-wider">
                  Budget Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex min-h-48 items-center justify-center rounded bg-muted/30 px-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    Track spending against your budget limits
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* ── CSV Import ── */}
          <CsvImportCard />
        </section>
      </div>
    </main>
  );
}
