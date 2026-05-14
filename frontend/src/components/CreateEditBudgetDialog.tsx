import { useState, useMemo } from "react";
import { useCreateBudget, useUpdateBudget } from "../lib/queries/budgets";
import type { Budget, BudgetType } from "../lib/queries/budgets";
import { useCategories } from "../lib/queries/categories";
import { ApiError } from "../lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog } from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/native-select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

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
  const initialFormState = useMemo((): FormState => {
    if (!isOpen || !budget) return emptyFormState;
    return {
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
    };
  }, [
    isOpen,
    budget?.id,
    budget?.limitAmount,
    budget?.categoryId,
    budget?.type,
    budget?.month,
    budget?.year,
    budget?.active,
  ]);

  const [formState, setFormState] = useState<FormState>(initialFormState);
  const [prevInitialFormState, setPrevInitialFormState] = useState(initialFormState);
  const [isDirty, setIsDirty] = useState(false);
  const { t } = useTranslation();

  if (prevInitialFormState !== initialFormState) {
    setPrevInitialFormState(initialFormState);
    // On close (or fresh open), force-reset and clear dirty.
    // On mid-edit prop change, preserve the user's unsaved input.
    if (!isOpen || !isDirty) {
      setFormState(initialFormState);
      setIsDirty(false);
    }
  }

  const updateFormState = (updater: (prev: FormState) => FormState) => {
    setIsDirty(true);
    setFormState(updater);
  };

  const createMutation = useCreateBudget();
  const updateMutation = useUpdateBudget();
  const { data: categories = [], isLoading: categoriesLoading } = useCategories();

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
      setFormState((prev) => ({
        ...prev,
        error: t(
          "components.createEditBudgetDialog.errors.invalidLimit",
          "Please enter a valid limit amount",
        ),
      }));
      return;
    }

    if (!formState.categoryId) {
      setFormState((prev) => ({
        ...prev,
        error: t(
          "components.createEditBudgetDialog.errors.missingCategory",
          "Please select a category",
        ),
      }));
      return;
    }

    if (formState.entryMode === "specific" && !formState.specificMonth && !formState.specificYear) {
      setFormState((prev) => ({
        ...prev,
        error: t(
          "components.createEditBudgetDialog.errors.missingMonthYear",
          "Please select at least a month or year for specific budgets",
        ),
      }));
      return;
    }

    const type = resolveBudgetType();

    if (budget) {
      // Edit mode — send all fields
      try {
        await updateMutation.mutateAsync({
          id: budget.id,
          input: {
            limitAmount: parseFloat(formState.limitAmount),
            categoryId: formState.categoryId,
            type,
            ...(formState.specificMonth && formState.entryMode === "specific"
              ? { month: parseInt(formState.specificMonth) }
              : {}),
            ...(formState.specificYear && formState.entryMode === "specific"
              ? { year: parseInt(formState.specificYear) }
              : {}),
            active: formState.active,
          },
        });
        onClose();
      } catch (err) {
        if (err instanceof ApiError) {
          setFormState((prev) => ({
            ...prev,
            error:
              err.message ||
              t("components.createEditBudgetDialog.errors.updateFailed", "Failed to update budget"),
          }));
        } else {
          throw err;
        }
      }
    } else {
      // Create mode
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
          setFormState((prev) => ({
            ...prev,
            error:
              err.message ||
              t("components.createEditBudgetDialog.errors.updateFailed", "Failed to update budget"),
          }));
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
    <Dialog isOpen={isOpen} onClose={handleDialogClose}>
      <h2 className="mb-6 text-xl font-semibold text-foreground">
        {budget
          ? t("components.createEditBudgetDialog.titleEdit", "Edit Budget")
          : t("components.createEditBudgetDialog.titleCreate", "Create Budget")}
      </h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {formState.error && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{formState.error}</AlertDescription>
          </Alert>
        )}

        {/* Category Select — shown for both create and edit */}
        <div className="space-y-2">
          <Label htmlFor="category">{t("common.category", "Category")}</Label>
          <NativeSelect
            id="category"
            value={formState.categoryId}
            onChange={(e) => updateFormState((prev) => ({ ...prev, categoryId: e.target.value }))}
            disabled={isSubmitting || categoriesLoading}
          >
            <option value="">
              {t("components.createEditBudgetDialog.selectCategory", "Select a category…")}
            </option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.categoryName}
              </option>
            ))}
          </NativeSelect>
        </div>

        {/* Entry Mode Toggle */}
        <div className="space-y-2">
          <Label>{t("components.createEditBudgetDialog.budgetType", "Budget Type")}</Label>
          <div className="flex gap-2">
            <button
              type="button"
              className={`flex-1 rounded border px-3 py-2 text-sm font-medium transition-colors ${
                formState.entryMode === "general"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background text-foreground hover:bg-muted"
              }`}
              onClick={() => updateFormState((prev) => ({ ...prev, entryMode: "general" }))}
              disabled={isSubmitting}
            >
              {t("components.createEditBudgetDialog.general", "General")}
            </button>
            <button
              type="button"
              className={`flex-1 rounded border px-3 py-2 text-sm font-medium transition-colors ${
                formState.entryMode === "specific"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background text-foreground hover:bg-muted"
              }`}
              onClick={() => updateFormState((prev) => ({ ...prev, entryMode: "specific" }))}
              disabled={isSubmitting}
            >
              {t("components.createEditBudgetDialog.specific", "Specific")}
            </button>
          </div>
        </div>

        {/* General Mode: Period Dropdown */}
        {formState.entryMode === "general" && (
          <div className="space-y-2">
            <Label htmlFor="period">
              {t("components.createEditBudgetDialog.period", "Period")}
            </Label>
            <NativeSelect
              id="period"
              value={formState.generalType}
              onChange={(e) =>
                updateFormState((prev) => ({
                  ...prev,
                  generalType: e.target.value as "DAILY" | "MONTHLY" | "YEARLY",
                }))
              }
              disabled={isSubmitting}
            >
              <option value="DAILY">{t("budgets.periods.daily", "Daily")}</option>
              <option value="MONTHLY">{t("budgets.periods.monthly", "Monthly")}</option>
              <option value="YEARLY">{t("budgets.periods.yearly", "Yearly")}</option>
            </NativeSelect>
          </div>
        )}

        {/* Specific Mode: Month + Year pickers */}
        {formState.entryMode === "specific" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="specific-month">
                {t("components.createEditBudgetDialog.monthOptional", "Month (optional)")}
              </Label>
              <NativeSelect
                id="specific-month"
                value={formState.specificMonth}
                onChange={(e) =>
                  updateFormState((prev) => ({ ...prev, specificMonth: e.target.value }))
                }
                disabled={isSubmitting}
              >
                <option value="">
                  {t("components.createEditBudgetDialog.anyMonth", "Any month")}
                </option>
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
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="specific-year">
                {t("components.createEditBudgetDialog.yearOptional", "Year (optional)")}
              </Label>
              <NativeSelect
                id="specific-year"
                value={formState.specificYear}
                onChange={(e) =>
                  updateFormState((prev) => ({ ...prev, specificYear: e.target.value }))
                }
                disabled={isSubmitting}
              >
                <option value="">
                  {t("components.createEditBudgetDialog.anyYear", "Any year")}
                </option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </>
        )}

        {/* Spending Limit */}
        <div className="space-y-2">
          <Label htmlFor="limit-amount">
            {t("components.createEditBudgetDialog.spendingLimit", "Spending Limit")}
          </Label>
          <Input
            id="limit-amount"
            type="number"
            step="0.01"
            value={formState.limitAmount}
            onChange={(e) => updateFormState((prev) => ({ ...prev, limitAmount: e.target.value }))}
            placeholder={t(
              "components.createEditBudgetDialog.limitPlaceholder",
              "Enter limit amount",
            )}
            disabled={isSubmitting}
          />
        </div>

        {/* Active Toggle — edit mode only */}
        {budget && (
          <div className="flex items-center gap-3">
            <Label htmlFor="active-toggle" className="cursor-pointer">
              {t("components.createEditBudgetDialog.active", "Active")}
            </Label>
            <button
              id="active-toggle"
              type="button"
              role="switch"
              aria-checked={formState.active}
              onClick={() => updateFormState((prev) => ({ ...prev, active: !prev.active }))}
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
                ? t("common.saving", "Saving…")
                : t("common.creating", "Creating…")
              : budget
                ? t("common.saveChanges", "Save Changes")
                : t("components.createEditBudgetDialog.createBtn", "Create Budget")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleDialogClose}
            disabled={isSubmitting}
          >
            {t("common.cancel", "Cancel")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function isGeneralType(type: string): type is "DAILY" | "MONTHLY" | "YEARLY" {
  return type === "DAILY" || type === "MONTHLY" || type === "YEARLY";
}
