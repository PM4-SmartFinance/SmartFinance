import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SettingsAccounts } from "./SettingsAccounts";
import { ApiError } from "../lib/api";
import * as accountsQueries from "../lib/queries/accounts";

vi.mock("../lib/queries/accounts", () => ({
  useAccounts: vi.fn(),
  useUpdateAccount: vi.fn(),
  useDeleteAccount: vi.fn(),
  useCreateAccount: vi.fn(),
}));

const ACCOUNTS = [
  { id: "acc-1", name: "Main Account", iban: "CH00 0001", accountNumber: null, active: true },
];

const mockUseAccounts = vi.mocked(accountsQueries.useAccounts);
const mockUseUpdateAccount = vi.mocked(accountsQueries.useUpdateAccount);
const mockUseDeleteAccount = vi.mocked(accountsQueries.useDeleteAccount);

// Minimal mutation stubs — only the fields SettingsAccounts reads.
function updateStub(overrides: Partial<ReturnType<typeof accountsQueries.useUpdateAccount>> = {}) {
  return {
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
    ...overrides,
  } as unknown as ReturnType<typeof accountsQueries.useUpdateAccount>;
}

function deleteStub(overrides: Partial<ReturnType<typeof accountsQueries.useDeleteAccount>> = {}) {
  return {
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
    reset: vi.fn(),
    error: null,
    ...overrides,
  } as unknown as ReturnType<typeof accountsQueries.useDeleteAccount>;
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <SettingsAccounts />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAccounts.mockReturnValue({
    data: ACCOUNTS,
    isLoading: false,
    error: null,
  } as unknown as ReturnType<typeof accountsQueries.useAccounts>);
  mockUseUpdateAccount.mockReturnValue(updateStub());
  mockUseDeleteAccount.mockReturnValue(deleteStub());
});

describe("SettingsAccounts", () => {
  it("shows the deactivate-instead message when deleting an account blocked with 409", async () => {
    const user = userEvent.setup();
    mockUseDeleteAccount.mockReturnValue(
      deleteStub({ error: new ApiError(409, { code: "ACCOUNT_HAS_TRANSACTIONS" }, "conflict") }),
    );

    renderPage();
    await user.click(screen.getByTitle("Delete"));

    expect(
      screen.getByText("This account still has transactions. Deactivate it instead of deleting."),
    ).toBeInTheDocument();
  });

  it("surfaces an error alert when toggling active state fails", async () => {
    const user = userEvent.setup();
    mockUseUpdateAccount.mockReturnValue(
      updateStub({ mutateAsync: vi.fn().mockRejectedValue(new Error("network down")) }),
    );

    renderPage();
    await user.click(screen.getByTitle("Deactivate"));

    expect(await screen.findByText("network down")).toBeInTheDocument();
  });

  it("closes the confirm dialog after a successful delete", async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    mockUseDeleteAccount.mockReturnValue(deleteStub({ mutateAsync }));

    renderPage();
    await user.click(screen.getByTitle("Delete"));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Delete Account?")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(mutateAsync).toHaveBeenCalledWith("acc-1");
    await waitFor(() => expect(screen.queryByText("Delete Account?")).not.toBeInTheDocument());
  });
});
