import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { BackToDashboardLink } from "./BackToDashboardLink";

describe("BackToDashboardLink", () => {
  it("renders a link to the dashboard with the expected label", () => {
    render(
      <MemoryRouter>
        <BackToDashboardLink />
      </MemoryRouter>,
    );
    const link = screen.getByRole("link", { name: /Back to Dashboard/ });
    expect(link).toHaveAttribute("href", "/");
  });

  it("merges an optional className with the base classes", () => {
    render(
      <MemoryRouter>
        <BackToDashboardLink className="mt-4" />
      </MemoryRouter>,
    );
    const link = screen.getByRole("link", { name: /Back to Dashboard/ });
    expect(link.className).toContain("mt-4");
    expect(link.className).toContain("inline-flex");
  });
});
