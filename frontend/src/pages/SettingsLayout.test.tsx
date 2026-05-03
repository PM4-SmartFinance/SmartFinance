import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";
import { vi } from "vitest";
import { SettingsLayout } from "./SettingsLayout";

const mockAuth = vi.fn();

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => mockAuth(),
}));

describe("SettingsLayout", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders layout correctly with profile link for normal users", () => {
    mockAuth.mockReturnValue({ user: { role: "USER" } });
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <Routes>
          <Route element={<SettingsLayout />}>
            <Route path="/settings" element={<div>Outlet Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByText("Profile")).toBeInTheDocument();
    expect(screen.queryByText("User Management")).not.toBeInTheDocument();
    expect(screen.getByText("Outlet Content")).toBeInTheDocument();
  });

  it("renders User Management link for admins", () => {
    mockAuth.mockReturnValue({ user: { role: "ADMIN" } });
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <Routes>
          <Route element={<SettingsLayout />}>
            <Route path="/settings" element={<div>Outlet Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("Profile")).toBeInTheDocument();
    expect(screen.getByText("User Management")).toBeInTheDocument();
  });
});
