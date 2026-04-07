import { useState } from "react";
import { useCategories } from "../lib/queries/categories";
import { useTransactions } from "../lib/queries/transactions";
import { useTransactionsStore } from "../store/transactionsStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

export function TransactionsPage() {
  const store = useTransactionsStore();
  const [tempStartDate, setTempStartDate] = useState(store.startDate || "");
  const [tempEndDate, setTempEndDate] = useState(store.endDate || "");

  const { data: categoriesData } = useCategories();
  const categories = categoriesData ?? [];

  const {
    data: transactionsData,
    isLoading,
    error,
  } = useTransactions({
    page: store.page,
    limit: store.limit,
    sortBy: store.sortBy,
    sortOrder: store.sortOrder,
    startDate: store.startDate || undefined,
    endDate: store.endDate || undefined,
    categoryId: store.categoryId || undefined,
  });

  const transactions = transactionsData?.data ?? [];
  const meta = transactionsData?.meta;

  const handleApplyDateFilter = () => {
    store.setStartDate(tempStartDate || null);
    store.setEndDate(tempEndDate || null);
  };

  const handleClearFilters = () => {
    setTempStartDate("");
    setTempEndDate("");
    store.resetFilters();
  };

  const handleColumnSort = (field: "date" | "amount" | "merchant") => {
    store.setSortBy(field);
  };

  if (error) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold text-foreground">Transactions</h1>
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
                  value={store.categoryId || ""}
                  onChange={(e) => store.setCategoryId(e.target.value || null)}
                  disabled={isLoading}
                  className="w-full rounded border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex items-end gap-2">
                <Button onClick={handleApplyDateFilter} disabled={isLoading} className="flex-1">
                  Apply
                </Button>
                <Button onClick={handleClearFilters} variant="outline" disabled={isLoading}>
                  Clear
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Table */}
        <Card className="mt-6 overflow-hidden">
          {isLoading ? (
            <div className="space-y-4 p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded bg-muted" />
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
                      <th className="px-6 py-3 text-left">
                        <button
                          onClick={() => handleColumnSort("date")}
                          className="flex items-center gap-2 font-semibold text-foreground hover:text-foreground/80"
                        >
                          Date
                          {store.sortBy === "date" && (
                            <span>{store.sortOrder === "asc" ? "↑" : "↓"}</span>
                          )}
                        </button>
                      </th>
                      <th className="px-6 py-3 text-left font-semibold text-foreground">
                        Description
                      </th>
                      <th className="px-6 py-3 text-left font-semibold text-foreground">
                        Category
                      </th>
                      <th className="px-6 py-3 text-right">
                        <button
                          onClick={() => handleColumnSort("amount")}
                          className="flex items-center justify-end gap-2 font-semibold text-foreground hover:text-foreground/80"
                        >
                          Amount
                          {store.sortBy === "amount" && (
                            <span>{store.sortOrder === "asc" ? "↑" : "↓"}</span>
                          )}
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-muted/50">
                        <td className="whitespace-nowrap px-6 py-3 text-sm text-foreground">
                          {new Date(tx.date).toLocaleDateString()}
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
                      onClick={() => store.setPage(Math.max(1, meta.page - 1))}
                      disabled={meta.page === 1 || isLoading}
                      variant="outline"
                      size="sm"
                    >
                      Previous
                    </Button>

                    {/* Page Numbers */}
                    <div className="flex gap-1">
                      {Array.from({ length: Math.min(5, meta.totalPages) }).map((_, i) => {
                        const pageNum = i + 1;
                        return (
                          <Button
                            key={pageNum}
                            onClick={() => store.setPage(pageNum)}
                            disabled={isLoading}
                            variant={meta.page === pageNum ? "default" : "outline"}
                            size="sm"
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>

                    <Button
                      onClick={() => store.setPage(meta.page + 1)}
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
