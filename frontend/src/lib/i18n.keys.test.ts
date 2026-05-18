import { describe, it, expect } from "vitest";
import en from "../../public/locales/en/translation.json";
import de from "../../public/locales/de/translation.json";
import fr from "../../public/locales/fr/translation.json";
import itLoc from "../../public/locales/it/translation.json";
import rm from "../../public/locales/rm/translation.json";

type NestedRecord = Record<string, unknown>;

const getEntries = (obj: NestedRecord, prefix = ""): [string, string][] => {
  return Object.entries(obj).reduce((acc: [string, string][], [key, value]) => {
    const newPrefix = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null) {
      return [...acc, ...getEntries(value as NestedRecord, newPrefix)];
    }
    if (typeof value === "string") {
      return [...acc, [newPrefix, value]];
    }
    return acc;
  }, []);
};

const PLACEHOLDER_RE = /\{\{(\w+)\}\}/g;

function extractPlaceholders(value: string): Set<string> {
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = PLACEHOLDER_RE.exec(value))) {
    if (m[1]) out.add(m[1]);
  }
  return out;
}

describe("i18n Key Consistency", () => {
  const baseEntries = getEntries(en);
  const baseKeys = baseEntries.map(([k]) => k).sort((a, b) => a.localeCompare(b));
  const basePlaceholders = new Map(
    baseEntries.map(([k, v]) => [k, extractPlaceholders(v)] as const),
  );

  const locales = [
    { name: "German (de)", data: de },
    { name: "French (fr)", data: fr },
    { name: "Italian (it)", data: itLoc },
    { name: "Romansh (rm)", data: rm },
  ];

  it.each(locales)("$name should have the exact same keys as English", ({ data }) => {
    const targetKeys = getEntries(data)
      .map(([k]) => k)
      .sort((a, b) => a.localeCompare(b));
    expect(targetKeys).toEqual(baseKeys);
  });

  it.each(locales)(
    "$name should preserve every {{placeholder}} present in the English value",
    ({ data, name }) => {
      const drift: string[] = [];
      for (const [key, value] of getEntries(data)) {
        const expected = basePlaceholders.get(key);
        if (!expected) continue;
        const got = extractPlaceholders(value);
        for (const ph of expected) {
          if (!got.has(ph)) drift.push(`${name}: ${key} missing {{${ph}}}`);
        }
      }
      expect(drift).toEqual([]);
    },
  );

  it.each(locales)("$name should not contain empty string values", ({ data, name }) => {
    const empty: string[] = [];
    for (const [key, value] of getEntries(data)) {
      if (value === "") empty.push(`${name}: ${key}`);
    }
    expect(empty).toEqual([]);
  });
});
