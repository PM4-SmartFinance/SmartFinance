import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useDialog } from "./useDialog";

describe("useDialog", () => {
  it("returns a ref object", () => {
    const { result } = renderHook(() => useDialog(false));

    expect(result.current).toBeDefined();
    expect(result.current).toHaveProperty("current");
  });

  it("maintains the ref across re-renders with isOpen=true", () => {
    const { result, rerender } = renderHook(({ isOpen }) => useDialog(isOpen), {
      initialProps: { isOpen: true },
    });

    const initialRef = result.current;
    rerender({ isOpen: true });
    expect(result.current).toBe(initialRef);
  });

  it("maintains the ref across re-renders with isOpen=false", () => {
    const { result, rerender } = renderHook(({ isOpen }) => useDialog(isOpen), {
      initialProps: { isOpen: false },
    });

    const initialRef = result.current;
    rerender({ isOpen: false });
    expect(result.current).toBe(initialRef);
  });

  it("does not throw when ref is null and isOpen changes", () => {
    expect(() => {
      const { rerender } = renderHook(({ isOpen }) => useDialog(isOpen), {
        initialProps: { isOpen: false },
      });

      rerender({ isOpen: true });
      rerender({ isOpen: false });
    }).not.toThrow();
  });
});
