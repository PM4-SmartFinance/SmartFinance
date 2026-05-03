import { useState } from "react";
import { useBudgets, useDeleteBudget, getBudgetTypeLabel } from "../lib/queries/budgets";
import type { Budget, BudgetsParams, PeriodFilter, CategorySpending } from "../lib/queries/budgets";
import { ApiError } from "../lib/api";
import { useCategories } from "../lib/queries/categories";
import { BudgetCategoryGroup } from "../components/BudgetProgressCard";
import { CreateEditBudgetDialog } from "../components/CreateEditBudgetDialog";
import { DeleteBudgetDialog } from "../components/DeleteBudgetDialog";
import { Button } from "@/components/ui/button";
import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";

const PERIOD_OPTIONS: { value: PeriodFilter; label: string }[] = [
  { value: "DAILY", label: "Daily" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "YEARLY", label: "Yearly" },
  { value: "DATE_RANGE", label: "Date Range" },
];

function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getDefaultDateRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 30);
  return { start: formatLocalDate(start), end: formatLocalDate(end) };
}

export function BudgetsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [budgetToDelete, setBudgetToDelete] = useState<{
    id: string;
    categoryName: string;
    budgetLabel: string;
  } | null>(null);

  const [period, setPeriod] = useState<PeriodFilter>("MONTHLY");
  const [dateRange, setDateRange] = useState(getDefaultDateRange);

  const budgetParams: BudgetsParams =
    period === "DATE_RANGE"
      ? { period, startDate: dateRange.start, endDate: dateRange.end }
      : { period };

  const { data, isLoading, error } = useBudgets(budgetParams);
  const budgets = data?.budgets ?? [];
  const categorySpending = data?.categorySpending ?? [];

  const { data: categories = [], error: categoriesError } = useCategories();
  const { mutateAsync: deleteBudget, isPending: isDeleting } = useDeleteBudget();

  const categorySpendingMap = new Map<string, CategorySpending>(
    categorySpending.map((cs) => [cs.categoryId, cs]),
  );

  const getCategoryName = (categoryId: string) => {
    const category = categories.find((c) => c.id === categoryId);
    return category?.categoryName || categoryId;
  };

  const handleCreate = () => {
    setSelectedBudget(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (budget: Budget) => {
    setSelectedBudget(budget);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedBudget(null);
  };

  const handleDeleteClick = (budget: Budget) => {
    setDeleteError("");
    setBudgetToDelete({
      id: budget.id,
      categoryName: getCategoryName(budget.categoryId),
      budgetLabel: getBudgetTypeLabel(budget.type, budget.month, budget.year),
    });
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async (budgetId: string) => {
    setDeleteError("");
    try {
      await deleteBudget(budgetId);
      setDeleteDialogOpen(false);
      setBudgetToDelete(null);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message || "Failed to delete budget. Please try again."
          : "Failed to delete budget. Please try again.";
      setDeleteError(message);
    }
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setBudgetToDelete(null);
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold text-foreground">Budgets</h1>
          <div className="mt-8 text-center text-muted-foreground">Loading budgets…</div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold text-foreground">Budgets</h1>
          <div className="mt-8 text-center text-destructive">Failed to load budgets</div>
        </div>
      </main>
    );
  }

  if (categoriesError) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold text-foreground">Budgets</h1>
          <div className="mt-8 text-center text-destructive">Failed to load categories</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Page Header */}
        <header className="mb-8 flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <h1 className="text-4xl font-bold text-foreground">Budgets</h1>
            <p className="text-sm text-muted-foreground">
              Set spending limits per category and monitor progress
            </p>
            <Link
              to="/"
              className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Back to Dashboard
            </Link>
          </div>
          <Button onClick={handleCreate} size="sm">
            Create Budget
          </Button>
        </header>

        {/* Period Filter */}
        <div className="mb-6 flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="period-filter" className="text-sm font-medium">
              View Period
            </label>
            <select
              id="period-filter"
              value={period}
              onChange={(e) => setPeriod(e.target.value as PeriodFilter)}
              className="rounded border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              {PERIOD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {period === "DATE_RANGE" && (
            <>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="range-start" className="text-sm font-medium">
                  Start Date
                </label>
                <input
                  id="range-start"
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
                  max={dateRange.end}
                  className="rounded border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="range-end" className="text-sm font-medium">
                  End Date
                </label>
                <input
                  id="range-end"
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
                  min={dateRange.start}
                  className="rounded border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </>
          )}
        </div>

        {/* Budget Groups */}
        {budgets.length === 0 ? (
          <div className="text-center text-muted-foreground">
            <p>No budgets yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {groupBudgetsByCategory(budgets).map(([categoryId, categoryBudgets]) => (
              <BudgetCategoryGroup
                key={categoryId}
                categoryName={getCategoryName(categoryId)}
                budgets={categoryBudgets}
                categorySpending={categorySpendingMap.get(categoryId)}
                onEdit={handleEdit}
                onDelete={handleDeleteClick}
                deletingBudgetId={isDeleting ? budgetToDelete?.id : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <CreateEditBudgetDialog
        isOpen={isDialogOpen}
        budget={selectedBudget}
        onClose={handleCloseDialog}
      />

      {/* Delete Confirmation Dialog */}
      {budgetToDelete && (
        <DeleteBudgetDialog
          isOpen={deleteDialogOpen}
          budgetId={budgetToDelete.id}
          categoryName={budgetToDelete.categoryName}
          budgetLabel={budgetToDelete.budgetLabel}
          isDeleting={isDeleting}
          error={deleteError}
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      )}
    </main>
  );
}

function groupBudgetsByCategory(budgets: Budget[]): [string, Budget[]][] {
  const groups = new Map<string, Budget[]>();
  for (const b of budgets) {
    const list = groups.get(b.categoryId) ?? [];
    list.push(b);
    groups.set(b.categoryId, list);
  }
  return [...groups.entries()];
}
