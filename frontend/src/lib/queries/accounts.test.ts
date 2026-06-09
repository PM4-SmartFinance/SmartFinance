import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import {
  useAccounts,
  useCreateAccount,
  useUpdateAccount,
  useDeleteAccount,
  type Account,
} from "./accounts";

vi.mock("../api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { api } from "../api";

const mockApi = {
  get: vi.mocked(api.get),
  post: vi.mocked(api.post),
  patch: vi.mocked(api.patch),
  delete: vi.mocked(api.delete),
};

const account: Account = {
  id: "acc-1",
  name: "Main Account",
  iban: "CH93 0076 2011 6238 5295 7",
  accountNumber: null,
  active: true,
};

function createTestWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return { queryClient, wrapper };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useAccounts", () => {
  it("fetches and unwraps the accounts array", async () => {
    mockApi.get.mockResolvedValue({ accounts: [account] });

    const { wrapper } = createTestWrapper();
    const { result } = renderHook(() => useAccounts(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([account]);
    expect(mockApi.get).toHaveBeenCalledWith("/accounts");
  });
});

describe("useCreateAccount", () => {
  it("posts the input and invalidates the accounts cache", async () => {
    mockApi.post.mockResolvedValue({ account });

    const { queryClient, wrapper } = createTestWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useCreateAccount(), { wrapper });

    await result.current.mutateAsync({ name: "Main Account", iban: "CH93..." });

    expect(mockApi.post).toHaveBeenCalledWith("/accounts", {
      name: "Main Account",
      iban: "CH93...",
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["accounts"] });
  });
});

describe("useUpdateAccount", () => {
  it("patches the account and invalidates dependent caches", async () => {
    mockApi.patch.mockResolvedValue({ account: { ...account, active: false } });

    const { queryClient, wrapper } = createTestWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useUpdateAccount(), { wrapper });

    await result.current.mutateAsync({ id: "acc-1", input: { active: false } });

    expect(mockApi.patch).toHaveBeenCalledWith("/accounts/acc-1", { active: false });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["accounts"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["transactions"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["dashboard"] });
  });
});

describe("useDeleteAccount", () => {
  it("deletes the account and invalidates dependent caches", async () => {
    mockApi.delete.mockResolvedValue(undefined);

    const { queryClient, wrapper } = createTestWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useDeleteAccount(), { wrapper });

    await result.current.mutateAsync("acc-1");

    expect(mockApi.delete).toHaveBeenCalledWith("/accounts/acc-1");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["accounts"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["transactions"] });
  });
});
