import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { NotFoundPage } from "./NotFoundPage";

function renderPage() {
  return render(
    <MemoryRouter>
      <NotFoundPage />
    </MemoryRouter>,
  );
}

describe("NotFoundPage", () => {
  it("shows the SmartFinance brand", () => {
    renderPage();
    expect(screen.getByText(/SmartFinance/i)).toBeInTheDocument();
  });

  it("renders the 404 heading", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: /404/i })).toBeInTheDocument();
  });

  it("renders a link back to the homepage", () => {
    renderPage();
    const link = screen.getByRole("link", { name: /homepage|home/i });
    expect(link).toHaveAttribute("href", "/");
  });

  it("centers content on the viewport", () => {
    renderPage();
    const main = screen.getByRole("main");
    expect(main.className).toMatch(/items-center/);
    expect(main.className).toMatch(/justify-center/);
  });
});
