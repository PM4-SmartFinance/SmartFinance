import type { ImporterPlugin } from "../types/module.js";

const importers = new Map<string, ImporterPlugin>();

export function registerImporter(plugin: ImporterPlugin): void {
  if (importers.has(plugin.format)) {
    throw new Error(`Importer format "${plugin.format}" is already registered`);
  }
  importers.set(plugin.format, plugin);
}

export function getImporter(format: string): ImporterPlugin | undefined {
  return importers.get(format);
}

export function getAllPluginFormats(): Array<{ format: string; label: string }> {
  return [...importers.values()].map(({ format, label }) => ({ format, label }));
}

export function clearImporterRegistry(): void {
  importers.clear();
}
