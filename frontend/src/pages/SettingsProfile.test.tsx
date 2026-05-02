import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router";
import { vi } from "vitest";
import { SettingsProfile } from "./SettingsProfile";

const { mockGet, mockPatch, mockPost } = vi.hoisted(() => {
  return {
    mockGet: vi.fn(),
    mockPatch: vi.fn(),
    mockPost: vi.fn(),
  };
});

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
    api: {
      get: mockGet,
      patch: mockPatch,
      post: mockPost,
    },
    ApiError: MockApiError,
  };
});

function renderWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <SettingsProfile />
      </BrowserRouter>
    </QueryClientProvider>,
  );
}

describe("SettingsProfile - Password Change Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({
      user: { id: "1", email: "test@example.com", name: "Test User", role: "USER" },
    });
  });

  it("shows error when new passwords do not match", async () => {
    const user = userEvent.setup();
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Test User")).toBeInTheDocument();
    });

    const currentPasswordInput = screen.getByLabelText(/Current password/i);
    const newPasswordInput = screen.getByLabelText(/^New password/i);
    const confirmPasswordInput = screen.getByLabelText(/Confirm new password/i);
    const submitBtn = screen.getByRole("button", { name: "Change password" });

    await user.type(currentPasswordInput, "oldpass123");
    await user.type(newPasswordInput, "newpass123");
    await user.type(confirmPasswordInput, "different123");
    await user.click(submitBtn);

    expect(screen.getByText("New passwords do not match.")).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("calls API on valid password change", async () => {
    const user = userEvent.setup();
    mockPost.mockResolvedValue({ ok: true });
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Test User")).toBeInTheDocument();
    });

    const currentPasswordInput = screen.getByLabelText(/Current password/i);
    const newPasswordInput = screen.getByLabelText(/^New password/i);
    const confirmPasswordInput = screen.getByLabelText(/Confirm new password/i);
    const submitBtn = screen.getByRole("button", { name: "Change password" });

    await user.type(currentPasswordInput, "oldpass123");
    await user.type(newPasswordInput, "newpass123");
    await user.type(confirmPasswordInput, "newpass123");
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith("/users/me/change-password", {
        currentPassword: "oldpass123",
        newPassword: "newpass123",
      });
    });

    expect(screen.getByText("Password changed. Please sign in again.")).toBeInTheDocument();
  });

  it("shows api error if password change fails", async () => {
    const user = userEvent.setup();
    const { ApiError } = await import("../lib/api");
    mockPost.mockRejectedValue(new ApiError(400, null, "Current password incorrect"));
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Test User")).toBeInTheDocument();
    });

    const currentPasswordInput = screen.getByLabelText(/Current password/i);
    const newPasswordInput = screen.getByLabelText(/^New password/i);
    const confirmPasswordInput = screen.getByLabelText(/Confirm new password/i);
    const submitBtn = screen.getByRole("button", { name: "Change password" });

    await user.type(currentPasswordInput, "wrongpass");
    await user.type(newPasswordInput, "newpass123");
    await user.type(confirmPasswordInput, "newpass123");
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("Current password incorrect")).toBeInTheDocument();
    });
  });
});
