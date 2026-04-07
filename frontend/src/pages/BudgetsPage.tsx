import { Link } from "react-router";
import { Button } from "@/components/ui/button";

const TEXT = {
  heading: "Budget Management",
  subtitle: "View and manage your budgets",
  backToDashboard: "← Back to Dashboard",
  comingSoon: "Budget management page coming soon",
} as const;

export function BudgetsPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-foreground">{TEXT.heading}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{TEXT.subtitle}</p>
          </div>
          <Link to="/">
            <Button variant="outline">{TEXT.backToDashboard}</Button>
          </Link>
        </div>

        <div className="rounded border border-muted bg-muted/50 p-8 text-center">
          <p className="text-muted-foreground">{TEXT.comingSoon}</p>
        </div>
      </div>
    </main>
  );
}
