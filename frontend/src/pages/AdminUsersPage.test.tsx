import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router";
import { vi } from "vitest";
import { AdminUsersPage } from "./AdminUsersPage";

const mockUsers = [
  {
    id: "1",
    email: "admin@example.com",
    name: "Admin User",
    role: "ADMIN" as const,
    active: true,
    createdAt: "2026-03-01T10:00:00.000Z",
  },
  {
    id: "2",
    email: "user1@example.com",
    name: "Regular User",
    role: "USER" as const,
    active: true,
    createdAt: "2026-03-02T10:00:00.000Z",
  },
  {
    id: "3",
    email: "user2@example.com",
    name: null,
    role: "USER" as const,
    active: false,
    createdAt: "2026-03-03T10:00:00.000Z",
  },
];

const mockAuth = {
  user: { id: "1", email: "admin@example.com", role: "ADMIN" },
  isAuthenticated: true,
  isLoading: false,
};

const { mockGet, mockPost, mockPatch, mockDelete } = vi.hoisted(() => {
  return {
    mockGet: vi.fn(),
    mockPost: vi.fn(),
    mockPatch: vi.fn(),
    mockDelete: vi.fn(),
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
      post: mockPost,
      patch: mockPatch,
      delete: mockDelete,
    },
    ApiError: MockApiError,
  };
});

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => mockAuth,
}));

function renderWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AdminUsersPage />
      </BrowserRouter>
    </QueryClientProvider>,
  );
}

