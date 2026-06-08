import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccountFormDialog } from "./AccountFormDialog";
import { ApiError } from "../lib/api";
import * as accountsQueries from "../lib/queries/accounts";

vi.mock("../lib/queries/accounts", () => ({
  useCreateAccount: vi.fn(),
  useUpdateAccount: vi.fn(),
}));

const mockUseCreateAccount = vi.mocked(accountsQueries.useCreateAccount);
const mockUseUpdateAccount = vi.mocked(accountsQueries.useUpdateAccount);

function mutationStub(mutateAsync = vi.fn().mockResolvedValue(undefined)) {
  return { mutateAsync, isPending: false } as unknown as ReturnType<
    typeof accountsQueries.useCreateAccount
  >;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseCreateAccount.mockReturnValue(mutationStub());
  mockUseUpdateAccount.mockReturnValue(mutationStub());
});

describe("AccountFormDialog", () => {
  it("requires a name and does not call the API when it is empty", async () => {
    const user = userEvent.setup();
    const create = vi.fn().mockResolvedValue(undefined);
    mockUseCreateAccount.mockReturnValue(mutationStub(create));

    render(<AccountFormDialog isOpen onClose={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Create Account" }));

    expect(screen.getByText("Name is required")).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it("requires an IBAN when the name is filled", async () => {
    const user = userEvent.setup();
    const create = vi.fn().mockResolvedValue(undefined);
    mockUseCreateAccount.mockReturnValue(mutationStub(create));

    render(<AccountFormDialog isOpen onClose={vi.fn()} />);
    await user.type(screen.getByLabelText("Name"), "Main");
    await user.click(screen.getByRole("button", { name: "Create Account" }));

    expect(screen.getByText("IBAN is required")).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it("maps a 409 conflict to the IBAN-exists message", async () => {
    const user = userEvent.setup();
    const create = vi.fn().mockRejectedValue(new ApiError(409, {}, "conflict"));
    mockUseCreateAccount.mockReturnValue(mutationStub(create));

    render(<AccountFormDialog isOpen onClose={vi.fn()} />);
    await user.type(screen.getByLabelText("Name"), "Main");
    await user.type(screen.getByLabelText("IBAN"), "CH00 0001");
    await user.click(screen.getByRole("button", { name: "Create Account" }));

    expect(await screen.findByText("An account with this IBAN already exists")).toBeInTheDocument();
  });

  it("creates the account and closes on success", async () => {
    const user = userEvent.setup();
    const create = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    mockUseCreateAccount.mockReturnValue(mutationStub(create));

    render(<AccountFormDialog isOpen onClose={onClose} />);
    await user.type(screen.getByLabelText("Name"), "Main");
    await user.type(screen.getByLabelText("IBAN"), "CH00 0001");
    await user.click(screen.getByRole("button", { name: "Create Account" }));

    expect(create).toHaveBeenCalledWith({
      name: "Main",
      iban: "CH00 0001",
      accountNumber: null,
    });
    expect(onClose).toHaveBeenCalled();
  });
});
