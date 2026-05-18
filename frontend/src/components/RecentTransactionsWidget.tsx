import { useTransactions } from "../lib/queries/transactions";
import { formatAmount, formatDate, FALLBACK } from "../lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DashboardTileLink } from "./DashboardTileLink";
import { useTranslation } from "react-i18next";

export function RecentTransactionsWidget() {
  const { data, isLoading, isError, error, refetch } = useTransactions({
    sortBy: "date",
    sortOrder: "desc",
    limit: 5,
  });

  const { t, i18n } = useTranslation();

  const COLUMNS = [
    t("transactions.table.date", "Date"),
    t("components.recentTransactionsWidget.merchant", "Merchant"),
    t("transactions.table.category", "Category"),
    t("transactions.table.amount", "Amount"),
  ];

  if (data !== undefined && !Array.isArray(data.data)) {
    console.warn("RecentTransactionsWidget: unexpected response shape", data);
  }

  if (isError) {
    console.warn("RecentTransactionsWidget: query failed", error);
  }

  const transactions = Array.isArray(data?.data) ? data.data : [];

  const header = (
    <CardHeader>
      <CardTitle className="text-xs font-semibold uppercase tracking-wider">
        {t("components.recentTransactionsWidget.title", "Recent Transactions")}
      </CardTitle>
    </CardHeader>
  );

  if (isError) {
    return (
      <Card className="col-span-1 sm:col-span-2 lg:col-span-3">
        {header}
        <CardContent>
          <div className="flex flex-col items-center gap-2 py-4">
            <p role="alert" className="text-sm text-destructive">
              {t(
                "components.recentTransactionsWidget.error",
                "Failed to load recent transactions.",
              )}
            </p>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              {t("common.retry", "Retry")}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <DashboardTileLink
      to="/transactions"
      ariaLabel={t("components.recentTransactionsWidget.navLabel", "View transactions")}
    >
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
            <p className="text-sm text-muted-foreground">
              {t("components.recentTransactionsWidget.empty", "No transactions yet.")}
            </p>
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
                    <td className="py-2.5 text-sm text-muted-foreground">
                      {formatDate(tx.date, i18n.resolvedLanguage)}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-foreground">{tx.merchant}</td>
                    <td className="px-4 py-2.5 text-sm text-muted-foreground">
                      {tx.categoryName ?? FALLBACK}
                    </td>
                    <td className="py-2.5 text-right text-sm font-medium text-foreground">
                      {formatAmount(tx.amount, i18n.resolvedLanguage)}
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