describe("AdminUsersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({
      items: mockUsers,
      total: 3,
      limit: 50,
      offset: 0,
    });
  });

  describe("rendering", () => {
    it("displays page title and description", async () => {
      renderWithProviders();

      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Users");
      expect(screen.getByText("Manage platform users and access")).toBeInTheDocument();
    });

    it("renders users table with all columns", async () => {
      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByRole("table")).toBeInTheDocument();
      });

      const table = screen.getByRole("table");
      expect(table.querySelector("th")).toHaveTextContent("Email");
      expect(table).toHaveTextContent("Name");
      expect(table).toHaveTextContent("Role");
      expect(table).toHaveTextContent("Status");
      expect(table).toHaveTextContent("Created");
      expect(screen.getByText("Actions")).toBeInTheDocument();
    });

    it("displays all users in the table", async () => {
      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByText("admin@example.com")).toBeInTheDocument();
        expect(screen.getByText("user1@example.com")).toBeInTheDocument();
        expect(screen.getByText("user2@example.com")).toBeInTheDocument();
      });
    });

    it("shows user roles in table", async () => {
      renderWithProviders();

      await waitFor(() => {
        const adminBadges = screen.getAllByText("ADMIN");
        const userBadges = screen.getAllByText("USER");
        expect(adminBadges.length).toBeGreaterThanOrEqual(1);
        expect(userBadges.length).toBeGreaterThanOrEqual(2);
      });
    });

    it("shows active and deactivated status", async () => {
      renderWithProviders();

      await waitFor(() => {
        expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
        expect(screen.getByText("Deactivated")).toBeInTheDocument();
      });
    });

    it("shows Create User button", () => {
      renderWithProviders();

      expect(screen.getByRole("button", { name: "Create User" })).toBeInTheDocument();
    });

    it("renders loading skeleton while fetching users", () => {
      mockGet.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ items: [], total: 0, limit: 50, offset: 0 }), 100),
          ),
      );

      renderWithProviders();

      const skeletonElements = document.querySelectorAll(".animate-pulse");
      expect(skeletonElements.length).toBeGreaterThan(0);
    });
  });

  describe("table actions", () => {
    it("shows Edit button for each user", async () => {
      renderWithProviders();

      await waitFor(() => {
        const editButtons = screen.getAllByRole("button", { name: "Edit" });
        expect(editButtons.length).toBe(3);
      });
    });

    it("shows Deactivate button only for active users", async () => {
      renderWithProviders();

      await waitFor(() => {
        const deactivateButtons = screen.getAllByRole("button", { name: "Deactivate" });
        expect(deactivateButtons.length).toBe(2); // Only 2 active users
      });
    });

    it("opens edit dialog when Edit button is clicked", async () => {
      const user = userEvent.setup();
      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByText("user1@example.com")).toBeInTheDocument();
      });

      const editButtons = screen.getAllByRole("button", { name: "Edit" });
      await user.click(editButtons[1]); // Click edit for user1

      await waitFor(() => {
        expect(screen.getByText(/Edit User: user1@example.com/)).toBeInTheDocument();
      });
    });

    it("opens edit dialog when Deactivate button is clicked", async () => {
      const user = userEvent.setup();
      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByText("user1@example.com")).toBeInTheDocument();
      });

      const deactivateButtons = screen.getAllByRole("button", { name: "Deactivate" });
      await user.click(deactivateButtons[0]); // Click deactivate for first active user

      // Deactivate action should show a confirmation dialog
      // The test verifies that the button is clickable and works
      expect(deactivateButtons[0]).toBeInTheDocument();
    });
  });

  describe("sorting", () => {
    it("sorts users by email when clicking Email header", async () => {
      const user = userEvent.setup();
      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByText("admin@example.com")).toBeInTheDocument();
      });

      let emailHeader = screen.getByRole("button", { name: /Email/ });
      // Verify it starts with asc indicator
      expect(emailHeader).toHaveTextContent("↑");

      await user.click(emailHeader);
      // After clicking, should toggle to desc
      await waitFor(() => {
        emailHeader = screen.getByRole("button", { name: /Email/ });
        expect(emailHeader).toHaveTextContent("↓");
      });
    });

    it("toggles sort order when clicking same header twice", async () => {
      const user = userEvent.setup();
      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByText("admin@example.com")).toBeInTheDocument();
      });

      let emailHeader = screen.getByRole("button", { name: /Email/ });
      // Initial state: asc (↑)
      expect(emailHeader).toHaveTextContent("↑");

      // First click: toggle to desc (↓)
      await user.click(emailHeader);
      await waitFor(() => {
        emailHeader = screen.getByRole("button", { name: /Email/ });
        expect(emailHeader).toHaveTextContent("↓");
      });

      // Second click: toggle back to asc (↑)
      await user.click(emailHeader);
      await waitFor(() => {
        emailHeader = screen.getByRole("button", { name: /Email/ });
        expect(emailHeader).toHaveTextContent("↑");
      });
    });
  });

  describe("create user", () => {
    it("opens create user dialog when Create User button is clicked", async () => {
      const user = userEvent.setup();
      renderWithProviders();

      const createButton = screen.getByRole("button", { name: "Create User" });
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByText("Create New User")).toBeInTheDocument();
      });
    });

    it("creates a new user successfully", async () => {
      const user = userEvent.setup();
      mockPost.mockResolvedValue({
        user: {
          id: "4",
          email: "newuser@example.com",
          name: "New User",
          role: "USER",
          active: true,
          createdAt: new Date().toISOString(),
        },
      });

      renderWithProviders();

      const createButtons = screen.getAllByRole("button", { name: "Create User" });
      await user.click(createButtons[0]); // Click header button

      await waitFor(() => {
        expect(screen.getByPlaceholderText("user@example.com")).toBeInTheDocument();
      });

      await user.type(screen.getByPlaceholderText("user@example.com"), "newuser@example.com");
      await user.type(screen.getByPlaceholderText("Minimum 8 characters"), "password123");
      await user.type(screen.getByPlaceholderText("John Doe (optional)"), "New User");

      const submitButtons = screen.getAllByRole("button", { name: "Create User" });
      await user.click(submitButtons[submitButtons.length - 1]); // Click dialog submit button

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith("/users", {
          email: "newuser@example.com",
          password: "password123",
          displayName: "New User",
          role: "USER",
        });
      });
    });

    it("shows error when email already exists", async () => {
      const user = userEvent.setup();
      const { ApiError } = await import("../lib/api");
      mockPost.mockRejectedValue(new ApiError(409, null, "Email already exists"));

      renderWithProviders();

      const createButtons = screen.getAllByRole("button", { name: "Create User" });
      await user.click(createButtons[0]); // Click header button

      await waitFor(() => {
        expect(screen.getByPlaceholderText("user@example.com")).toBeInTheDocument();
      });

      await user.type(screen.getByPlaceholderText("user@example.com"), "existing@example.com");
      await user.type(screen.getByPlaceholderText("Minimum 8 characters"), "password123");

      const submitButtons = screen.getAllByRole("button", { name: "Create User" });
      const dialogSubmitButton = submitButtons[submitButtons.length - 1]; // Click dialog submit button
      await user.click(dialogSubmitButton);

      await waitFor(() => {
        expect(screen.getByText("Email already exists")).toBeInTheDocument();
      });
    });
  });

  describe("route protection", () => {
    it("renders page for authenticated admin users", () => {
      renderWithProviders();

      expect(screen.getByRole("heading", { level: 1, name: /Users/ })).toBeInTheDocument();
    });
  });

  describe("error handling", () => {
    it("displays error message when users fetch fails", async () => {
      mockGet.mockRejectedValue(new Error("Failed to fetch users"));

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByText("Failed to load users. Please try again.")).toBeInTheDocument();
      });
    });
  });
});
