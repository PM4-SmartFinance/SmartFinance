import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { ModulePage } from "./ModulePage";
import { api } from "../lib/api";

vi.mock("../lib/api", () => ({
  api: { get: vi.fn() },
  ApiError: class MockApiError extends Error {
    status: number;
    body: unknown;
    constructor(status: number, body: unknown, message: string) {
      super(message);
      this.status = status;
      this.body = body;
    }
  },
}));

vi.mock("../hooks/useAuth", () => ({
  useAuth: vi.fn().mockReturnValue({
    user: { id: "u1", email: "test@example.com", role: "USER" },
    isAuthenticated: true,
    isLoading: false,
  }),
}));

vi.mock("../hooks/useLogout", async () => {
  const { logoutMockFactory } = await import("../test/authFixtures");
  return logoutMockFactory();
});

const mockGet = vi.mocked(api.get);

function renderPage(moduleId = "savings-goals") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/modules/${moduleId}`]}>
        <Routes>
          <Route path="/modules/:moduleId" element={<ModulePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGet.mockImplementation((path: string) => {
    if (path === "/modules/nav-items") {
      return Promise.resolve({
        navItems: [
          { moduleId: "savings-goals", label: "Savings Goals", path: "/modules/savings-goals" },
        ],
      });
    }
    if (path === "/modules/widgets") {
      return Promise.resolve({
        widgets: [
          {
            moduleId: "savings-goals",
            widgetId: "savings-goals-summary",
            title: "Savings Goals",
            dataEndpoint: "/modules/savings-goals/goals/widget",
          },
        ],
      });
    }
    if (path === "/modules/savings-goals/goals/widget") {
      return Promise.resolve({ items: [], emptyMessage: "No goals yet." });
    }
    return Promise.resolve({});
  });
});

describe("ModulePage", () => {
  it("renders the module name from nav-items as the page heading", async () => {
    renderPage("savings-goals");
    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1, name: "Savings Goals" })).toBeInTheDocument(),
    );
  });

  it("falls back to the moduleId as heading when nav-items is not loaded", async () => {
    mockGet.mockImplementation((path: string) => {
      if (path === "/modules/nav-items") return new Promise(() => {});
      if (path === "/modules/widgets") return Promise.resolve({ widgets: [] });
      return Promise.resolve({});
    });
    renderPage("savings-goals");
    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1, name: "savings-goals" })).toBeInTheDocument(),
    );
  });

  it("renders a link back to the dashboard", async () => {
    renderPage("savings-goals");
    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/");
    });
  });

  it("renders only widgets belonging to the current moduleId", async () => {
    mockGet.mockImplementation((path: string) => {
      if (path === "/modules/nav-items") {
        return Promise.resolve({ navItems: [] });
      }
      if (path === "/modules/widgets") {
        return Promise.resolve({
          widgets: [
            {
              moduleId: "savings-goals",
              widgetId: "sg-summary",
              title: "Savings Goals",
              dataEndpoint: "/modules/savings-goals/goals/widget",
            },
            {
              moduleId: "other-module",
              widgetId: "other-widget",
              title: "Other Widget",
              dataEndpoint: "/modules/other-module/data",
            },
          ],
        });
      }
      return Promise.resolve({ items: [] });
    });

    renderPage("savings-goals");

    await waitFor(() => expect(screen.getByText("Savings Goals")).toBeInTheDocument());
    expect(screen.queryByText("Other Widget")).not.toBeInTheDocument();
  });

  it("shows the no-widgets message when the module has no registered widgets", async () => {
    mockGet.mockImplementation((path: string) => {
      if (path === "/modules/nav-items")
        return Promise.resolve({
          navItems: [{ moduleId: "empty-mod", label: "Empty Module", path: "/modules/empty-mod" }],
        });
      if (path === "/modules/widgets") return Promise.resolve({ widgets: [] });
      return Promise.resolve({});
    });
    renderPage("empty-mod");
    await waitFor(() =>
      expect(screen.getByText("This module has no dashboard widgets.")).toBeInTheDocument(),
    );
  });

  it("shows an error message when the widgets query fails", async () => {
    mockGet.mockImplementation((path: string) => {
      if (path === "/modules/nav-items") return Promise.resolve({ navItems: [] });
      if (path === "/modules/widgets") return Promise.reject(new Error("network error"));
      return Promise.resolve({});
    });
    renderPage("savings-goals");
    await waitFor(() =>
      expect(screen.getByText("Failed to load module data.")).toBeInTheDocument(),
    );
  });
});
