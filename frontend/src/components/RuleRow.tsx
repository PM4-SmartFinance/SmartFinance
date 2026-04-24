import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CategoryRule } from "../lib/queries/categories";

interface RuleEditorState {
  pattern: string;
  matchType: "exact" | "contains";
  priority: number;
}

export function RuleRow({
  rule,
  onSave,
  onDelete,
  isSaving,
  isDeleting,
}: {
  rule: CategoryRule;
  onSave: (draft: RuleEditorState) => void;
  onDelete: () => void;
  isSaving: boolean;
  isDeleting: boolean;
}) {
  const [editor, setEditor] = useState<RuleEditorState | null>(null);

  if (editor) {
    return (
      <li className="rounded border p-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Input
            aria-label={`Rule pattern ${rule.id}`}
            className="md:flex-1"
            value={editor.pattern}
            onChange={(event) => setEditor({ ...editor, pattern: event.target.value })}
          />
          <select
            aria-label={`Rule match type ${rule.id}`}
            className="rounded border border-input bg-background px-3 py-2 text-sm"
            value={editor.matchType}
            onChange={(event) =>
              setEditor({ ...editor, matchType: event.target.value as "exact" | "contains" })
            }
          >
            <option value="contains">contains</option>
            <option value="exact">exact</option>
          </select>
          <Input
            aria-label={`Rule priority ${rule.id}`}
            title="Higher priority rules are evaluated first"
            type="number"
            min={0}
            max={1000}
            className="w-20"
            value={editor.priority}
            onChange={(event) =>
              setEditor({ ...editor, priority: Number(event.target.value || 0) })
            }
          />
          <div className="flex gap-2">
            <Button
              aria-label={`Save rule ${rule.id}`}
              size="sm"
              onClick={() => onSave(editor)}
              disabled={isSaving}
            >
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditor(null)}>
              Cancel
            </Button>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li className="rounded border p-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <span className="text-sm md:flex-1">
          <span className="font-medium">{rule.pattern}</span>
          <span className="ml-2 text-muted-foreground">({rule.matchType})</span>
        </span>
        <span
          className="text-xs text-muted-foreground"
          title="Higher priority rules are evaluated first"
        >
          Priority: {rule.priority}
        </span>
        <div className="flex gap-2">
          <Button
            aria-label={`Edit rule ${rule.id}`}
            size="sm"
            variant="outline"
            onClick={() =>
              setEditor({
                pattern: rule.pattern,
                matchType: rule.matchType,
                priority: rule.priority,
              })
            }
          >
            Edit
          </Button>
          <Button
            aria-label={`Delete rule ${rule.id}`}
            size="sm"
            variant="outline"
            onClick={onDelete}
            disabled={isDeleting}
          >
            Delete
          </Button>
        </div>
      </div>
    </li>
  );
}
