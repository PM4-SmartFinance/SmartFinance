import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UserMenu } from "./UserMenu";
import { useAppStore } from "../store/appStore";

const authState = vi.hoisted(() => ({
  user: { id: "1", email: "test@example.com", role: "USER" } as {
    id: string;
    email: string;
    role: string;
  } | null,
}));

const logoutState = vi.hoisted(() => ({
  mutate: vi.fn(),
  isPending: false,
}));

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({
    user: authState.user,
    isAuthenticated: !!authState.user,
    isLoading: false,
  }),
}));

vi.mock("../hooks/useLogout", () => ({
  useLogout: () => ({ mutate: logoutState.mutate, isPending: logoutState.isPending }),
}));

describe("UserMenu", () => {
  beforeEach(() => {
    authState.user = { id: "1", email: "test@example.com", role: "USER" };
    logoutState.mutate = vi.fn();
    logoutState.isPending = false;
    useAppStore.setState({ theme: "system" });
    document.documentElement.classList.remove("dark");
  });

  it("renders the avatar trigger with initials", () => {
    render(<UserMenu />);
    expect(screen.getByRole("button", { name: "User menu" })).toBeInTheDocument();
    expect(screen.getByText("TE")).toBeInTheDocument();
  });

  it("returns null when no user is authenticated", () => {
    authState.user = null;
    const { container } = render(<UserMenu />);
    expect(container.firstChild).toBeNull();
  });

  it("opens the menu and shows email, theme options, and Sign out", async () => {
    const user = userEvent.setup();
    render(<UserMenu />);
    await user.click(screen.getByRole("button", { name: "User menu" }));
    expect(await screen.findByText("test@example.com")).toBeInTheDocument();
    expect(screen.getByText("Light")).toBeInTheDocument();
    expect(screen.getByText("Dark")).toBeInTheDocument();
    expect(screen.getByText("System")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /sign out/i })).toBeInTheDocument();
  });

  it("updates the store theme when a radio item is selected", async () => {
    const user = userEvent.setup();
    render(<UserMenu />);
    await user.click(screen.getByRole("button", { name: "User menu" }));
    await user.click(await screen.findByText("Dark"));
    expect(useAppStore.getState().theme).toBe("dark");
  });

  it("calls logout when Sign out is clicked", async () => {
    const user = userEvent.setup();
    render(<UserMenu />);
    await user.click(screen.getByRole("button", { name: "User menu" }));
    await user.click(await screen.findByRole("menuitem", { name: /sign out/i }));
    expect(logoutState.mutate).toHaveBeenCalledTimes(1);
  });

  it("renders 'Signing out…' label and disables Sign out while logout is pending", async () => {
    logoutState.isPending = true;
    const user = userEvent.setup();
    render(<UserMenu />);
    await user.click(screen.getByRole("button", { name: "User menu" }));
    const signOut = await screen.findByRole("menuitem", { name: /signing out/i });
    expect(signOut).toBeInTheDocument();

    await user.click(signOut);
    expect(logoutState.mutate).not.toHaveBeenCalled();
  });
});
