import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router";
import { vi } from "vitest";
import { SettingsProfile } from "./SettingsProfile";

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));
vi.mock("react-router", async () => {
  const actual = await vi.importActual<typeof import("react-router")>("react-router");
  return { ...actual, useNavigate: () => mockNavigate };
});

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
    mockNavigate.mockReset();
    mockGet.mockResolvedValue({
      user: { id: "1", email: "test@example.com", name: "Test User", role: "USER" },
    });
  });

  it("clears the cached auth query before redirecting after password change", async () => {
    const user = userEvent.setup();
    const removeQueriesSpy = vi.spyOn(QueryClient.prototype, "removeQueries");
    mockPost.mockResolvedValue({ ok: true });
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Test User")).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/Current password/i), "oldpass123");
    await user.type(screen.getByLabelText(/^New password/i), "newpass123");
    await user.type(screen.getByLabelText(/Confirm new password/i), "newpass123");
    await user.click(screen.getByRole("button", { name: "Change password" }));

    await waitFor(
      () => {
        expect(mockNavigate).toHaveBeenCalledExactlyOnceWith("/login");
      },
      { timeout: 3000 },
    );

    expect(removeQueriesSpy).toHaveBeenCalledWith({ queryKey: ["auth", "me"] });

    // Ordering matters: cache must be evicted BEFORE the redirect, otherwise
    // the login page can briefly observe a stale authenticated user.
    const removeOrder = removeQueriesSpy.mock.invocationCallOrder[0];
    const navigateOrder = mockNavigate.mock.invocationCallOrder[0];
    expect(removeOrder).toBeDefined();
    expect(navigateOrder).toBeDefined();
    expect(removeOrder).toBeLessThan(navigateOrder as number);
    removeQueriesSpy.mockRestore();
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

  it("redirects to /login after a successful password change (delayed, not synchronous)", async () => {
    const user = userEvent.setup();
    mockPost.mockResolvedValue({ ok: true });
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Test User")).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/Current password/i), "oldpass123");
    await user.type(screen.getByLabelText(/^New password/i), "newpass123");
    await user.type(screen.getByLabelText(/Confirm new password/i), "newpass123");
    await user.click(screen.getByRole("button", { name: "Change password" }));

    // Success banner appears before navigation — locks the "show feedback,
    // then redirect" sequencing. If the navigate were synchronous, the page
    // would unmount before the banner could render.
    await waitFor(() => {
      expect(screen.getByText("Password changed. Please sign in again.")).toBeInTheDocument();
    });
    expect(mockNavigate).not.toHaveBeenCalled();

    // Wait long enough for the 1.5s delay to elapse; assert the redirect
    // ultimately fires with /login.
    await waitFor(
      () => {
        expect(mockNavigate).toHaveBeenCalledExactlyOnceWith("/login");
      },
      { timeout: 3000 },
    );
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

describe("SettingsProfile - Profile Update Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({
      user: { id: "1", email: "test@example.com", name: "Test User", role: "USER" },
    });
  });

  it("sends displayName and email to PATCH /users/me", async () => {
    const user = userEvent.setup();
    mockPatch.mockResolvedValue({
      user: { id: "1", email: "new@example.com", name: "New Name", role: "USER" },
    });
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Test User")).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText(/Display name/i);
    const emailInput = screen.getByLabelText(/Email address/i);

    await user.clear(nameInput);
    await user.type(nameInput, "New Name");
    await user.clear(emailInput);
    await user.type(emailInput, "new@example.com");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith("/users/me", {
        displayName: "New Name",
        email: "new@example.com",
      });
    });
    expect(await screen.findByText("Profile updated successfully.")).toBeInTheDocument();
  });

  it("shows ApiError message when update fails", async () => {
    const user = userEvent.setup();
    const { ApiError } = await import("../lib/api");
    mockPatch.mockRejectedValue(new ApiError(409, null, "Email already in use"));
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Test User")).toBeInTheDocument();
    });

    await user.clear(screen.getByLabelText(/Email address/i));
    await user.type(screen.getByLabelText(/Email address/i), "taken@example.com");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Email already in use")).toBeInTheDocument();
  });

  it("shows generic fallback for non-ApiError failures", async () => {
    const user = userEvent.setup();
    mockPatch.mockRejectedValue(new Error("network down"));
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Test User")).toBeInTheDocument();
    });

    await user.clear(screen.getByLabelText(/Display name/i));
    await user.type(screen.getByLabelText(/Display name/i), "Anything");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Something went wrong. Please try again.")).toBeInTheDocument();
  });
});
