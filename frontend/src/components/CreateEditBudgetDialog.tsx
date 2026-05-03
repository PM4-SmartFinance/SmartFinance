import { useState, useEffect } from "react";
import { useCreateBudget, useUpdateBudget } from "../lib/queries/budgets";
import type { Budget, BudgetType } from "../lib/queries/budgets";
import { useCategories } from "../lib/queries/categories";
import { ApiError } from "../lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog } from "@/components/ui/dialog";

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
  active: true,
  error: "",
};

interface FormState {
  entryMode: EntryMode;
  limitAmount: string;
  categoryId: string;
  generalType: "DAILY" | "MONTHLY" | "YEARLY";
  specificMonth: string;
  specificYear: string;
  active: boolean;
  error: string;
}

export function CreateEditBudgetDialog({ isOpen, budget, onClose }: CreateEditBudgetDialogProps) {
  const [formState, setFormState] = useState<FormState>(emptyFormState);

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
        active: budget.active,
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

    if (!formState.categoryId) {
      setFormState((prev) => ({ ...prev, error: "Please select a category" }));
      return;
    }

    if (formState.entryMode === "specific" && !formState.specificMonth && !formState.specificYear) {
      setFormState((prev) => ({
        ...prev,
        error: "Please select at least a month or year for specific budgets",
      }));
      return;
    }

    const type = resolveBudgetType();

    const isSpecific = formState.entryMode === "specific";
    const month = isSpecific && formState.specificMonth ? parseInt(formState.specificMonth) : 0;
    const year = isSpecific && formState.specificYear ? parseInt(formState.specificYear) : 0;

    if (budget) {
      // Edit mode — send all fields, including explicit month/year reset for general types
      try {
        await updateMutation.mutateAsync({
          id: budget.id,
          input: {
            limitAmount: parseFloat(formState.limitAmount),
            categoryId: formState.categoryId,
            type,
            month,
            year,
            active: formState.active,
          },
        });
        onClose();
      } catch (err) {
        if (err instanceof ApiError) {
          setFormState((prev) => ({ ...prev, error: err.message || "Failed to update budget" }));
        } else {
          setFormState((prev) => ({ ...prev, error: "An unexpected error occurred" }));
        }
      }
    } else {
      // Create mode
      try {
        await createMutation.mutateAsync({
          categoryId: formState.categoryId,
          type,
          limitAmount: parseFloat(formState.limitAmount),
          ...(isSpecific && formState.specificMonth ? { month } : {}),
          ...(isSpecific && formState.specificYear ? { year } : {}),
        });
        onClose();
      } catch (err) {
        if (err instanceof ApiError) {
          setFormState((prev) => ({ ...prev, error: err.message || "Failed to create budget" }));
        } else {
          setFormState((prev) => ({ ...prev, error: "An unexpected error occurred" }));
        }
      }
    }
  };

  const isSubmitting = budget ? updateMutation.isPending : createMutation.isPending;

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <Dialog isOpen={isOpen} onClose={handleDialogClose}>
      <h2 className="mb-6 text-xl font-semibold text-foreground">
        {budget ? "Edit Budget" : "Create Budget"}
      </h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {formState.error && (
          <div className="rounded bg-red-50 p-2 text-sm text-red-600">{formState.error}</div>
        )}

        {/* Category Select — shown for both create and edit */}
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

        {/* Active Toggle — edit mode only */}
        {budget && (
          <div className="flex items-center gap-3">
            <Label htmlFor="active-toggle" className="cursor-pointer">
              Active
            </Label>
            <button
              id="active-toggle"
              type="button"
              role="switch"
              aria-checked={formState.active}
              onClick={() => setFormState((prev) => ({ ...prev, active: !prev.active }))}
              disabled={isSubmitting}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                formState.active ? "bg-primary" : "bg-input"
              }`}
            >
              <span
                className={`pointer-events-none block size-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${
                  formState.active ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        )}

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
    </Dialog>
  );
}

function isGeneralType(type: string): type is "DAILY" | "MONTHLY" | "YEARLY" {
  return type === "DAILY" || type === "MONTHLY" || type === "YEARLY";
}
