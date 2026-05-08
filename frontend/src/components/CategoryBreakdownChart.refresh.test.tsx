/// <reference types="vitest/globals" />

import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { CategoryBreakdownChart } from "./CategoryBreakdownChart";
import { useCreateCategory, useDeleteCategory, useUpdateCategory } from "../lib/queries/categories";
import { api } from "../lib/api";

vi.mock("../lib/api", () => ({
  ApiError: class MockApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
      this.name = "ApiError";
    }
  },
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockGet = vi.mocked(api.get);
const mockPost = vi.mocked(api.post);
const mockPatch = vi.mocked(api.patch);
const mockDelete = vi.mocked(api.delete);

const initialBreakdown = [{ categoryId: "cat-1", categoryName: "Groceries", total: 100 }];
const refreshedBreakdown = [
  { categoryId: "cat-1", categoryName: "Groceries", total: 100 },
  { categoryId: "cat-2", categoryName: "Dining", total: 50 },
];

function categoryBreakdownCallCount() {
  return mockGet.mock.calls.filter(([path]) => String(path).includes("/dashboard/categories"))
    .length;
}

function setupBreakdownMock(
  initial: typeof initialBreakdown,
  refreshed: typeof refreshedBreakdown,
) {
  let callCount = 0;
  mockGet.mockImplementation((path: string) => {
    if (path.includes("/dashboard/categories")) {
      callCount += 1;
      return Promise.resolve(callCount === 1 ? initial : refreshed);
    }
    return Promise.resolve({});
  });
}

function CreateTrigger() {
  const { mutate } = useCreateCategory();
  return <button onClick={() => mutate("Dining")}>create-category</button>;
}

function UpdateTrigger() {
  const { mutate } = useUpdateCategory();
  return (
    <button onClick={() => mutate({ id: "cat-1", categoryName: "Renamed" })}>
      update-category
    </button>
  );
}

function DeleteTrigger() {
  const { mutate } = useDeleteCategory();
  return <button onClick={() => mutate("cat-1")}>delete-category</button>;
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("CategoryBreakdownChart — refresh on category mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refetches category breakdown after useCreateCategory succeeds", async () => {
    setupBreakdownMock(initialBreakdown, refreshedBreakdown);
    mockPost.mockResolvedValue({
      category: {
        id: "cat-2",
        categoryName: "Dining",
        userId: "u1",
        createdAt: "",
        updatedAt: "",
      },
    });

    const user = userEvent.setup();
    renderWithProviders(
      <>
        <CategoryBreakdownChart />
        <CreateTrigger />
      </>,
    );

    await waitFor(() => {
      expect(categoryBreakdownCallCount()).toBe(1);
    });

    await user.click(screen.getByRole("button", { name: "create-category" }));

    await waitFor(() => {
      expect(categoryBreakdownCallCount()).toBeGreaterThan(1);
    });
  });

  it("refetches category breakdown after useUpdateCategory succeeds", async () => {
    setupBreakdownMock(initialBreakdown, refreshedBreakdown);
    mockPatch.mockResolvedValue({
      category: {
        id: "cat-1",
        categoryName: "Renamed",
        userId: "u1",
        createdAt: "",
        updatedAt: "",
      },
    });

    const user = userEvent.setup();
    renderWithProviders(
      <>
        <CategoryBreakdownChart />
        <UpdateTrigger />
      </>,
    );

    await waitFor(() => {
      expect(categoryBreakdownCallCount()).toBe(1);
    });

    await user.click(screen.getByRole("button", { name: "update-category" }));

    await waitFor(() => {
      expect(categoryBreakdownCallCount()).toBeGreaterThan(1);
    });
  });

  it("refetches category breakdown after useDeleteCategory succeeds", async () => {
    setupBreakdownMock(initialBreakdown, refreshedBreakdown);
    mockDelete.mockResolvedValue(undefined);

    const user = userEvent.setup();
    renderWithProviders(
      <>
        <CategoryBreakdownChart />
        <DeleteTrigger />
      </>,
    );

    await waitFor(() => {
      expect(categoryBreakdownCallCount()).toBe(1);
    });

    await user.click(screen.getByRole("button", { name: "delete-category" }));

    await waitFor(() => {
      expect(categoryBreakdownCallCount()).toBeGreaterThan(1);
    });
  });
});
