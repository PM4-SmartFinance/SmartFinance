import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi } from "vitest";
import { SettingsLayout } from "./SettingsLayout";

const mockAuth = vi.fn();

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => mockAuth(),
}));

vi.mock("../hooks/useLogout", () => ({
  useLogout: () => ({ mutate: vi.fn(), isPending: false }),
}));

function renderSettings() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/settings"]}>
        <Routes>
          <Route element={<SettingsLayout />}>
            <Route path="/settings" element={<div>Outlet Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("SettingsLayout", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders layout correctly with profile link for normal users", () => {
    mockAuth.mockReturnValue({
      user: { id: "1", email: "test@example.com", role: "USER" },
    });
    renderSettings();
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByText("Profile")).toBeInTheDocument();
    expect(screen.queryByText("User Management")).not.toBeInTheDocument();
    expect(screen.getByText("Outlet Content")).toBeInTheDocument();
  });

  it("renders User Management link for admins", () => {
    mockAuth.mockReturnValue({
      user: { id: "1", email: "admin@example.com", role: "ADMIN" },
    });
    renderSettings();
    expect(screen.getByText("Profile")).toBeInTheDocument();
    expect(screen.getByText("User Management")).toBeInTheDocument();
  });

  it("exposes Sign out from the user menu", async () => {
    mockAuth.mockReturnValue({
      user: { id: "1", email: "test@example.com", role: "USER" },
    });
    renderSettings();

    await userEvent.click(screen.getByRole("button", { name: "User menu" }));

    expect(await screen.findByRole("menuitem", { name: /sign out/i })).toBeInTheDocument();
  });
});
