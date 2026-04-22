import { Link } from "react-router";
import { useTransactions } from "../lib/queries/transactions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const TEXT = {
  title: "Recent Transactions",
  viewAll: "View all",
  empty: "No transactions yet.",
  error: "Failed to load recent transactions.",
} as const;

export function RecentTransactionsWidget() {
  const { data, isLoading, isError } = useTransactions({
    sortBy: "date",
    sortOrder: "desc",
    limit: 5,
  });

  const transactions = data?.data ?? [];

  return (
    <Card className="col-span-1 sm:col-span-2 lg:col-span-3">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider">
          {TEXT.title}
        </CardTitle>
        <Link
          to="/transactions"
          className="text-xs text-muted-foreground hover:text-foreground"
          onClick={(e) => e.stopPropagation()}
        >
          {TEXT.viewAll}
        </Link>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {}
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={`skeleton-${i}`} className="h-10 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : isError ? (
          <p className="text-sm text-destructive">{TEXT.error}</p>
        ) : transactions.length === 0 ? (
          <div className="flex min-h-24 items-center justify-center">
            <p className="text-sm text-muted-foreground">{TEXT.empty}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <tbody className="divide-y divide-border">
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td className="py-2.5 text-sm text-muted-foreground">
                      {new Date(tx.date).toLocaleDateString("de-CH")}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-foreground">{tx.merchant}</td>
                    <td className="px-4 py-2.5 text-sm text-muted-foreground">
                      {tx.categoryName ?? "—"}
                    </td>
                    <td className="py-2.5 text-right text-sm font-medium text-foreground">
                      {parseFloat(tx.amount) < 0 ? "−" : ""}
                      CHF {Math.abs(parseFloat(tx.amount)).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
