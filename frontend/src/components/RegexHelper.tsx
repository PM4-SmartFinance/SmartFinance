import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { validateRegex, testRegex } from "../lib/regex";

/**
 * Inline regex authoring helper: live validation, syntax caption, and a
 * test-against-merchant-name field. Rendered below the pattern input
 * whenever `matchType === "regex"`.
 */
export function RegexHelper({ pattern, idSuffix }: { pattern: string; idSuffix: string }) {
  const [sample, setSample] = useState("");
  const validation = useMemo(() => validateRegex(pattern), [pattern]);
  const testResult = useMemo(
    () => (validation.ok ? testRegex(pattern, sample) : null),
    [pattern, sample, validation.ok],
  );

  const validityClass =
    validation.level === "invalid"
      ? "text-destructive"
      : validation.level === "slow"
        ? "text-amber-700 dark:text-amber-400"
        : "text-emerald-700 dark:text-emerald-400";

  const validityText = (() => {
    if (pattern.length === 0) return "Type a pattern to validate.";
    if (validation.level === "valid") return "Valid pattern.";
    if (validation.level === "slow") return `Warning: ${validation.message}`;
    return `Invalid: ${validation.message}`;
  })();

  const testInputId = `regex-test-${idSuffix}`;

  return (
    <div
      className="mt-2 rounded border border-muted bg-muted/30 px-3 py-2 text-xs"
      data-testid={`regex-helper-${idSuffix}`}
    >
      <p className="text-muted-foreground">
        Case-insensitive. <code className="font-mono">.*</code> any chars ·{" "}
        <code className="font-mono">^</code>/<code className="font-mono">$</code> anchors ·{" "}
        <code className="font-mono">|</code> either/or · <code className="font-mono">[abc]</code>{" "}
        char class. Max 256 chars.
      </p>
      <p
        className={`mt-1 font-medium ${validityClass}`}
        data-testid={`regex-validity-${idSuffix}`}
        role="status"
      >
        {validityText}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <Label htmlFor={testInputId} className="text-muted-foreground">
          Test against:
        </Label>
        <Input
          id={testInputId}
          className="h-7 flex-1 text-xs"
          placeholder="e.g. Migros Online"
          value={sample}
          onChange={(event) => setSample(event.target.value)}
        />
        <span
          className="min-w-[7ch] text-right"
          data-testid={`regex-test-result-${idSuffix}`}
          aria-live="polite"
        >
          {testResult === null && <span className="text-muted-foreground">—</span>}
          {testResult === true && (
            <span className="font-semibold text-emerald-700 dark:text-emerald-400">✓ matches</span>
          )}
          {testResult === false && (
            <span className="font-semibold text-destructive">✗ no match</span>
          )}
        </span>
      </div>
    </div>
  );
}
