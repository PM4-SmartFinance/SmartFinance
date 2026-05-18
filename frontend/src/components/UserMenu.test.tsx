import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import i18n from "../lib/i18n";
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

  it("displays all supported language options in the menu", async () => {
    const user = userEvent.setup();
    render(<UserMenu />);

    await user.click(screen.getByRole("button", { name: "User menu" }));

    expect(await screen.findByText("English")).toBeInTheDocument();
    expect(screen.getByText("Deutsch")).toBeInTheDocument();
    expect(screen.getByText("Français")).toBeInTheDocument();
    expect(screen.getByText("Italiano")).toBeInTheDocument();
    expect(screen.getByText("Rumantsch")).toBeInTheDocument();
  });

  describe("language switching", () => {
    let changeSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      changeSpy = vi.spyOn(i18n, "changeLanguage");
    });

    afterEach(() => {
      changeSpy.mockRestore();
    });

    it("calls i18n.changeLanguage with the selected language code", async () => {
      const user = userEvent.setup();
      render(<UserMenu />);
      await user.click(screen.getByRole("button", { name: "User menu" }));

      await user.click(await screen.findByText("Deutsch"));

      await waitFor(() => {
        expect(changeSpy).toHaveBeenCalledWith("de");
      });
    });

    it("logs an error and does not throw when changeLanguage rejects", async () => {
      const rejection = new Error("network down");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      changeSpy.mockImplementation(() => Promise.reject(rejection) as any);
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const user = userEvent.setup();
      render(<UserMenu />);
      await user.click(screen.getByRole("button", { name: "User menu" }));

      await user.click(await screen.findByText("Français"));

      await waitFor(() => {
        expect(errorSpy).toHaveBeenCalledWith(
          expect.stringContaining('failed to switch language to "fr"'),
          rejection,
        );
      });

      errorSpy.mockRestore();
    });
  });
});
