import * as matchers from "@testing-library/jest-dom/matchers";
import { expect, vi, afterEach } from "vitest";

expect.extend(matchers);
import i18nReal from "i18next";
import { initReactI18next } from "react-i18next";
import enTranslations from "../../public/locales/en/translation.json";
import deTranslations from "../../public/locales/de/translation.json";
import frTranslations from "../../public/locales/fr/translation.json";
import itTranslations from "../../public/locales/it/translation.json";
import rmTranslations from "../../public/locales/rm/translation.json";

const localStorageMock = (function () {
  let store: Record<string, string> = {};
  return {
    getItem: function (key: string) {
      return store[key] || null;
    },
    setItem: function (key: string, value: string) {
      store[key] = value.toString();
    },
    removeItem: function (key: string) {
      delete store[key];
    },
    clear: function () {
      store = {};
    },
  };
})();
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock, writable: true });

// Real i18next instance preloaded with every locale's bundled JSON. This means
// `useTranslation()` resolves keys through actual CLDR plural rules, fallback
// chains, and interpolation — not a hand-rolled mock — and missing keys surface
// as the raw key string rather than being silently substituted.
void i18nReal.use(initReactI18next).init({
  lng: "en",
  fallbackLng: "en",
  supportedLngs: ["en", "de", "fr", "it", "rm"],
  resources: {
    en: { translation: enTranslations },
    de: { translation: deTranslations },
    fr: { translation: frTranslations },
    it: { translation: itTranslations },
    rm: { translation: rmTranslations },
  },
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

vi.mock("@/lib/i18n", () => ({ default: i18nReal }));

afterEach(async () => {
  if (i18nReal.resolvedLanguage !== "en") {
    await i18nReal.changeLanguage("en");
  }
});

type MediaListener = (event: MediaQueryListEvent) => void;

interface MockMediaList {
  matches: boolean;
  media: string;
  onchange: ((this: MediaQueryList, ev: MediaQueryListEvent) => void) | null;
  addListener: (cb: MediaListener) => void;
  removeListener: (cb: MediaListener) => void;
  addEventListener: (type: string, cb: MediaListener) => void;
  removeEventListener: (type: string, cb: MediaListener) => void;
  dispatchEvent: (event: MediaQueryListEvent) => boolean;
}

const mediaLists = new Map<string, { list: MockMediaList; listeners: Set<MediaListener> }>();

function getOrCreate(query: string) {
  let entry = mediaLists.get(query);
  if (entry) return entry;
  const listeners = new Set<MediaListener>();
  const list: MockMediaList = {
    matches: false,
    media: query,
    onchange: null,
    addListener: (cb) => listeners.add(cb),
    removeListener: (cb) => listeners.delete(cb),
    addEventListener: (_type, cb) => listeners.add(cb),
    removeEventListener: (_type, cb) => listeners.delete(cb),
    dispatchEvent: (event) => {
      listeners.forEach((cb) => cb(event));
      return true;
    },
  };
  entry = { list, listeners };
  mediaLists.set(query, entry);
  return entry;
}

Object.defineProperty(globalThis, "matchMedia", {
  writable: true,
  configurable: true,
  value: (query: string) => getOrCreate(query).list as unknown as MediaQueryList,
});

export function setMatchMedia(query: string, matches: boolean): void {
  const { list, listeners } = getOrCreate(query);
  list.matches = matches;
  const event = { matches, media: query } as MediaQueryListEvent;
  listeners.forEach((cb) => cb(event));
}

export function resetMatchMedia(): void {
  mediaLists.clear();
}

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock;

if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
}

if (!HTMLDialogElement.prototype.close) {
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
}
