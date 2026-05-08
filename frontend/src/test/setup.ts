import "@testing-library/jest-dom/vitest";

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

Object.defineProperty(window, "matchMedia", {
  writable: true,
  configurable: true,
  value: (query: string) => getOrCreate(query).list as unknown as MediaQueryList,
});

/**
 * Test helper: set `matches` for a media query and fire the `change` event so
 * listeners registered via `addEventListener("change", ...)` run.
 */
export function setMatchMedia(query: string, matches: boolean): void {
  const { list, listeners } = getOrCreate(query);
  list.matches = matches;
  const event = { matches, media: query } as MediaQueryListEvent;
  listeners.forEach((cb) => cb(event));
}

/** Reset all media-query mocks between tests. */
export function resetMatchMedia(): void {
  mediaLists.clear();
}

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverMock;

// Mock HTMLDialogElement methods for jsdom
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
