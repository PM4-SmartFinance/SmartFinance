import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { validateRegex, testRegex } from "../lib/regex";

/**
 * Inline regex authoring helper: live validation, syntax caption, and a
 * test-against-merchant-name field. Rendered below the pattern input
 * whenever `matchType === "regex"`.
 */
export function RegexHelper({ pattern, idSuffix }: { pattern: string; idSuffix: string }) {
  const { t } = useTranslation();
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

  const slowMessage = t(
    "components.regexHelper.slowMessage",
    "Pattern may cause catastrophic backtracking",
  );
  const validityText = (() => {
    if (pattern.length === 0) {
      return t("components.regexHelper.validityTypePrompt", "Type a pattern to validate.");
    }
    if (validation.level === "valid") {
      return t("components.regexHelper.validityValid", "Valid pattern.");
    }
    if (validation.level === "slow") {
      return t("components.regexHelper.validitySlow", "Warning: {{message}}", {
        message: slowMessage,
      });
    }
    return t("components.regexHelper.validityInvalid", "Invalid: {{message}}", {
      message: validation.message ?? "",
    });
  })();

  const testInputId = `regex-test-${idSuffix}`;

  return (
    <div
      className="mt-2 rounded border border-muted bg-muted/30 px-3 py-2 text-xs"
      data-testid={`regex-helper-${idSuffix}`}
    >
      <p className="text-muted-foreground">
        {t("components.regexHelper.captionPrefix", "Case-insensitive.")}{" "}
        <code className="font-mono">.*</code> {t("components.regexHelper.captionAny", "any chars")}{" "}
        · <code className="font-mono">^</code>/<code className="font-mono">$</code>{" "}
        {t("components.regexHelper.captionAnchors", "anchors")} ·{" "}
        <code className="font-mono">|</code>{" "}
        {t("components.regexHelper.captionEither", "either/or")} ·{" "}
        <code className="font-mono">[abc]</code>{" "}
        {t("components.regexHelper.captionCharClass", "char class")}.{" "}
        {t("components.regexHelper.captionMaxChars", "Max 256 chars.")}
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
          {t("components.regexHelper.testAgainstLabel", "Test against:")}
        </Label>
        <Input
          id={testInputId}
          className="h-7 flex-1 text-xs"
          placeholder={t("components.regexHelper.testPlaceholder", "e.g. Migros Online")}
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
            <span className="font-semibold text-emerald-700 dark:text-emerald-400">
              {t("components.regexHelper.testMatches", "✓ matches")}
            </span>
          )}
          {testResult === false && (
            <span className="font-semibold text-destructive">
              {t("components.regexHelper.testNoMatch", "✗ no match")}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
