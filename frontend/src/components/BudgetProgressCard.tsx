import type { Budget, CategorySpending } from "../lib/queries/budgets";
import { getBudgetTypeLabel, getMostSpecificActiveBudget } from "../lib/queries/budgets";
import { formatCurrency } from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";

interface BudgetCategoryGroupProps {
  categoryName: string;
  budgets: Budget[];
  categorySpending?: CategorySpending | undefined;
  onEdit: (budget: Budget) => void;
  onDelete: (budget: Budget) => void;
  deletingBudgetId?: string | undefined;
}

export function BudgetCategoryGroup({
  categoryName,
  budgets,
  categorySpending,
  onEdit,
  onDelete,
  deletingBudgetId,
}: BudgetCategoryGroupProps) {
  const activeBudget = getMostSpecificActiveBudget(budgets);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/30 pb-3">
        <CardTitle className="text-base font-semibold">{categoryName}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 p-4">
        {/* Period-based category summary */}
        {categorySpending ? (
          <PeriodSummary categorySpending={categorySpending} />
        ) : (
          activeBudget && <BudgetSummary budget={activeBudget} />
        )}

        {/* Individual budget rows — most specific first */}
        <div className="flex flex-col gap-2">
          {[...budgets]
            .sort((a, b) => b.priority - a.priority)
            .map((budget) => (
              <BudgetRow
                key={budget.id}
                budget={budget}
                onEdit={onEdit}
                onDelete={onDelete}
                isDeleting={budget.id === deletingBudgetId}
              />
            ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PeriodSummary({ categorySpending }: { categorySpending: CategorySpending }) {
  const spent = parseFloat(categorySpending.spending);
  const hasLimit = categorySpending.scaledLimit !== null;
  const limit = hasLimit ? parseFloat(categorySpending.scaledLimit!) : 0;
  const remaining = limit - spent;
  const percentageUsed = hasLimit && limit > 0 ? (spent / limit) * 100 : 0;
  const percentageDisplay = Math.min(percentageUsed, 100);
  const isOverBudget = hasLimit && spent > limit;

  const sourceLabel = categorySpending.sourceBudgetType
    ? `Based on ${categorySpending.sourceBudgetType.toLowerCase()} budget`
    : "No budget set";

  return (
    <div className="rounded-lg bg-muted/50 px-4 py-3" data-testid="category-summary">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-lg font-semibold tabular-nums">
          {formatCurrency(spent)}{" "}
          {hasLimit && (
            <span className="text-sm font-normal text-muted-foreground">
              of {formatCurrency(limit)}
            </span>
          )}
        </span>
        {hasLimit && (
          <span className={`text-sm font-semibold ${getTextColorClass(percentageUsed)}`}>
            {Math.round(percentageUsed)}%
          </span>
        )}
      </div>
      {hasLimit && (
        <div className="mb-1.5 h-2.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full transition-all duration-300 ${getProgressColorClass(percentageUsed)}`}
            style={{ width: `${percentageDisplay}%` }}
          />
        </div>
      )}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{sourceLabel}</span>
        {hasLimit ? (
          isOverBudget ? (
            <span className="font-semibold text-red-600">
              {formatCurrency(Math.abs(remaining))} over budget
            </span>
          ) : (
            <span>{formatCurrency(remaining)} remaining</span>
          )
        ) : (
          <span>{formatCurrency(spent)} spent</span>
        )}
      </div>
    </div>
  );
}

function BudgetSummary({ budget }: { budget: Budget }) {
  const spent = parseFloat(budget.currentSpending);
  const limit = parseFloat(budget.limitAmount);
  const remaining = parseFloat(budget.remainingAmount);
  const percentageDisplay = Math.min(budget.percentageUsed, 100);
  const typeLabel = getBudgetTypeLabel(budget.type, budget.month, budget.year);

  return (
    <div className="rounded-lg bg-muted/50 px-4 py-3" data-testid="category-summary">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-lg font-semibold tabular-nums">
          {formatCurrency(spent)}{" "}
          <span className="text-sm font-normal text-muted-foreground">
            of {formatCurrency(limit)}
          </span>
        </span>
        <span className={`text-sm font-semibold ${getTextColorClass(budget.percentageUsed)}`}>
          {Math.round(budget.percentageUsed)}%
        </span>
      </div>
      <div className="mb-1.5 h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full transition-all duration-300 ${getProgressColorClass(budget.percentageUsed)}`}
          style={{ width: `${percentageDisplay}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{typeLabel}</span>
        {budget.isOverBudget ? (
          <span className="font-semibold text-red-600">
            {formatCurrency(Math.abs(remaining))} over budget
          </span>
        ) : (
          <span>{formatCurrency(remaining)} remaining</span>
        )}
      </div>
    </div>
  );
}

function getProgressColorClass(percentageUsed: number) {
  if (percentageUsed > 100) return "bg-red-500";
  if (percentageUsed >= 80) return "bg-yellow-500";
  return "bg-blue-500";
}

function getTextColorClass(percentageUsed: number) {
  if (percentageUsed > 100) return "text-red-600";
  if (percentageUsed >= 80) return "text-yellow-600";
  return "text-blue-600";
}

interface BudgetRowProps {
  budget: Budget;
  onEdit: (budget: Budget) => void;
  onDelete: (budget: Budget) => void;
  isDeleting?: boolean;
}

function BudgetRow({ budget, onEdit, onDelete, isDeleting }: BudgetRowProps) {
  const typeLabel = getBudgetTypeLabel(budget.type, budget.month, budget.year);
  const percentageDisplay = Math.min(budget.percentageUsed, 100);
  const spent = parseFloat(budget.currentSpending);
  const limit = parseFloat(budget.limitAmount);
  const remaining = parseFloat(budget.remainingAmount);
  const isInactive = !budget.active;

  return (
    <div
      className={`rounded-lg border px-4 py-3 transition-colors ${
        isInactive
          ? "border-dashed border-muted-foreground/30 bg-muted/20 opacity-60"
          : "border-border"
      }`}
    >
      {/* Header: type + status + actions */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{typeLabel}</span>
          {isInactive && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Inactive
            </span>
          )}
        </div>
        <div className="flex gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => onEdit(budget)}
            aria-label={`Edit ${typeLabel}`}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-destructive hover:text-destructive"
            disabled={isDeleting}
            onClick={() => onDelete(budget)}
            aria-label={`Delete ${typeLabel}`}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full transition-all duration-300 ${getProgressColorClass(budget.percentageUsed)}`}
          style={{ width: `${percentageDisplay}%` }}
        />
      </div>

      {/* Spending info */}
      <div className="flex items-baseline justify-between text-xs">
        <span className="tabular-nums text-muted-foreground">
          <span className="font-medium text-foreground">{formatCurrency(spent)}</span> /{" "}
          {formatCurrency(limit)}
        </span>
        <span className={`font-medium ${getTextColorClass(budget.percentageUsed)}`}>
          {budget.isOverBudget ? (
            <>
              {Math.round(budget.percentageUsed)}% — {formatCurrency(Math.abs(remaining))} over
            </>
          ) : (
            <>
              {Math.round(budget.percentageUsed)}% — {formatCurrency(remaining)} left
            </>
          )}
        </span>
      </div>
    </div>
  );
}
