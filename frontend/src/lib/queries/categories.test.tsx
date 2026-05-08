/// <reference types="vitest/globals" />

import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import { useCreateCategory, useDeleteCategory, useUpdateCategory } from "./categories";
import { api } from "../api";

vi.mock("../api");

const mockPost = vi.mocked(api.post);
const mockPatch = vi.mocked(api.patch);
const mockDelete = vi.mocked(api.delete);

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("category mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useCreateCategory", () => {
    it("invalidates CATEGORIES_QUERY_KEY on success", async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
      mockPost.mockResolvedValue({
        category: {
          id: "1",
          categoryName: "Groceries",
          userId: "u1",
          createdAt: "",
          updatedAt: "",
        },
      });

      const { result } = renderHook(() => useCreateCategory(), {
        wrapper: createWrapper(queryClient),
      });

      result.current.mutate("Groceries");

      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith(
          expect.objectContaining({ queryKey: ["categories"] }),
        );
        expect(invalidateSpy).toHaveBeenCalledWith(
          expect.objectContaining({ queryKey: ["dashboard"] }),
        );
      });

      expect(invalidateSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ["category-rules"] }),
      );
    });

    it("does not invalidate any queries on failure", async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
      mockPost.mockRejectedValue(new Error("Create failed"));

      const { result } = renderHook(() => useCreateCategory(), {
        wrapper: createWrapper(queryClient),
      });

      result.current.mutate("Groceries");

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(invalidateSpy).not.toHaveBeenCalled();
    });
  });

  describe("useUpdateCategory", () => {
    it("invalidates CATEGORIES_QUERY_KEY, CATEGORY_RULES_QUERY_KEY, and dashboard on success", async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
      mockPatch.mockResolvedValue({
        category: { id: "1", categoryName: "Updated", userId: "u1", createdAt: "", updatedAt: "" },
      });

      const { result } = renderHook(() => useUpdateCategory(), {
        wrapper: createWrapper(queryClient),
      });

      result.current.mutate({ id: "1", categoryName: "Updated" });

      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith(
          expect.objectContaining({ queryKey: ["categories"] }),
        );
        expect(invalidateSpy).toHaveBeenCalledWith(
          expect.objectContaining({ queryKey: ["category-rules"] }),
        );
        expect(invalidateSpy).toHaveBeenCalledWith(
          expect.objectContaining({ queryKey: ["dashboard"] }),
        );
      });
    });

    it("does not invalidate any queries on failure", async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
      mockPatch.mockRejectedValue(new Error("Update failed"));

      const { result } = renderHook(() => useUpdateCategory(), {
        wrapper: createWrapper(queryClient),
      });

      result.current.mutate({ id: "1", categoryName: "Updated" });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(invalidateSpy).not.toHaveBeenCalled();
    });
  });

  describe("useDeleteCategory", () => {
    it("invalidates CATEGORIES_QUERY_KEY, CATEGORY_RULES_QUERY_KEY, and dashboard on success", async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
      mockDelete.mockResolvedValue({});

      const { result } = renderHook(() => useDeleteCategory(), {
        wrapper: createWrapper(queryClient),
      });

      result.current.mutate("1");

      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith(
          expect.objectContaining({ queryKey: ["categories"] }),
        );
        expect(invalidateSpy).toHaveBeenCalledWith(
          expect.objectContaining({ queryKey: ["category-rules"] }),
        );
        expect(invalidateSpy).toHaveBeenCalledWith(
          expect.objectContaining({ queryKey: ["dashboard"] }),
        );
      });
    });

    it("does not invalidate any queries on failure", async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
      mockDelete.mockRejectedValue(new Error("Delete failed"));

      const { result } = renderHook(() => useDeleteCategory(), {
        wrapper: createWrapper(queryClient),
      });

      result.current.mutate("1");

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(invalidateSpy).not.toHaveBeenCalled();
    });
  });
});
