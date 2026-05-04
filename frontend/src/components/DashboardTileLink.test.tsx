import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { DashboardTileLink } from "./DashboardTileLink";

function renderTile(linkClassName?: string) {
  render(
    <MemoryRouter>
      <DashboardTileLink to="/budgets" ariaLabel="View budgets" linkClassName={linkClassName}>
        <p>tile content</p>
      </DashboardTileLink>
    </MemoryRouter>,
  );
}

describe("DashboardTileLink", () => {
  it("renders a Link with the correct href and accessible name", () => {
    renderTile();
    const link = screen.getByRole("link", { name: "View budgets" });
    expect(link).toHaveAttribute("href", "/budgets");
  });

  it("renders the provided children inside the card", () => {
    renderTile();
    expect(screen.getByText("tile content")).toBeInTheDocument();
  });

  it("applies the default column-span classes when no linkClassName is given", () => {
    renderTile();
    const link = screen.getByRole("link", { name: "View budgets" });
    expect(link.className).toContain("col-span-1");
    expect(link.className).toContain("sm:col-span-2");
    expect(link.className).toContain("lg:col-span-3");
  });

  it("respects a custom linkClassName override", () => {
    renderTile("col-span-2");
    const link = screen.getByRole("link", { name: "View budgets" });
    expect(link.className).toContain("col-span-2");
    expect(link.className).not.toContain("lg:col-span-3");
  });
});
