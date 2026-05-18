import { useState } from "react";
import { useCategories } from "../lib/queries/categories";
import { useTransactions } from "../lib/queries/transactions";
import { useTransactionsStore } from "../store/transactionsStore";
import { formatAmount, formatDate as formatTransactionDate } from "../lib/format";
import { getDefaultStartDate, getDefaultEndDate } from "../lib/date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BackToDashboardLink } from "@/components/BackToDashboardLink";
import { UserMenu } from "@/components/UserMenu";
import { SortableColumnHeader } from "@/components/SortableColumnHeader";
import { AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";

export function TransactionsPage() {
  const page = useTransactionsStore((s) => s.page);
  const limit = useTransactionsStore((s) => s.limit);
  const sortBy = useTransactionsStore((s) => s.sortBy);
  const sortOrder = useTransactionsStore((s) => s.sortOrder);
  const startDate = useTransactionsStore((s) => s.startDate);
  const endDate = useTransactionsStore((s) => s.endDate);
  const categoryId = useTransactionsStore((s) => s.categoryId);
  const search = useTransactionsStore((s) => s.search);
  const setPage = useTransactionsStore((s) => s.setPage);
  const setSortBy = useTransactionsStore((s) => s.setSortBy);
  const setCategoryId = useTransactionsStore((s) => s.setCategoryId);
  const setStartDate = useTransactionsStore((s) => s.setStartDate);
  const setEndDate = useTransactionsStore((s) => s.setEndDate);
  const setSearch = useTransactionsStore((s) => s.setSearch);
  const resetFilters = useTransactionsStore((s) => s.resetFilters);

  const [tempStartDate, setTempStartDate] = useState(startDate || getDefaultStartDate());
  const [tempEndDate, setTempEndDate] = useState(endDate || getDefaultEndDate());
  const [tempCategoryId, setTempCategoryId] = useState(categoryId || "");
  const [tempSearch, setTempSearch] = useState(search || "");

  const { data: categoriesData, error: categoriesError } = useCategories();
  const categories = categoriesData ?? [];

  const {
    data: transactionsData,
    isLoading,
    error,
  } = useTransactions({
    page,
    limit,
    sortBy,
    sortOrder,
    startDate: startDate || getDefaultStartDate(),
    endDate: endDate || getDefaultEndDate(),
    categoryId: categoryId || undefined,
    search: search || undefined,
  });

  const { t } = useTranslation();

  const transactions = transactionsData?.data ?? [];
  const meta = transactionsData?.meta;

  const handleApplyFilters = () => {
    setStartDate(tempStartDate || null);
    setEndDate(tempEndDate || null);
    setCategoryId(tempCategoryId || null);
    setSearch(tempSearch || null);
  };

  const handleClearFilters = () => {
    setTempStartDate(getDefaultStartDate());
    setTempEndDate(getDefaultEndDate());
    setTempCategoryId("");
    setTempSearch("");
    resetFilters();
  };

  const handleColumnSort = (field: "date" | "amount" | "merchant") => {
    setSortBy(field);
  };

  if (error) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <header className="mb-6 flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-bold text-foreground">
                {t("transactions.heading", "Transactions")}
              </h1>
              <BackToDashboardLink className="mt-2" />
            </div>
            <UserMenu />
          </header>
          <Alert variant="destructive" className="mt-8">
            <AlertCircle className="size-4" />
            <AlertDescription>
              {t(
                "transactions.errors.loadFailed",
                "Failed to load transactions. Please try again later.",
              )}
            </AlertDescription>
          </Alert>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold text-foreground">
              {t("transactions.heading", "Transactions")}
            </h1>
            <BackToDashboardLink className="mt-2" />
          </div>
          <UserMenu />
        </header>
        {/* Filters */}
        <Card className="mt-6 p-4">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">
              {t("transactions.filters.heading", "Filters")}
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Start Date */}
              <div className="space-y-2">
                <Label htmlFor="start-date">{t("common.startDate", "Start Date")}</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={tempStartDate}
                  onChange={(e) => setTempStartDate(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              {/* End Date */}
              <div className="space-y-2">
                <Label htmlFor="end-date">{t("common.endDate", "End Date")}</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={tempEndDate}
                  onChange={(e) => setTempEndDate(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label htmlFor="category">{t("transactions.filters.category", "Category")}</Label>
                <NativeSelect
                  id="category"
                  value={tempCategoryId}
                  onChange={(e) => setTempCategoryId(e.target.value)}
                  disabled={isLoading}
                >
                  <option value="">
                    {categoriesError
                      ? t("errors.loadCategories", "Failed to load categories")
                      : t("transactions.filters.allCategories", "All Categories")}
                  </option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.categoryName}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>

            {/* Search */}
            <div className="space-y-2">
              <Label htmlFor="search">{t("common.search", "Search")}</Label>
              <Input
                id="search"
                type="text"
                value={tempSearch}
                onChange={(e) => setTempSearch(e.target.value)}
                placeholder={t(
                  "transactions.filters.searchPlaceholder",
                  "Search by merchant name...",
                )}
                disabled={isLoading}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <Button onClick={handleApplyFilters} disabled={isLoading} size="sm">
                {t("common.apply", "Apply")}
              </Button>
              <Button onClick={handleClearFilters} variant="outline" disabled={isLoading} size="sm">
                {t("common.clear", "Clear")}
              </Button>
            </div>
          </div>
        </Card>

        {/* Table */}
        <Card className="mt-6 overflow-hidden">
          {isLoading ? (
            <div className="space-y-4 p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                // eslint-disable-next-line @eslint-react/no-array-index-key
                <div key={`loading-${i}`} className="h-12 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              {t("transactions.emptyState", "No transactions found. Try adjusting your filters.")}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-border bg-muted">
                    <tr>
                      <SortableColumnHeader
                        column="date"
                        label={t("transactions.table.date", "Date")}
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                        onSort={handleColumnSort}
                      />
                      <th scope="col" className="px-6 py-3 text-left font-semibold text-foreground">
                        {t("transactions.table.description", "Description")}
                      </th>
                      <th scope="col" className="px-6 py-3 text-left font-semibold text-foreground">
                        {t("transactions.table.category", "Category")}
                      </th>
                      <SortableColumnHeader
                        column="amount"
                        label={t("transactions.table.amount", "Amount")}
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                        onSort={handleColumnSort}
                        align="right"
                      />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-muted/50">
                        <td className="whitespace-nowrap px-6 py-3 text-sm text-foreground">
                          {formatTransactionDate(tx.date, i18n.resolvedLanguage)}
                        </td>
                        <td className="px-6 py-3 text-sm text-foreground">{tx.merchant}</td>
                        <td className="px-6 py-3 text-sm text-muted-foreground">
                          {tx.categoryName || "—"}
                        </td>
                        <td className="px-6 py-3 text-right text-sm font-medium text-foreground">
                          {formatAmount(tx.amount, i18n.resolvedLanguage)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {meta && meta.totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-border bg-muted/50 px-6 py-4">
                  <div className="text-sm text-muted-foreground">
                    {t(
                      "transactions.pagination.info",
                      "Page {{page}} of {{totalPages}} ({{totalCount}} total)",
                      { page: meta.page, totalPages: meta.totalPages, totalCount: meta.totalCount },
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setPage(Math.max(1, meta.page - 1))}
                      disabled={meta.page === 1 || isLoading}
                      variant="outline"
                      size="sm"
                    >
                      {t("common.previous", "Previous")}
                    </Button>

                    {/* Page Numbers — sliding window */}
                    <div className="flex gap-1">
                      {(() => {
                        const maxVisible = 5;
                        const half = Math.floor(maxVisible / 2);
                        let start = Math.max(1, meta.page - half);
                        const end = Math.min(meta.totalPages, start + maxVisible - 1);
                        start = Math.max(1, end - maxVisible + 1);

                        return Array.from({ length: end - start + 1 }, (_, i) => {
                          const pageNum = start + i;
                          return (
                            <Button
                              key={pageNum}
                              onClick={() => setPage(pageNum)}
                              disabled={isLoading}
                              variant={meta.page === pageNum ? "default" : "outline"}
                              size="sm"
                            >
                              {pageNum}
                            </Button>
                          );
                        });
                      })()}
                    </div>

                    <Button
                      onClick={() => setPage(meta.page + 1)}
                      disabled={meta.page === meta.totalPages || isLoading}
                      variant="outline"
                      size="sm"
                    >
                      {t("common.next", "Next")}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </main>
  );
}
