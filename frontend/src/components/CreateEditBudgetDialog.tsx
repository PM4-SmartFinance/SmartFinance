import { useState } from "react";
import { useCreateBudget, useUpdateBudget, Budget } from "../lib/queries/budgets";
import { useCategories } from "../lib/queries/categories";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CreateEditBudgetDialogProps {
  isOpen: boolean;
  budget: Budget | null;
  onClose: () => void;
}

export function CreateEditBudgetDialog({ isOpen, budget, onClose }: CreateEditBudgetDialogProps) {
  const [limitAmount, setLimitAmount] = useState(budget?.limitAmount || "");
  const [categoryId, setCategoryId] = useState(budget?.categoryId || "");
  const [month, setMonth] = useState(budget?.month.toString() || "");
  const [year, setYear] = useState(budget?.year.toString() || "");
  const [error, setError] = useState("");

  const createMutation = useCreateBudget();
  const updateMutation = useUpdateBudget();
  const { data: categories = [], isLoading: categoriesLoading } = useCategories();

  if (!isOpen) return null;

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!limitAmount || parseFloat(limitAmount) <= 0) {
      setError("Please enter a valid limit amount");
      return;
    }

    if (budget) {
      // Edit mode
      try {
        await updateMutation.mutateAsync({
          id: budget.id,
          input: { limitAmount: parseFloat(limitAmount) },
        });
        onClose();
      } catch {
        setError("Failed to update budget");
      }
    } else {
      // Create mode
      if (!categoryId) {
        setError("Please select a category");
        return;
      }
      if (!month) {
        setError("Please select a month");
        return;
      }
      if (!year) {
        setError("Please select a year");
        return;
      }

      try {
        await createMutation.mutateAsync({
          categoryId,
          month: parseInt(month),
          year: parseInt(year),
          limitAmount: parseFloat(limitAmount),
        });
        onClose();
      } catch {
        setError("Failed to create budget");
      }
    }
  };

  const isSubmitting = budget ? updateMutation.isPending : createMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{budget ? "Edit Budget" : "Create Budget"}</CardTitle>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="flex flex-col gap-4">
            {error && <div className="rounded bg-red-50 p-2 text-sm text-red-600">{error}</div>}

            {!budget && (
              <>
                {/* Category Select */}
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <select
                    id="category"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    disabled={isSubmitting || categoriesLoading}
                    className="w-full rounded border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Select a category…</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Month Select */}
                <div className="space-y-2">
                  <Label htmlFor="month">Month</Label>
                  <select
                    id="month"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full rounded border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Select a month…</option>
                    {months.map((m) => {
                      const monthName = new Date(2026, m - 1).toLocaleDateString("en-US", {
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
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
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
                value={limitAmount}
                onChange={(e) => setLimitAmount(e.target.value)}
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
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
