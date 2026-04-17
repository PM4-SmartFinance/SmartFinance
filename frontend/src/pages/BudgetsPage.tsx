import { useState } from "react";
import { useBudgets, useDeleteBudget, getBudgetTypeLabel } from "../lib/queries/budgets";
import type { Budget } from "../lib/queries/budgets";
import { ApiError } from "../lib/api";
import { useCategories } from "../lib/queries/categories";
import { BudgetCategoryGroup } from "../components/BudgetProgressCard";
import { CreateEditBudgetDialog } from "../components/CreateEditBudgetDialog";
import { DeleteBudgetDialog } from "../components/DeleteBudgetDialog";
import { Button } from "@/components/ui/button";
import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";

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

  const { data: budgets = [], isLoading, error } = useBudgets();
  const { data: categories = [], error: categoriesError } = useCategories();
  const { mutateAsync: deleteBudget, isPending: isDeleting } = useDeleteBudget();

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
