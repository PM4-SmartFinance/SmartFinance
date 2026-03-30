import { useState } from "react";
import { useUpdateBudget, Budget } from "../lib/queries/budgets";
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
  const updateMutation = useUpdateBudget();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!limitAmount || parseFloat(limitAmount) <= 0) {
      alert("Please enter a valid limit amount");
      return;
    }

    if (budget) {
      // Edit mode
      await updateMutation.mutateAsync({
        id: budget.id,
        input: { limitAmount: parseFloat(limitAmount) },
      });
    } else {
      // Create mode - TODO: implement when we have category and month/year selection
      alert("Create mode not yet implemented");
      return;
    }

    onClose();
  };

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>{budget ? "Edit Budget" : "Create Budget"}</CardTitle>
            </CardHeader>

            <form onSubmit={handleSubmit}>
              <CardContent className="flex flex-col gap-4">
                {budget ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="limit-amount">Spending Limit</Label>
                      <Input
                        id="limit-amount"
                        type="number"
                        step="0.01"
                        value={limitAmount}
                        onChange={(e) => setLimitAmount(e.target.value)}
                        placeholder="Enter limit amount"
                        disabled={updateMutation.isPending}
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button type="submit" disabled={updateMutation.isPending} className="flex-1">
                        {updateMutation.isPending ? "Saving…" : "Save Changes"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                        disabled={updateMutation.isPending}
                      >
                        Cancel
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Create functionality coming soon</p>
                )}
              </CardContent>
            </form>
          </Card>
        </div>
      )}
    </>
  );
}
