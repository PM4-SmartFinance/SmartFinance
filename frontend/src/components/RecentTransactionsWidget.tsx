import { useTransactions } from "../lib/queries/transactions";
import { formatAmount, formatDate, FALLBACK } from "../lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DashboardTileLink } from "./DashboardTileLink";

const TEXT = {
  title: "Recent Transactions",
  navLabel: "View transactions",
  empty: "No transactions yet.",
  error: "Failed to load recent transactions.",
  retry: "Retry",
} as const;

const COLUMNS = ["Date", "Merchant", "Category", "Amount"] as const;

export function RecentTransactionsWidget() {
  const { data, isLoading, isError, error, refetch } = useTransactions({
    sortBy: "date",
    sortOrder: "desc",
    limit: 5,
  });

  if (import.meta.env.DEV && data !== undefined && !Array.isArray(data.data)) {
    console.warn("RecentTransactionsWidget: unexpected response shape", data);
  }

  if (isError && import.meta.env.DEV) {
    console.warn("RecentTransactionsWidget: query failed", error);
  }

  const transactions = Array.isArray(data?.data) ? data.data : [];

  const header = (
    <CardHeader>
      <CardTitle className="text-xs font-semibold uppercase tracking-wider">{TEXT.title}</CardTitle>
    </CardHeader>
  );

  if (isError) {
    return (
      <Card className="col-span-1 sm:col-span-2 lg:col-span-3">
        {header}
        <CardContent>
          <div className="flex flex-col items-center gap-2 py-4">
            <p role="alert" className="text-sm text-destructive">
              {TEXT.error}
            </p>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              {TEXT.retry}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <DashboardTileLink to="/transactions" ariaLabel={TEXT.navLabel}>
      {header}
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={`skeleton-${i}`} className="h-10 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex min-h-24 items-center justify-center">
            <p className="text-sm text-muted-foreground">{TEXT.empty}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="sr-only">
                <tr>
                  {COLUMNS.map((col) => (
                    <th key={col} scope="col">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td className="py-2.5 text-sm text-muted-foreground">{formatDate(tx.date)}</td>
                    <td className="px-4 py-2.5 text-sm text-foreground">{tx.merchant}</td>
                    <td className="px-4 py-2.5 text-sm text-muted-foreground">
                      {tx.categoryName ?? FALLBACK}
                    </td>
                    <td className="py-2.5 text-right text-sm font-medium text-foreground">
                      {formatAmount(tx.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </DashboardTileLink>
  );
}
