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
    for (const file of walk(SRC)) {
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
  });
});
