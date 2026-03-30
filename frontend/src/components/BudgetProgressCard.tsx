import { Budget } from "../lib/queries/budgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface BudgetProgressCardProps {
  budget: Budget;
  categoryName: string;
  onEdit: (budget: Budget) => void;
  onDelete: (budget: Budget) => void;
  isDeleting?: boolean;
}

export function BudgetProgressCard({
  budget,
  categoryName,
  onEdit,
  onDelete,
  isDeleting,
}: BudgetProgressCardProps) {
  // Determine progress bar color based on percentage used
  const getColorClass = (percentageUsed: number) => {
    if (percentageUsed > 100) {
      // Red alert state when exceeded
      return "bg-red-500";
    }
    if (percentageUsed >= 80) {
      // Yellow/Orange warning state at 80%
      return "bg-yellow-500";
    }
    // Blue normal state
    return "bg-blue-500";
  };

  const getTextColorClass = (percentageUsed: number) => {
    if (percentageUsed > 100) {
      return "text-red-600";
    }
    if (percentageUsed >= 80) {
      return "text-yellow-600";
    }
    return "text-blue-600";
  };

  const percentageDisplay = Math.min(budget.percentageUsed, 100);
  const monthYear = new Date(budget.year, budget.month - 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-base">{categoryName}</CardTitle>
            <p className="text-xs text-muted-foreground">{monthYear}</p>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => onEdit(budget)}>
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              disabled={isDeleting}
              onClick={() => onDelete(budget)}
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {/* Progress Bar */}
        <div className="flex flex-col gap-2">
          <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full transition-all duration-300 ${getColorClass(budget.percentageUsed)}`}
              style={{ width: `${percentageDisplay}%` }}
            />
          </div>
        </div>

        {/* Spending Info */}
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Spent</p>
            <p className="font-semibold">${parseFloat(budget.currentSpending).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Limit</p>
            <p className="font-semibold">${parseFloat(budget.limitAmount).toFixed(2)}</p>
          </div>
          <div>
            <p className={`text-xs font-semibold ${getTextColorClass(budget.percentageUsed)}`}>
              {Math.round(budget.percentageUsed)}%
            </p>
            {budget.isOverBudget && (
              <p className="text-xs font-semibold text-red-600">Over Budget</p>
            )}
            {!budget.isOverBudget && (
              <p className="text-xs text-muted-foreground">
                ${parseFloat(budget.remainingAmount).toFixed(2)} left
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
