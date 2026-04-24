import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface RuleEditorState {
  pattern: string;
  matchType: "exact" | "contains";
  priority: number;
}

export function NewRuleForm({
  categoryName,
  preview,
  onSubmit,
  onPreview,
  isSubmitting,
  isPreviewing,
}: {
  categoryName: string;
  preview: string;
  onSubmit: (draft: RuleEditorState) => Promise<boolean>;
  onPreview: (draft: RuleEditorState) => void;
  isSubmitting: boolean;
  isPreviewing: boolean;
}) {
  const [draft, setDraft] = useState<RuleEditorState>({
    pattern: "",
    matchType: "contains",
    priority: 0,
  });

  async function handleSubmit() {
    const success = await onSubmit(draft);
    if (success) {
      setDraft({ pattern: "", matchType: "contains", priority: 0 });
    }
  }

  return (
    <div className="rounded border p-3">
      <h4 className="mb-2 text-sm font-semibold">New Rule</h4>
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <Input
          aria-label={`New rule pattern for ${categoryName}`}
          className="md:flex-1"
          placeholder="Pattern"
          value={draft.pattern}
          onChange={(event) => setDraft({ ...draft, pattern: event.target.value })}
        />
        <select
          aria-label={`New rule match type for ${categoryName}`}
          className="rounded border border-input bg-background px-3 py-2 text-sm"
          value={draft.matchType}
          onChange={(event) =>
            setDraft({ ...draft, matchType: event.target.value as "exact" | "contains" })
          }
        >
          <option value="contains">contains</option>
          <option value="exact">exact</option>
        </select>
        <Input
          aria-label={`New rule priority for ${categoryName}`}
          title="Higher priority rules are evaluated first"
          type="number"
          min={0}
          max={1000}
          className="w-20"
          placeholder="0"
          value={draft.priority}
          onChange={(event) => setDraft({ ...draft, priority: Number(event.target.value || 0) })}
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSubmit} disabled={isSubmitting}>
            Add Rule
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onPreview(draft)}
            disabled={isPreviewing}
          >
            Match Preview
          </Button>
        </div>
      </div>
      {preview && <p className="mt-2 text-xs text-muted-foreground">{preview}</p>}
    </div>
  );
}
