import { useDeferredValue, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useRuleOverlap } from "../lib/queries/categories";
import { useDebouncedCallback } from "../hooks/useDebouncedCallback";
import { RegexHelper } from "./RegexHelper";

interface RuleEditorState {
  pattern: string;
  matchType: "exact" | "contains" | "regex";
  priority: number;
}

interface PreviewData {
  summary: string;
  lines: string[];
}

export function NewRuleForm({
  categoryName,
  preview,
  onSubmit,
  onPreview,
  isSubmitting,
}: {
  categoryName: string;
  preview: PreviewData | null;
  onSubmit: (draft: RuleEditorState) => Promise<boolean>;
  onPreview: (draft: RuleEditorState) => void;
  isSubmitting: boolean;
}) {
  const [draft, setDraft] = useState<RuleEditorState>({
    pattern: "",
    matchType: "contains",
    priority: 0,
  });

  const debouncedPreview = useDebouncedCallback(onPreview, 300);
  useEffect(() => {
    debouncedPreview(draft);
  }, [draft, debouncedPreview]);

  // Soft warning. `useDeferredValue` lets React skip overlap queries while
  // the user is typing fast — paired with TanStack's request dedupe and a 5 s
  // staleTime, the network call effectively fires once per settled (pattern,
  // matchType) tuple.
  const deferredPattern = useDeferredValue(draft.pattern);
  const { data: conflicts = [], error: overlapError } = useRuleOverlap(
    deferredPattern,
    draft.matchType,
  );

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
          placeholder={draft.matchType === "regex" ? "e.g. Migros.*Online" : "Pattern"}
          maxLength={256}
          value={draft.pattern}
          onChange={(event) => setDraft({ ...draft, pattern: event.target.value })}
        />
        <NativeSelect
          aria-label={`New rule match type for ${categoryName}`}
          className="w-auto"
          value={draft.matchType}
          onChange={(event) =>
            setDraft({ ...draft, matchType: event.target.value as "exact" | "contains" | "regex" })
          }
        >
          <option value="contains">contains</option>
          <option value="exact">exact</option>
          <option value="regex">regex</option>
        </NativeSelect>
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
        <Button size="sm" onClick={handleSubmit} disabled={isSubmitting}>
          Add Rule
        </Button>
      </div>
      {draft.matchType === "regex" && (
        <>
          <RegexHelper pattern={draft.pattern} idSuffix="new" />
          <p className="mt-2 text-xs text-muted-foreground" data-testid="overlap-skipped-regex-new">
            Overlap detection isn't available for regex rules.
          </p>
        </>
      )}
      {draft.matchType !== "regex" && overlapError && conflicts.length === 0 && (
        <p
          role="alert"
          className="mt-2 text-xs text-muted-foreground"
          data-testid="overlap-degraded-new"
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
            Pattern overlaps with {conflicts.length} existing rule
            {conflicts.length === 1 ? "" : "s"}.
          </p>
          <p className="mt-1 text-[11px]">
            Higher-priority rules win when both match. You can save anyway.
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {conflicts.map((c) => (
              <li key={c.id}>
                <span className="font-mono">"{c.pattern}"</span> ({c.matchType}) → {c.categoryName}
                <span className="text-muted-foreground"> — priority {c.priority}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {preview && (
        <div className="mt-2">
          <p className="text-xs text-muted-foreground">{preview.summary}</p>
          {preview.lines.length > 0 && (
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
              {preview.lines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
