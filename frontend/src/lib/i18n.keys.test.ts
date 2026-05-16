import { describe, it, expect } from "vitest";
import en from "../../public/locales/en/translation.json";
import de from "../../public/locales/de/translation.json";
import fr from "../../public/locales/fr/translation.json";
import itLoc from "../../public/locales/it/translation.json";
import rm from "../../public/locales/rm/translation.json";

type NestedRecord = Record<string, unknown>;

const getKeys = (obj: NestedRecord, prefix = ""): string[] => {
  return Object.keys(obj).reduce((acc: string[], key: string) => {
    const value = obj[key];
    const newPrefix = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null) {
      return [...acc, ...getKeys(value as NestedRecord, newPrefix)];
    }
    return [...acc, newPrefix];
  }, []);
};

describe("i18n Key Consistency", () => {
  const baseKeys = getKeys(en).sort((a, b) => a.localeCompare(b));

  const locales = [
    { name: "German (de)", data: de },
    { name: "French (fr)", data: fr },
    { name: "Italian (it)", data: itLoc },
    { name: "Romansh (rm)", data: rm },
  ];

  it.each(locales)("$name should have the exact same keys as English", ({ data }) => {
    const targetKeys = getKeys(data).sort((a, b) => a.localeCompare(b));
    expect(targetKeys).toEqual(baseKeys);
  });
});
