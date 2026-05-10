import { describe, it, expect, beforeEach, vi } from "vitest";
import { setMatchMedia, resetMatchMedia } from "../test/setup";

const SYSTEM_QUERY = "(prefers-color-scheme: dark)";

describe("appStore theme logic", () => {
  beforeEach(() => {
    document.documentElement.classList.remove("dark");
    localStorage.clear();
    resetMatchMedia();
    vi.resetModules();
  });

  describe("getStoredTheme", () => {
    it("returns 'system' when localStorage is empty", async () => {
      const { getStoredTheme } = await import("./appStore");
      expect(getStoredTheme()).toBe("system");
    });

    it("returns the stored value for 'light'", async () => {
      localStorage.setItem("theme", "light");
      const { getStoredTheme } = await import("./appStore");
      expect(getStoredTheme()).toBe("light");
    });

    it("returns the stored value for 'dark'", async () => {
      localStorage.setItem("theme", "dark");
      const { getStoredTheme } = await import("./appStore");
      expect(getStoredTheme()).toBe("dark");
    });

    it("returns the stored value for 'system'", async () => {
      localStorage.setItem("theme", "system");
      const { getStoredTheme } = await import("./appStore");
      expect(getStoredTheme()).toBe("system");
    });

    it("returns 'system' for an unrecognized value", async () => {
      localStorage.setItem("theme", "neon");
      const { getStoredTheme } = await import("./appStore");
      expect(getStoredTheme()).toBe("system");
    });

    it("returns 'system' when localStorage.getItem throws", async () => {
      const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("blocked");
      });
      const { getStoredTheme } = await import("./appStore");
      expect(getStoredTheme()).toBe("system");
      spy.mockRestore();
    });
  });

  describe("applyThemeToDOM", () => {
    it("adds .dark for theme='dark'", async () => {
      const { applyThemeToDOM } = await import("./appStore");
      applyThemeToDOM("dark");
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });

    it("removes .dark for theme='light'", async () => {
      document.documentElement.classList.add("dark");
      const { applyThemeToDOM } = await import("./appStore");
      applyThemeToDOM("light");
      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });

    it("adds .dark for theme='system' when OS prefers dark", async () => {
      setMatchMedia(SYSTEM_QUERY, true);
      const { applyThemeToDOM } = await import("./appStore");
      applyThemeToDOM("system");
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });

    it("removes .dark for theme='system' when OS prefers light", async () => {
      document.documentElement.classList.add("dark");
      setMatchMedia(SYSTEM_QUERY, false);
      const { applyThemeToDOM } = await import("./appStore");
      applyThemeToDOM("system");
      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });
  });

  describe("isTheme", () => {
    it("accepts the three valid values", async () => {
      const { isTheme } = await import("./appStore");
      expect(isTheme("light")).toBe(true);
      expect(isTheme("dark")).toBe(true);
      expect(isTheme("system")).toBe(true);
    });

    it("rejects everything else", async () => {
      const { isTheme } = await import("./appStore");
      expect(isTheme("neon")).toBe(false);
      expect(isTheme(null)).toBe(false);
      expect(isTheme(undefined)).toBe(false);
      expect(isTheme(42)).toBe(false);
    });
  });

  describe("setTheme", () => {
    it("persists to localStorage and applies DOM class", async () => {
      const { useAppStore } = await import("./appStore");
      useAppStore.getState().setTheme("dark");
      expect(localStorage.getItem("theme")).toBe("dark");
      expect(document.documentElement.classList.contains("dark")).toBe(true);
      expect(useAppStore.getState().theme).toBe("dark");
    });

    it("still applies DOM class and updates state when localStorage.setItem throws", async () => {
      const setSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("QuotaExceeded");
      });
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const { useAppStore } = await import("./appStore");
      useAppStore.getState().setTheme("dark");

      expect(document.documentElement.classList.contains("dark")).toBe(true);
      expect(useAppStore.getState().theme).toBe("dark");

      setSpy.mockRestore();
      warnSpy.mockRestore();
    });
  });

  describe("OS preference subscription", () => {
    it("re-applies DOM class when prefers-color-scheme flips and theme is 'system'", async () => {
      setMatchMedia(SYSTEM_QUERY, false);
      const { useAppStore } = await import("./appStore");
      useAppStore.setState({ theme: "system" });
      document.documentElement.classList.remove("dark");

      setMatchMedia(SYSTEM_QUERY, true);

      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });

    it("does not override an explicit theme on OS change", async () => {
      setMatchMedia(SYSTEM_QUERY, false);
      const { useAppStore } = await import("./appStore");
      useAppStore.setState({ theme: "light" });
      document.documentElement.classList.remove("dark");

      setMatchMedia(SYSTEM_QUERY, true);

      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });
  });
});
