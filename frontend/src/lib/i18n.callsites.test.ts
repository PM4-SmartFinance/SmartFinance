import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, extname, join } from "node:path";
import en from "../../public/locales/en/translation.json";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = dirname(__dirname);

// Matches t("key.path", ...) and t(`key.path`, ...) — only static keys
// (anything containing ${ or interpolation is excluded by the character class).
const KEY_RE = /\bt\(\s*["`]([\w.-]+)["`]/g;

const SKIP_DIRS = new Set(["node_modules", "dist", "build", ".turbo", "wireframes"]);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith(".")) continue;
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...walk(full));
    } else {
      const ext = extname(entry);
      if (ext !== ".ts" && ext !== ".tsx") continue;
      if (entry.endsWith(".test.ts") || entry.endsWith(".test.tsx")) continue;
      out.push(full);
    }
  }
  return out;
}

function flattenKeys(obj: Record<string, unknown>, prefix = ""): Set<string> {
  const out = new Set<string>();
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object") {
      for (const child of flattenKeys(v as Record<string, unknown>, key)) out.add(child);
    } else {
      out.add(key);
    }
  }
  return out;
}

const enKeys = flattenKeys(en as Record<string, unknown>);

function keyExists(key: string): boolean {
  if (enKeys.has(key)) return true;
  // Plural callsites pass `count`; the JSON stores _one / _other.
  if (enKeys.has(`${key}_one`) || enKeys.has(`${key}_other`)) return true;
  return false;
}

describe("i18n callsite coverage", () => {
  it('every t("…") static key references a key that exists in en/translation.json', () => {
    const missing: string[] = [];
    let scanned = 0;
    for (const file of walk(SRC)) {
      scanned++;
      const content = readFileSync(file, "utf8");
      let match: RegExpExecArray | null;
      while ((match = KEY_RE.exec(content))) {
        const key = match[1];
        if (!key) continue;
        if (keyExists(key)) continue;
        missing.push(`${file.slice(SRC.length + 1)}: ${key}`);
      }
    }
    expect(missing).toEqual([]);
    // Fail loudly if the walker silently stops finding source files.
    expect(scanned).toBeGreaterThan(20);
  });

  // Dynamic callsites (template literals with ${…}) bypass the regex above.
  // Enumerate the known dynamic key spaces here so a renamed JSON key or a
  // new enum variant without a matching translation is caught at PR time.
  it("every budgets.periods.<key> referenced by BUDGET_PERIOD_KEY exists in en", () => {
    // Mirror of BUDGET_PERIOD_KEY in BudgetProgressCard.tsx — keep in sync.
    // Importing the component map would require pulling React into this test,
    // so we duplicate the value set instead.
    const periods = ["daily", "monthly", "yearly"] as const;
    for (const p of periods) {
      expect(enKeys.has(`budgets.periods.${p}`)).toBe(true);
    }
  });

  it("i18n.ts configures localStorage as a detection cache (persistence contract)", () => {
    // Locks in the cross-session language-persistence contract. The runtime
    // assertion is impractical because the test setup mocks i18n without
    // LanguageDetector, so write to localStorage never fires in unit tests.
    // Pin the config at the source level instead — removing the cache would
    // silently break persistence in production.
    const i18nSrc = readFileSync(join(SRC, "lib/i18n.ts"), "utf8");
    expect(i18nSrc).toMatch(/caches:\s*\[\s*["']localStorage["']\s*\]/);
    expect(i18nSrc).toMatch(/lookupLocalStorage:\s*["']i18nextLng["']/);
  });

  it("every spendingTrendChart.granularities.<key> referenced by Granularity exists in en", () => {
    // Mirror of `Granularity` in SpendingTrendChart.tsx — keep in sync.
    // The template literal `t(\`...granularities.${effectiveGranularity}\`)`
    // bypasses the static-key regex, so enumerate the enum here.
    // Pluralized via _one / _other suffixes.
    const granularities = ["auto", "day", "week", "month", "quarter", "year"] as const;
    for (const g of granularities) {
      expect(enKeys.has(`components.spendingTrendChart.granularities.${g}_one`)).toBe(true);
      expect(enKeys.has(`components.spendingTrendChart.granularities.${g}_other`)).toBe(true);
    }
  });
});
