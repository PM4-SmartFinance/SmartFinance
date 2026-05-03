import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi } from "vitest";
import { ResetPasswordDialog } from "./ResetPasswordDialog";

const { mockPost } = vi.hoisted(() => ({ mockPost: vi.fn() }));

vi.mock("../lib/api", () => {
  class MockApiError extends Error {
    status: number;
    body: unknown;
    constructor(status: number, body: unknown, message: string) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.body = body;
    }
  }
  return {
    api: { post: mockPost },
    ApiError: MockApiError,
  };
});

beforeAll(() => {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute("open", "");
    };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute("open");
    };
  }
});

const targetUser = {
  id: "user-2",
  email: "target@example.com",
  name: "Target",
  role: "USER" as const,
  active: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

function renderDialog(overrides: { onClose?: () => void; isOpen?: boolean } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onClose = overrides.onClose ?? vi.fn();
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <ResetPasswordDialog isOpen={overrides.isOpen ?? true} user={targetUser} onClose={onClose} />
    </QueryClientProvider>,
  );
  return { ...utils, onClose, queryClient };
}

describe("ResetPasswordDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("shows mismatch error and does not call the API when passwords differ", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByLabelText(/^New password/i), "Password1!");
    await user.type(screen.getByLabelText(/Confirm new password/i), "Different1!");
    await user.click(screen.getByRole("button", { name: /Reset Password/i }));

    expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("posts to the reset-password endpoint and shows success on a valid submit", async () => {
    const user = userEvent.setup();
    mockPost.mockResolvedValue({ ok: true });
    renderDialog();

    await user.type(screen.getByLabelText(/^New password/i), "Password1!");
    await user.type(screen.getByLabelText(/Confirm new password/i), "Password1!");
    await user.click(screen.getByRole("button", { name: /Reset Password/i }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith("/users/user-2/reset-password", {
        newPassword: "Password1!",
      });
    });
    expect(await screen.findByText("Password reset successfully.")).toBeInTheDocument();
  });

  it("auto-closes after a successful reset", async () => {
    const user = userEvent.setup();
    mockPost.mockResolvedValue({ ok: true });
    const { onClose } = renderDialog();

    await user.type(screen.getByLabelText(/^New password/i), "Password1!");
    await user.type(screen.getByLabelText(/Confirm new password/i), "Password1!");
    await user.click(screen.getByRole("button", { name: /Reset Password/i }));

    await waitFor(
      () => {
        expect(onClose).toHaveBeenCalled();
      },
      { timeout: 2500 },
    );
  });

  it("renders ApiError messages from the server", async () => {
    const { ApiError } = await import("../lib/api");
    const user = userEvent.setup();
    mockPost.mockRejectedValue(new ApiError(403, null, "Cannot reset another admin's password"));
    renderDialog();

    await user.type(screen.getByLabelText(/^New password/i), "Password1!");
    await user.type(screen.getByLabelText(/Confirm new password/i), "Password1!");
    await user.click(screen.getByRole("button", { name: /Reset Password/i }));

    expect(await screen.findByText("Cannot reset another admin's password")).toBeInTheDocument();
  });

  it("falls back to a generic message for non-ApiError failures", async () => {
    const user = userEvent.setup();
    mockPost.mockRejectedValue(new Error("network down"));
    renderDialog();

    await user.type(screen.getByLabelText(/^New password/i), "Password1!");
    await user.type(screen.getByLabelText(/Confirm new password/i), "Password1!");
    await user.click(screen.getByRole("button", { name: /Reset Password/i }));

    expect(await screen.findByText("Failed to reset password.")).toBeInTheDocument();
  });

  it("clears the auto-close timer when unmounted before the timeout fires", async () => {
    const user = userEvent.setup();
    mockPost.mockResolvedValue({ ok: true });
    const { onClose, unmount } = renderDialog();

    await user.type(screen.getByLabelText(/^New password/i), "Password1!");
    await user.type(screen.getByLabelText(/Confirm new password/i), "Password1!");
    await user.click(screen.getByRole("button", { name: /Reset Password/i }));

    await waitFor(() => {
      expect(screen.getByText("Password reset successfully.")).toBeInTheDocument();
    });

    unmount();
    await new Promise((resolve) => setTimeout(resolve, 2000));

    expect(onClose).not.toHaveBeenCalled();
  });

  it("Cancel button closes the dialog without calling the API", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog();

    await user.click(screen.getByRole("button", { name: /Cancel/i }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(mockPost).not.toHaveBeenCalled();
  });
});
