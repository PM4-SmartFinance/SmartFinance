import { useState } from "react";
import { useCategories } from "../lib/queries/categories";
import { useTransactions } from "../lib/queries/transactions";
import { useTransactionsStore } from "../store/transactionsStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0]!;
}

function getDefaultStartDate(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return formatDate(d);
}

function getDefaultEndDate(): string {
  return formatDate(new Date());
}

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
          <h1 className="text-4xl font-bold text-foreground">Transactions</h1>
          <Link
            to="/"
            className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to Dashboard
          </Link>
          <div className="mt-8 rounded bg-red-50 p-4 text-sm text-red-600">
            Failed to load transactions. Please try again later.
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold text-foreground">Transactions</h1>
        <Link
          to="/"
          className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to Dashboard
        </Link>
        {/* Filters */}
        <Card className="mt-6 p-4">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Filters</h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Start Date */}
              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date</Label>
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
                <Label htmlFor="end-date">End Date</Label>
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
                <Label htmlFor="category">Category</Label>
                <select
                  id="category"
                  value={tempCategoryId}
                  onChange={(e) => setTempCategoryId(e.target.value)}
                  disabled={isLoading}
                  className="w-full rounded border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">
                    {categoriesError ? "Failed to load categories" : "All Categories"}
                  </option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.categoryName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Search */}
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <Input
                id="search"
                type="text"
                value={tempSearch}
                onChange={(e) => setTempSearch(e.target.value)}
                placeholder="Search by merchant name..."
                disabled={isLoading}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <Button onClick={handleApplyFilters} disabled={isLoading} size="sm">
                Apply
              </Button>
              <Button onClick={handleClearFilters} variant="outline" disabled={isLoading} size="sm">
                Clear
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
              No transactions found. Try adjusting your filters.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-border bg-muted">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left">
                        <button
                          onClick={() => handleColumnSort("date")}
                          className="flex items-center gap-2 font-semibold text-foreground hover:text-foreground/80"
                        >
                          Date
                          {sortBy === "date" && <span>{sortOrder === "asc" ? "↑" : "↓"}</span>}
                        </button>
                      </th>
                      <th scope="col" className="px-6 py-3 text-left font-semibold text-foreground">
                        Description
                      </th>
                      <th scope="col" className="px-6 py-3 text-left font-semibold text-foreground">
                        Category
                      </th>
                      <th scope="col" className="px-6 py-3 text-right">
                        <button
                          onClick={() => handleColumnSort("amount")}
                          className="flex items-center justify-end gap-2 font-semibold text-foreground hover:text-foreground/80"
                        >
                          Amount
                          {sortBy === "amount" && <span>{sortOrder === "asc" ? "↑" : "↓"}</span>}
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-muted/50">
                        <td className="whitespace-nowrap px-6 py-3 text-sm text-foreground">
                          {new Date(tx.date).toLocaleDateString("de-CH")}
                        </td>
                        <td className="px-6 py-3 text-sm text-foreground">{tx.merchant}</td>
                        <td className="px-6 py-3 text-sm text-muted-foreground">
                          {tx.categoryName || "—"}
                        </td>
                        <td className="px-6 py-3 text-right text-sm font-medium text-foreground">
                          {parseFloat(tx.amount) < 0 ? "−" : ""}
                          CHF {Math.abs(parseFloat(tx.amount)).toFixed(2)}
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
                    Page {meta.page} of {meta.totalPages} ({meta.totalCount} total)
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setPage(Math.max(1, meta.page - 1))}
                      disabled={meta.page === 1 || isLoading}
                      variant="outline"
                      size="sm"
                    >
                      Previous
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
                      Next
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
