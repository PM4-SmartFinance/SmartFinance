import { useState, useEffect } from "react";
import { useCreateBudget, useUpdateBudget } from "../lib/queries/budgets";
import type { Budget, BudgetType } from "../lib/queries/budgets";
import { useCategories } from "../lib/queries/categories";
import { ApiError } from "../lib/api";
import { useDialog } from "../hooks/useDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CreateEditBudgetDialogProps {
  isOpen: boolean;
  budget: Budget | null;
  onClose: () => void;
}

type EntryMode = "general" | "specific";

const emptyFormState: FormState = {
  entryMode: "general",
  limitAmount: "",
  categoryId: "",
  generalType: "MONTHLY",
  specificMonth: "",
  specificYear: "",
  error: "",
};

interface FormState {
  entryMode: EntryMode;
  limitAmount: string;
  categoryId: string;
  // General mode
  generalType: "DAILY" | "MONTHLY" | "YEARLY";
  // Specific mode
  specificMonth: string;
  specificYear: string;
  error: string;
}

export function CreateEditBudgetDialog({ isOpen, budget, onClose }: CreateEditBudgetDialogProps) {
  const [formState, setFormState] = useState<FormState>(emptyFormState);
  const dialogRef = useDialog(isOpen);

  const createMutation = useCreateBudget();
  const updateMutation = useUpdateBudget();
  const { data: categories = [], isLoading: categoriesLoading } = useCategories();

  // Reset form when dialog opens/closes or budget changes
  useEffect(() => {
    if (!isOpen) {
      // eslint-disable-next-line @eslint-react/hooks-extra/no-direct-set-state-in-use-effect
      setFormState(emptyFormState);
      return;
    }
    if (budget) {
      // eslint-disable-next-line @eslint-react/hooks-extra/no-direct-set-state-in-use-effect
      setFormState({
        entryMode: isGeneralType(budget.type) ? "general" : "specific",
        limitAmount: budget.limitAmount,
        categoryId: budget.categoryId,
        generalType: isGeneralType(budget.type)
          ? (budget.type as "DAILY" | "MONTHLY" | "YEARLY")
          : "MONTHLY",
        specificMonth: budget.month > 0 ? budget.month.toString() : "",
        specificYear: budget.year > 0 ? budget.year.toString() : "",
        error: "",
      });
    } else {
      // eslint-disable-next-line @eslint-react/hooks-extra/no-direct-set-state-in-use-effect
      setFormState(emptyFormState);
    }
  }, [isOpen, budget]);

  const handleDialogClose = () => {
    onClose();
  };

  const resolveBudgetType = (): BudgetType => {
    if (formState.entryMode === "general") {
      return formState.generalType;
    }
    const hasMonth = formState.specificMonth !== "";
    const hasYear = formState.specificYear !== "";
    if (hasMonth && hasYear) return "SPECIFIC_MONTH_YEAR";
    if (hasMonth) return "SPECIFIC_MONTH";
    if (hasYear) return "SPECIFIC_YEAR";
    throw new Error("unreachable: no month or year selected for specific budget");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormState((prev) => ({ ...prev, error: "" }));

    if (!formState.limitAmount || parseFloat(formState.limitAmount) <= 0) {
      setFormState((prev) => ({ ...prev, error: "Please enter a valid limit amount" }));
      return;
    }

    if (budget) {
      // Edit mode: send all fields that may have changed
      if (!formState.categoryId) {
        setFormState((prev) => ({ ...prev, error: "Please select a category" }));
        return;
      }

      if (
        formState.entryMode === "specific" &&
        !formState.specificMonth &&
        !formState.specificYear
      ) {
        setFormState((prev) => ({
          ...prev,
          error: "Please select at least a month or year for specific budgets",
        }));
        return;
      }

      const type = resolveBudgetType();
      const month =
        formState.entryMode === "specific" && formState.specificMonth
          ? parseInt(formState.specificMonth)
          : 0;
      const year =
        formState.entryMode === "specific" && formState.specificYear
          ? parseInt(formState.specificYear)
          : 0;

      try {
        await updateMutation.mutateAsync({
          id: budget.id,
          input: {
            categoryId: formState.categoryId,
            type,
            month,
            year,
            limitAmount: parseFloat(formState.limitAmount),
          },
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

      if (
        formState.entryMode === "specific" &&
        !formState.specificMonth &&
        !formState.specificYear
      ) {
        setFormState((prev) => ({
          ...prev,
          error: "Please select at least a month or year for specific budgets",
        }));
        return;
      }

      const type = resolveBudgetType();

      try {
        await createMutation.mutateAsync({
          categoryId: formState.categoryId,
          type,
          limitAmount: parseFloat(formState.limitAmount),
          ...(formState.specificMonth && formState.entryMode === "specific"
            ? { month: parseInt(formState.specificMonth) }
            : {}),
          ...(formState.specificYear && formState.entryMode === "specific"
            ? { year: parseInt(formState.specificYear) }
            : {}),
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
      className="m-auto w-full max-w-md rounded-lg shadow-lg backdrop:bg-black/50 open:flex open:items-center open:justify-center"
      onClose={handleDialogClose}
    >
      <div className="w-full rounded-lg bg-background p-6 shadow-lg">
        <h2 className="mb-6 text-xl font-semibold text-foreground">
          {budget ? "Edit Budget" : "Create Budget"}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {formState.error && (
            <div className="rounded bg-red-50 p-2 text-sm text-red-600">{formState.error}</div>
          )}

          {/* Category Select */}
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <select
              id="category"
              value={formState.categoryId}
              onChange={(e) => setFormState((prev) => ({ ...prev, categoryId: e.target.value }))}
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

          {/* Entry Mode Toggle */}
          <div className="space-y-2">
            <Label>Budget Type</Label>
            <div className="flex gap-2">
              <button
                type="button"
                className={`flex-1 rounded border px-3 py-2 text-sm font-medium transition-colors ${
                  formState.entryMode === "general"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background text-foreground hover:bg-muted"
                }`}
                onClick={() => setFormState((prev) => ({ ...prev, entryMode: "general" }))}
                disabled={isSubmitting}
              >
                General
              </button>
              <button
                type="button"
                className={`flex-1 rounded border px-3 py-2 text-sm font-medium transition-colors ${
                  formState.entryMode === "specific"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background text-foreground hover:bg-muted"
                }`}
                onClick={() => setFormState((prev) => ({ ...prev, entryMode: "specific" }))}
                disabled={isSubmitting}
              >
                Specific
              </button>
            </div>
          </div>

          {/* General Mode: Period Dropdown */}
          {formState.entryMode === "general" && (
            <div className="space-y-2">
              <Label htmlFor="period">Period</Label>
              <select
                id="period"
                value={formState.generalType}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    generalType: e.target.value as "DAILY" | "MONTHLY" | "YEARLY",
                  }))
                }
                disabled={isSubmitting}
                className="w-full rounded border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="DAILY">Daily</option>
                <option value="MONTHLY">Monthly</option>
                <option value="YEARLY">Yearly</option>
              </select>
            </div>
          )}

          {/* Specific Mode: Month + Year pickers */}
          {formState.entryMode === "specific" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="specific-month">Month (optional)</Label>
                <select
                  id="specific-month"
                  value={formState.specificMonth}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, specificMonth: e.target.value }))
                  }
                  disabled={isSubmitting}
                  className="w-full rounded border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Any month</option>
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
              <div className="space-y-2">
                <Label htmlFor="specific-year">Year (optional)</Label>
                <select
                  id="specific-year"
                  value={formState.specificYear}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, specificYear: e.target.value }))
                  }
                  disabled={isSubmitting}
                  className="w-full rounded border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Any year</option>
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

function isGeneralType(type: string): type is "DAILY" | "MONTHLY" | "YEARLY" {
  return type === "DAILY" || type === "MONTHLY" || type === "YEARLY";
}
