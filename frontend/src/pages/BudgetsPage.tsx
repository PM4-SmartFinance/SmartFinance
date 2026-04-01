import { useState } from "react";
import { useBudgets, useDeleteBudget, Budget } from "../lib/queries/budgets";
import { useCategories } from "../lib/queries/categories";
import { BudgetProgressCard } from "../components/BudgetProgressCard";
import { CreateEditBudgetDialog } from "../components/CreateEditBudgetDialog";
import { DeleteBudgetDialog } from "../components/DeleteBudgetDialog";
import { Button } from "@/components/ui/button";

export function BudgetsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [budgetToDelete, setBudgetToDelete] = useState<{
    id: string;
    categoryName: string;
    monthYear: string;
  } | null>(null);

  const { data: budgets = [], isLoading, error } = useBudgets();
  const { data: categories = [], error: categoriesError } = useCategories();
  const { mutate: deleteBudget, isPending: isDeleting } = useDeleteBudget();

  const getCategoryName = (categoryId: string) => {
    const category = categories.find((c) => c.id === categoryId);
    return category?.name || categoryId;
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
    const monthYear = new Date(budget.year, budget.month - 1).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
    setBudgetToDelete({
      id: budget.id,
      categoryName: getCategoryName(budget.categoryId),
      monthYear,
    });
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async (budgetId: string) => {
    setDeleteError("");
    try {
      // Wait for the mutation to complete
      await new Promise<void>((resolve, reject) => {
        deleteBudget(budgetId, {
          onSuccess: () => resolve(),
          onError: (error) => reject(error),
        });
      });
      setDeleteDialogOpen(false);
      setBudgetToDelete(null);
    } catch (err) {
      setDeleteError("Failed to delete budget. Please try again.");
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
          </div>
          <Button onClick={handleCreate} size="sm">
            Create Budget
          </Button>
        </header>

        {/* Budget Grid */}
        {budgets.length === 0 ? (
          <div className="text-center text-muted-foreground">
            <p>No budgets yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {budgets.map((budget) => (
              <BudgetProgressCard
                key={budget.id}
                budget={budget}
                categoryName={getCategoryName(budget.categoryId)}
                onEdit={handleEdit}
                onDelete={handleDeleteClick}
                isDeleting={isDeleting && budgetToDelete?.id === budget.id}
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
          monthYear={budgetToDelete.monthYear}
          isDeleting={isDeleting}
          error={deleteError}
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      )}
    </main>
  );
}
