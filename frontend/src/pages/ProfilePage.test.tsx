import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { ProfilePage } from "./ProfilePage";
import { api, ApiError } from "../lib/api";

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
    api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
    ApiError: MockApiError,
  };
});

const mockGet = vi.mocked(api.get);
const mockPatch = vi.mocked(api.patch);
const mockPost = vi.mocked(api.post);

const PROFILE = {
  id: "user-1",
  email: "test@example.com",
  name: "Test User",
  role: "USER",
};

function renderPage(initialPath = "/profile") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/login" element={<div>Login page</div>} />
          <Route path="/" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGet.mockResolvedValue({ user: PROFILE });
});

// ── Initial render ─────────────────────────────────────────────────────────────

describe("initial render", () => {
  it("renders the user's name as the page heading after profile loads", async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Test User" })).toBeInTheDocument(),
    );
  });

  it("renders a link back to the dashboard", () => {
    renderPage();
    expect(screen.getByRole("link", { name: /Dashboard/ })).toBeInTheDocument();
  });

  it("pre-fills the name field after profile loads", async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByLabelText<HTMLInputElement>("Display name").value).toBe("Test User"),
    );
  });

  it("pre-fills the email field after profile loads", async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByLabelText<HTMLInputElement>("Email address").value).toBe(
        "test@example.com",
      ),
    );
  });

  it("renders the Save changes button after profile loads", async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument(),
    );
  });

  it("renders the Change password card", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Change password" })).toBeInTheDocument();
  });

  it("renders the Change password button", () => {
    renderPage();
    expect(screen.getByRole("button", { name: "Change password" })).toBeInTheDocument();
  });
});

// ── Profile form ───────────────────────────────────────────────────────────────

describe("profile form", () => {
  it("calls PATCH /users/me with the updated values on submit", async () => {
    mockPatch.mockResolvedValue({ user: { ...PROFILE, name: "New Name" } });
    renderPage();
    await waitFor(() => screen.getByLabelText("Display name"));

    await userEvent.clear(screen.getByLabelText("Display name"));
    await userEvent.type(screen.getByLabelText("Display name"), "New Name");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(mockPatch).toHaveBeenCalledOnce());
    expect(mockPatch).toHaveBeenCalledWith(
      "/users/me",
      expect.objectContaining({ displayName: "New Name" }),
    );
  });

  it("shows a success message after a successful save", async () => {
    mockPatch.mockResolvedValue({ user: PROFILE });
    renderPage();
    await waitFor(() => screen.getByLabelText("Display name"));

    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Profile updated successfully."),
    );
  });

  it("shows the button as 'Saving…' while the request is in flight", async () => {
    mockPatch.mockReturnValue(new Promise(() => {})); // never resolves
    renderPage();
    await waitFor(() => screen.getByLabelText("Display name"));

    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  });

  it("shows an API error message when PATCH fails", async () => {
    mockPatch.mockRejectedValue(new ApiError(409, null, "Email already in use"));
    renderPage();
    await waitFor(() => screen.getByLabelText("Display name"));

    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Email already in use"),
    );
  });

  it("shows a generic error message for unexpected failures", async () => {
    mockPatch.mockRejectedValue(new Error("Network error"));
    renderPage();
    await waitFor(() => screen.getByLabelText("Display name"));

    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong"),
    );
  });
});

// ── Password change form ───────────────────────────────────────────────────────

describe("password change form", () => {
  async function fillPasswordForm(
    current = "OldPass1!",
    newPass = "NewPass1!",
    confirm = "NewPass1!",
  ) {
    await userEvent.type(screen.getByLabelText("Current password"), current);
    await userEvent.type(screen.getByLabelText("New password"), newPass);
    await userEvent.type(screen.getByLabelText("Confirm new password"), confirm);
  }

  it("shows a mismatch error when the new passwords do not match", async () => {
    renderPage();
    await fillPasswordForm("OldPass1!", "NewPass1!", "Different1!");

    await userEvent.click(screen.getByRole("button", { name: "Change password" }));

    expect(screen.getByRole("alert")).toHaveTextContent("New passwords do not match.");
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("calls POST /users/me/change-password with the correct credentials", async () => {
    mockPost.mockResolvedValue({ ok: true });
    renderPage();
    await fillPasswordForm();

    await userEvent.click(screen.getByRole("button", { name: "Change password" }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledOnce());
    expect(mockPost).toHaveBeenCalledWith("/users/me/change-password", {
      currentPassword: "OldPass1!",
      newPassword: "NewPass1!",
    });
  });

  it("shows a success message after a successful password change", async () => {
    mockPost.mockResolvedValue({ ok: true });
    renderPage();
    await fillPasswordForm();

    await userEvent.click(screen.getByRole("button", { name: "Change password" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Password changed"));
  });

  it("shows the button as 'Changing…' while the request is in flight", async () => {
    mockPost.mockReturnValue(new Promise(() => {}));
    renderPage();
    await fillPasswordForm();

    await userEvent.click(screen.getByRole("button", { name: "Change password" }));

    expect(screen.getByRole("button", { name: "Changing…" })).toBeDisabled();
  });

  it("shows the API error when the current password is wrong", async () => {
    mockPost.mockRejectedValue(new ApiError(401, null, "Current password is incorrect"));
    renderPage();
    await fillPasswordForm();

    await userEvent.click(screen.getByRole("button", { name: "Change password" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Current password is incorrect"),
    );
  });

  it("clears the confirm-mismatch error when the user retypes the confirm field", async () => {
    renderPage();
    await fillPasswordForm("OldPass1!", "NewPass1!", "Different1!");
    await userEvent.click(screen.getByRole("button", { name: "Change password" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("Confirm new password"));
    await userEvent.type(screen.getByLabelText("Confirm new password"), "NewPass1!");

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
