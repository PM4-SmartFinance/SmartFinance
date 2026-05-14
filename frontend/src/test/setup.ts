import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";
import enTranslations from "../../public/locales/en/translation.json";

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

const originalNumberFormat = Intl.NumberFormat;
globalThis.Intl.NumberFormat = class extends originalNumberFormat {
  constructor(locales?: string | string[], options?: Intl.NumberFormatOptions) {
    super("en-CH", options);
  }
} as unknown as typeof Intl.NumberFormat;

const originalDateTimeFormat = Intl.DateTimeFormat;
globalThis.Intl.DateTimeFormat = class extends originalDateTimeFormat {
  constructor(locales?: string | string[], options?: Intl.DateTimeFormatOptions) {
    super("en-CH", options);
  }
} as unknown as typeof Intl.DateTimeFormat;

const getTranslation = (key: string) => {
  return key
    .split(".")
    .reduce((obj: unknown, k) => (obj as Record<string, unknown>)?.[k], enTranslations);
};

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (
      key: string,
      fallback?: string | Record<string, unknown>,
      options?: Record<string, unknown>,
    ) => {
      if (key === "components.createUserDialog.roles.admin") return "ADMIN";
      if (key === "components.createUserDialog.roles.user") return "USER";

      const opts = typeof fallback === "object" ? fallback : options;
      let str = getTranslation(key);

      if (!str && opts && opts.count !== undefined) {
        const suffix = opts.count === 1 ? "_one" : "_other";
        str = getTranslation(`${key}${suffix}`);
      }

      if (!str) {
        str = typeof fallback === "string" ? fallback : key.split(".").pop() || key;
      }

      if (opts && typeof str === "string") {
        str = Object.keys(opts).reduce((acc, k) => {
          return acc.replace(`{{${k}}}`, String(opts[k]));
        }, str);
      }

      return str as string;
    },
    i18n: {
      changeLanguage: vi.fn(),
      resolvedLanguage: "en-CH",
    },
  }),
  initReactI18next: {
    type: "3rdParty",
    init: vi.fn(),
  },
}));

vi.mock("@/lib/i18n", () => ({
  default: {
    resolvedLanguage: "en-CH",
    changeLanguage: vi.fn(),
  },
}));

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
