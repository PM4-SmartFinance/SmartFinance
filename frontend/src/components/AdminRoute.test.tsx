import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";
import { vi } from "vitest";
import { AdminRoute } from "./AdminRoute";

const mockAuth = vi.fn();

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => mockAuth(),
}));

describe("AdminRoute", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state when auth is loading", () => {
    mockAuth.mockReturnValue({ isLoading: true, user: null });
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<div>Admin Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("redirects to home when user is not authenticated", () => {
    mockAuth.mockReturnValue({ isLoading: false, user: null });
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/" element={<div>Home Page</div>} />
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<div>Admin Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("Home Page")).toBeInTheDocument();
    expect(screen.queryByText("Admin Content")).not.toBeInTheDocument();
  });

  it("redirects to home when user is authenticated but not an ADMIN", () => {
    mockAuth.mockReturnValue({ isLoading: false, user: { role: "USER" } });
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/" element={<div>Home Page</div>} />
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<div>Admin Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("Home Page")).toBeInTheDocument();
    expect(screen.queryByText("Admin Content")).not.toBeInTheDocument();
  });

  it("renders outlet content when user is an ADMIN", () => {
    mockAuth.mockReturnValue({ isLoading: false, user: { role: "ADMIN" } });
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/" element={<div>Home Page</div>} />
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<div>Admin Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("Admin Content")).toBeInTheDocument();
    expect(screen.queryByText("Home Page")).not.toBeInTheDocument();
  });
});
