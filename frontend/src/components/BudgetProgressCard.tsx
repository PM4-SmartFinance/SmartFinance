import type { Budget } from "../lib/queries/budgets";
import { getBudgetTypeLabel, getMostSpecificActiveBudget } from "../lib/queries/budgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface BudgetCategoryGroupProps {
  categoryName: string;
  budgets: Budget[];
  onEdit: (budget: Budget) => void;
  onDelete: (budget: Budget) => void;
  deletingBudgetId?: string | undefined;
}

export function BudgetCategoryGroup({
  categoryName,
  budgets,
  onEdit,
  onDelete,
  deletingBudgetId,
}: BudgetCategoryGroupProps) {
  const activeBudget = getMostSpecificActiveBudget(budgets);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{categoryName}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Summary bar for most specific active budget */}
        {activeBudget && <CategorySummary budget={activeBudget} />}

        {/* Individual budget rows — most specific first */}
        <div className="flex flex-col gap-3">
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

function CategorySummary({ budget }: { budget: Budget }) {
  const spent = parseFloat(budget.currentSpending);
  const limit = parseFloat(budget.limitAmount);
  const remaining = parseFloat(budget.remainingAmount);
  const percentageDisplay = Math.min(budget.percentageUsed, 100);
  const typeLabel = getBudgetTypeLabel(budget.type, budget.month, budget.year);

  return (
    <div className="rounded-lg bg-muted/50 px-4 py-3" data-testid="category-summary">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-lg font-semibold">
          ${spent.toFixed(2)}{" "}
          <span className="text-sm font-normal text-muted-foreground">of ${limit.toFixed(2)}</span>
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
            ${Math.abs(remaining).toFixed(2)} over budget
          </span>
        ) : (
          <span>${remaining.toFixed(2)} remaining</span>
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

  return (
    <div className="rounded-lg border border-border px-4 py-3">
      {/* Header: type + actions */}
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium">{typeLabel}</span>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => onEdit(budget)}
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-destructive hover:text-destructive"
            disabled={isDeleting}
            onClick={() => onDelete(budget)}
          >
            {isDeleting ? "…" : "Delete"}
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full transition-all duration-300 ${getProgressColorClass(budget.percentageUsed)}`}
          style={{ width: `${percentageDisplay}%` }}
        />
      </div>

      {/* Spending info */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-muted-foreground">Spent</p>
          <p className="font-semibold">${spent.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Limit</p>
          <p className="font-semibold">${limit.toFixed(2)}</p>
        </div>
        <div>
          <p className={`font-semibold ${getTextColorClass(budget.percentageUsed)}`}>
            {Math.round(budget.percentageUsed)}%
          </p>
          {budget.isOverBudget ? (
            <p className="font-semibold text-red-600">Over</p>
          ) : (
            <p className="text-muted-foreground">${remaining.toFixed(2)} left</p>
          )}
        </div>
      </div>
    </div>
  );
}
