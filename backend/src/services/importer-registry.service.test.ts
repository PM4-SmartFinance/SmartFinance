import { describe, it, expect, beforeEach } from "vitest";
import {
  registerImporter,
  getImporter,
  getAllPluginFormats,
  clearImporterRegistry,
} from "./importer-registry.service.js";
import type { ImporterPlugin } from "../types/module.js";

function makePlugin(format: string, label = "Test"): ImporterPlugin {
  return { format, label, encoding: "utf-8", parse: () => [] };
}

beforeEach(() => {
  clearImporterRegistry();
});

describe("registerImporter", () => {
  it("registers a plugin and makes it retrievable", () => {
    registerImporter(makePlugin("test-bank"));
    expect(getImporter("test-bank")).toBeDefined();
  });

  it("throws when the same format is registered twice", () => {
    registerImporter(makePlugin("test-bank"));
    expect(() => registerImporter(makePlugin("test-bank"))).toThrow(
      'Importer format "test-bank" is already registered',
    );
  });

  it("allows multiple distinct formats", () => {
    registerImporter(makePlugin("bank-a"));
    registerImporter(makePlugin("bank-b"));
    expect(getImporter("bank-a")).toBeDefined();
    expect(getImporter("bank-b")).toBeDefined();
  });
});

describe("getImporter", () => {
  it("returns undefined for an unregistered format", () => {
    expect(getImporter("nonexistent")).toBeUndefined();
  });

  it("returns the correct plugin", () => {
    const plugin = makePlugin("alpha");
    registerImporter(plugin);
    expect(getImporter("alpha")).toBe(plugin);
  });
});

describe("getAllPluginFormats", () => {
  it("returns an empty array when no plugins are registered", () => {
    expect(getAllPluginFormats()).toEqual([]);
  });

  it("returns all registered plugin formats with their labels", () => {
    registerImporter(makePlugin("bank-a", "Bank A"));
    registerImporter(makePlugin("bank-b", "Bank B"));
    expect(getAllPluginFormats()).toEqual(
      expect.arrayContaining([
        { format: "bank-a", label: "Bank A" },
        { format: "bank-b", label: "Bank B" },
      ]),
    );
  });
});

describe("clearImporterRegistry", () => {
  it("removes all registered importers", () => {
    registerImporter(makePlugin("x"));
    clearImporterRegistry();
    expect(getImporter("x")).toBeUndefined();
    expect(getAllPluginFormats()).toEqual([]);
  });
});
