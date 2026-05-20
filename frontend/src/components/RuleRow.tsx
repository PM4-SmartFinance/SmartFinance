import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useRuleOverlap, type CategoryRule } from "../lib/queries/categories";
import { RegexHelper } from "./RegexHelper";

interface RuleEditorState {
  pattern: string;
  matchType: "exact" | "contains" | "regex";
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
  onSave: (draft: RuleEditorState) => Promise<boolean>;
  onDelete: () => void;
  isSaving: boolean;
  isDeleting: boolean;
}) {
  const [editor, setEditor] = useState<RuleEditorState | null>(null);

  // Hooks must run unconditionally; pass empty pattern when not editing so
  // the query stays disabled.
  const { data: conflicts = [], error: overlapError } = useRuleOverlap(
    editor?.pattern ?? "",
    editor?.matchType ?? "contains",
    rule.id,
  );

  async function handleSave() {
    if (!editor) return;
    const ok = await onSave(editor);
    if (ok) setEditor(null);
  }

  if (editor) {
    return (
      <li className="rounded border p-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Input
            aria-label={`Rule pattern ${rule.id}`}
            className="md:flex-1"
            placeholder={editor.matchType === "regex" ? "e.g. Migros.*Online" : undefined}
            maxLength={256}
            value={editor.pattern}
            onChange={(event) => setEditor({ ...editor, pattern: event.target.value })}
          />
          <NativeSelect
            aria-label={`Rule match type ${rule.id}`}
            className="w-auto"
            value={editor.matchType}
            onChange={(event) =>
              setEditor({
                ...editor,
                matchType: event.target.value as "exact" | "contains" | "regex",
              })
            }
          >
            <option value="contains">contains</option>
            <option value="exact">exact</option>
            <option value="regex">regex</option>
          </NativeSelect>
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
              onClick={handleSave}
              disabled={isSaving}
            >
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditor(null)}>
              Cancel
            </Button>
          </div>
        </div>
        {editor.matchType === "regex" && (
          <>
            <RegexHelper pattern={editor.pattern} idSuffix={rule.id} />
            <p
              className="mt-2 text-xs text-muted-foreground"
              data-testid={`overlap-skipped-regex-${rule.id}`}
            >
              Overlap detection isn't available for regex rules.
            </p>
          </>
        )}
        {editor.matchType !== "regex" && overlapError && !conflicts.length && (
          <p
            role="alert"
            className="mt-2 text-xs text-muted-foreground"
            data-testid={`overlap-degraded-${rule.id}`}
          >
            Conflict check unavailable.
          </p>
        )}
        {conflicts.length > 0 && (
          <div
            role="alert"
            className="mt-2 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400"
          >
            <p className="font-semibold">
              Pattern overlaps with {conflicts.length} other rule{conflicts.length === 1 ? "" : "s"}
              .
            </p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {conflicts.map((c) => (
                <li key={c.id}>
                  <span className="font-mono">"{c.pattern}"</span> ({c.matchType}) →{" "}
                  {c.categoryName}
                  <span className="text-muted-foreground"> — priority {c.priority}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </li>
    );
  }

  return (
    <li className="rounded border p-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <span className="text-sm md:flex-1">
          <span className="font-medium">{rule.pattern}</span>
          <span className="ml-2 text-muted-foreground">({rule.matchType})</span>
          {rule.isValid === false && (
            <span
              className="ml-2 rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-destructive"
              data-testid={`invalid-rule-badge-${rule.id}`}
              role="alert"
            >
              Invalid regex — fix the pattern
            </span>
          )}
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
