import { useNavigate, Link } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthProvider";
import { api } from "../lib/api";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "../components/DateRangePicker";
import { SummaryMetricsWidget } from "../components/SummaryMetricsWidget";
import { BudgetWidget } from "../components/BudgetWidget";
import { SpendingTrendChart } from "../components/SpendingTrendChart";
import { CategoryBreakdownChart } from "../components/CategoryBreakdownChart";

const TEXT = {
  heading: "Dashboard",
  subtitle: "View your financial overview at a glance",
  greeting: "Welcome back",
  profile: "Profile",
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
          <div className="flex items-center gap-2">
            <Link
              to="/profile"
              className="inline-flex h-8 items-center rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {TEXT.profile}
            </Link>
            <Button variant="outline" size="sm" disabled={isPending} onClick={() => logout()}>
              {isPending ? TEXT.signingOut : TEXT.signOut}
            </Button>
          </div>
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
        </section>
      </div>
    </main>
  );
}
