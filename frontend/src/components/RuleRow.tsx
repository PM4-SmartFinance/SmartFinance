import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useRuleOverlap, type CategoryRule } from "../lib/queries/categories";
import { useTranslation } from "react-i18next";

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

  const { t } = useTranslation();

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
            aria-label={t("components.ruleRow.ariaPattern", "Rule pattern {{id}}", { id: rule.id })}
            className="md:flex-1"
            value={editor.pattern}
            onChange={(event) => setEditor({ ...editor, pattern: event.target.value })}
          />
          <NativeSelect
            aria-label={t("components.ruleRow.ariaMatchType", "Rule match type {{id}}", {
              id: rule.id,
            })}
            className="w-auto"
            value={editor.matchType}
            onChange={(event) =>
              setEditor({ ...editor, matchType: event.target.value as "exact" | "contains" })
            }
          >
            <option value="contains">
              {t("components.ruleRow.matchTypeContains", "contains")}
            </option>
            <option value="exact">{t("components.ruleRow.matchTypeExact", "exact")}</option>
          </NativeSelect>
          <Input
            aria-label={t("components.ruleRow.ariaPriority", "Rule priority {{id}}", {
              id: rule.id,
            })}
            title={t(
              "components.ruleRow.priorityTitle",
              "Higher priority rules are evaluated first",
            )}
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
              aria-label={t("components.ruleRow.ariaSave", "Save rule {{id}}", { id: rule.id })}
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
            >
              {t("common.save", "Save")}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditor(null)}>
              {t("common.cancel", "Cancel")}
            </Button>
          </div>
        </div>
        {overlapError && !conflicts.length && (
          <p
            role="alert"
            className="mt-2 text-xs text-muted-foreground"
            data-testid={`overlap-degraded-${rule.id}`}
          >
            {t("components.ruleRow.conflictUnavailable", "Conflict check unavailable.")}
          </p>
        )}
        {conflicts.length > 0 && (
          <div
            role="alert"
            className="mt-2 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400"
          >
            <p className="font-semibold">
              {t(
                "components.ruleRow.overlapWarning",
                "Pattern overlaps with {{count}} other rule.",
                { count: conflicts.length },
              )}
            </p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {conflicts.map((c) => (
                <li key={c.id}>
                  <span className="font-mono">"{c.pattern}"</span> ({c.matchType}) →{" "}
                  {c.categoryName}
                  <span className="text-muted-foreground">
                    {" "}
                    —{" "}
                    {t("components.ruleRow.priorityLabel", "priority {{priority}}", {
                      priority: c.priority,
                    })}
                  </span>
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
        </span>
        <span
          className="text-xs text-muted-foreground"
          title={t("components.ruleRow.priorityTitle", "Higher priority rules are evaluated first")}
        >
          {t("components.ruleRow.priorityDisplay", "Priority: {{priority}}", {
            priority: rule.priority,
          })}
        </span>
        <div className="flex gap-2">
          <Button
            aria-label={t("components.ruleRow.ariaEdit", "Edit rule {{id}}", { id: rule.id })}
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
            {t("common.edit", "Edit")}
          </Button>
          <Button
            aria-label={t("components.ruleRow.ariaDelete", "Delete rule {{id}}", { id: rule.id })}
            size="sm"
            variant="outline"
            onClick={onDelete}
            disabled={isDeleting}
          >
            {t("common.delete", "Delete")}
          </Button>
        </div>
      </div>
    </li>
  );
}
