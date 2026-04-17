import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useDialog } from "./useDialog";

const showModalMock = vi.fn(function (this: HTMLDialogElement) {
  Object.defineProperty(this, "open", { value: true, writable: true, configurable: true });
});
const closeMock = vi.fn(function (this: HTMLDialogElement) {
  Object.defineProperty(this, "open", { value: false, writable: true, configurable: true });
});

beforeEach(() => {
  vi.clearAllMocks();
  window.HTMLDialogElement.prototype.showModal = showModalMock;
  window.HTMLDialogElement.prototype.close = closeMock;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useDialog", () => {
  it("returns a ref object", () => {
    const { result } = renderHook(() => useDialog(false));

    expect(result.current).toBeDefined();
    expect(result.current).toHaveProperty("current");
  });

  it("maintains the ref across re-renders", () => {
    const { result, rerender } = renderHook(({ isOpen }) => useDialog(isOpen), {
      initialProps: { isOpen: false },
    });

    const initialRef = result.current;
    rerender({ isOpen: true });
    expect(result.current).toBe(initialRef);
  });

  it("calls showModal when isOpen changes to true", () => {
    const dialog = document.createElement("dialog");
    const { result, rerender } = renderHook(({ isOpen }) => useDialog(isOpen), {
      initialProps: { isOpen: false },
    });

    // Attach ref to real element
    Object.defineProperty(result.current, "current", { value: dialog, writable: true });
    rerender({ isOpen: true });

    expect(showModalMock).toHaveBeenCalledOnce();
  });

  it("calls close when isOpen changes from true to false", () => {
    const dialog = document.createElement("dialog");
    Object.defineProperty(dialog, "open", { value: true, writable: true, configurable: true });

    const { result, rerender } = renderHook(({ isOpen }) => useDialog(isOpen), {
      initialProps: { isOpen: true },
    });

    Object.defineProperty(result.current, "current", { value: dialog, writable: true });
    rerender({ isOpen: false });

    expect(closeMock).toHaveBeenCalledOnce();
  });

  it("does not call showModal if dialog is already open", () => {
    const dialog = document.createElement("dialog");
    Object.defineProperty(dialog, "open", { value: true, writable: true, configurable: true });

    const { result, rerender } = renderHook(({ isOpen }) => useDialog(isOpen), {
      initialProps: { isOpen: false },
    });

    Object.defineProperty(result.current, "current", { value: dialog, writable: true });
    rerender({ isOpen: true });

    expect(showModalMock).not.toHaveBeenCalled();
  });

  it("does not call close if dialog is already closed", () => {
    const dialog = document.createElement("dialog");
    const { result, rerender } = renderHook(({ isOpen }) => useDialog(isOpen), {
      initialProps: { isOpen: true },
    });

    Object.defineProperty(result.current, "current", { value: dialog, writable: true });
    rerender({ isOpen: false });

    expect(closeMock).not.toHaveBeenCalled();
  });

  it("handles null ref gracefully when isOpen changes", () => {
    expect(() => {
      const { rerender } = renderHook(({ isOpen }) => useDialog(isOpen), {
        initialProps: { isOpen: false },
      });

      rerender({ isOpen: true });
      rerender({ isOpen: false });
    }).not.toThrow();
  });
});
