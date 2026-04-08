import { useState, useEffect, useRef } from "react";
import { useCreateBudget, useUpdateBudget, Budget } from "../lib/queries/budgets";
import { useCategories } from "../lib/queries/categories";
import { ApiError } from "../lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CreateEditBudgetDialogProps {
  isOpen: boolean;
  budget: Budget | null;
  onClose: () => void;
}

interface FormState {
  limitAmount: string;
  categoryId: string;
  month: string;
  year: string;
  error: string;
}

export function CreateEditBudgetDialog({ isOpen, budget, onClose }: CreateEditBudgetDialogProps) {
  const [formState, setFormState] = useState<FormState>({
    limitAmount: "",
    categoryId: "",
    month: "",
    year: "",
    error: "",
  });
  const dialogRef = useRef<HTMLDialogElement>(null);

  const createMutation = useCreateBudget();
  const updateMutation = useUpdateBudget();
  const { data: categories = [], isLoading: categoriesLoading } = useCategories();

  // Sync form state with budget prop and manage dialog open/close

  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.showModal();
      // Reset form when opening for create, or sync with budget when editing
      if (budget) {
        setFormState({
          limitAmount: budget.limitAmount,
          categoryId: budget.categoryId,
          month: budget.month.toString(),
          year: budget.year.toString(),
          error: "",
        });
      } else {
        setFormState({
          limitAmount: "",
          categoryId: "",
          month: "",
          year: "",
          error: "",
        });
      }
    } else {
      dialogRef.current?.close();
    }
  }, [isOpen, budget]);

  const handleDialogClose = () => {
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormState((prev) => ({ ...prev, error: "" }));

    if (!formState.limitAmount || parseFloat(formState.limitAmount) <= 0) {
      setFormState((prev) => ({ ...prev, error: "Please enter a valid limit amount" }));
      return;
    }

    if (budget) {
      // Edit mode
      try {
        await updateMutation.mutateAsync({
          id: budget.id,
          input: { limitAmount: parseFloat(formState.limitAmount) },
        });
        onClose();
      } catch (err) {
        if (err instanceof ApiError) {
          setFormState((prev) => ({ ...prev, error: err.message || "Failed to update budget" }));
        } else {
          throw err;
        }
      }
    } else {
      // Create mode
      if (!formState.categoryId) {
        setFormState((prev) => ({ ...prev, error: "Please select a category" }));
        return;
      }
      if (!formState.month) {
        setFormState((prev) => ({ ...prev, error: "Please select a month" }));
        return;
      }
      if (!formState.year) {
        setFormState((prev) => ({ ...prev, error: "Please select a year" }));
        return;
      }

      try {
        await createMutation.mutateAsync({
          categoryId: formState.categoryId,
          month: parseInt(formState.month),
          year: parseInt(formState.year),
          limitAmount: parseFloat(formState.limitAmount),
        });
        onClose();
      } catch (err) {
        if (err instanceof ApiError) {
          setFormState((prev) => ({ ...prev, error: err.message || "Failed to create budget" }));
        } else {
          throw err;
        }
      }
    }
  };

  const isSubmitting = budget ? updateMutation.isPending : createMutation.isPending;

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <dialog
      ref={dialogRef}
      className="w-full max-w-md rounded-lg shadow-lg backdrop:bg-black/50 open:flex open:items-center open:justify-center"
      onClose={handleDialogClose}
    >
      <div className="rounded-lg bg-background p-6 shadow-lg">
        <h2 className="mb-6 text-xl font-semibold text-foreground">
          {budget ? "Edit Budget" : "Create Budget"}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {formState.error && (
            <div className="rounded bg-red-50 p-2 text-sm text-red-600">{formState.error}</div>
          )}

          {!budget && (
            <>
              {/* Category Select */}
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <select
                  id="category"
                  value={formState.categoryId}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, categoryId: e.target.value }))
                  }
                  disabled={isSubmitting || categoriesLoading}
                  className="w-full rounded border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Select a category…</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.categoryName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Month Select */}
              <div className="space-y-2">
                <Label htmlFor="month">Month</Label>
                <select
                  id="month"
                  value={formState.month}
                  onChange={(e) => setFormState((prev) => ({ ...prev, month: e.target.value }))}
                  disabled={isSubmitting}
                  className="w-full rounded border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Select a month…</option>
                  {months.map((m) => {
                    const monthName = new Date(currentYear, m - 1).toLocaleDateString("en-US", {
                      month: "long",
                    });
                    return (
                      <option key={m} value={m}>
                        {monthName}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Year Select */}
              <div className="space-y-2">
                <Label htmlFor="year">Year</Label>
                <select
                  id="year"
                  value={formState.year}
                  onChange={(e) => setFormState((prev) => ({ ...prev, year: e.target.value }))}
                  disabled={isSubmitting}
                  className="w-full rounded border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Select a year…</option>
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Spending Limit */}
          <div className="space-y-2">
            <Label htmlFor="limit-amount">Spending Limit</Label>
            <Input
              id="limit-amount"
              type="number"
              step="0.01"
              value={formState.limitAmount}
              onChange={(e) => setFormState((prev) => ({ ...prev, limitAmount: e.target.value }))}
              placeholder="Enter limit amount"
              disabled={isSubmitting}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting
                ? budget
                  ? "Saving…"
                  : "Creating…"
                : budget
                  ? "Save Changes"
                  : "Create Budget"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleDialogClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
