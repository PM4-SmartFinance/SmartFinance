import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import type { Transaction } from "@/lib/queries/transactions";
import type { Category } from "@/lib/queries/categories";

interface EditTransactionDialogProps {
  isOpen: boolean;
  transaction: Transaction | null;
  categories: Category[];
  isUpdating: boolean;
  error: string | null;
  onSave: (data: {
    id: string;
    date: string;
    amount: number;
    categoryId: string;
    notes: string;
    reason: string;
  }) => void;
  onClose: () => void;
}

export function EditTransactionDialog({
  isOpen,
  transaction,
  categories,
  isUpdating,
  error,
  onSave,
  onClose,
}: EditTransactionDialogProps) {
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");

  const [prevTxId, setPrevTxId] = useState<string | null>(null);

  if (transaction && transaction.id !== prevTxId) {
    setPrevTxId(transaction.id);
    setDate(transaction.date);
    setAmount(transaction.amount);
    setCategoryId(transaction.categoryId || "");
    setNotes("");
    setReason("");
  } else if (!transaction && prevTxId !== null) {
    setPrevTxId(null);
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!transaction) return;

    onSave({
      id: transaction.id,
      date,
      amount: parseFloat(amount),
      categoryId,
      notes,
      reason,
    });
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} size="md">
      <h2 className="mb-4 text-xl font-semibold text-foreground">Edit Transaction</h2>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="edit-date">Date</Label>
            <Input
              id="edit-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              disabled={isUpdating}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-amount">Amount</Label>
            <Input
              id="edit-amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              disabled={isUpdating}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-category">Category</Label>
          <NativeSelect
            id="edit-category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            disabled={isUpdating}
          >
            <option value="">No Category</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.categoryName}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-notes">Notes</Label>
          <textarea
            id="edit-notes"
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Add some notes..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={isUpdating}
          />
        </div>

        <div className="border-t border-border pt-4">
          <div className="space-y-2">
            <Label htmlFor="edit-reason">Reason for Change (Audit Log)</Label>
            <Input
              id="edit-reason"
              placeholder="e.g., Corrected date"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isUpdating}
            />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="submit" disabled={isUpdating} className="flex-1">
            {isUpdating ? "Saving..." : "Save Changes"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isUpdating}
            onClick={onClose}
            className="flex-1"
          >
            Cancel
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
