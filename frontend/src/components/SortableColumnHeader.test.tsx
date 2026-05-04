import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SortableColumnHeader } from "./SortableColumnHeader";

function renderHeader(overrides: Partial<Parameters<typeof SortableColumnHeader<string>>[0]> = {}) {
  const props = {
    column: "email",
    label: "Email",
    sortBy: "email",
    sortOrder: "asc" as const,
    onSort: vi.fn(),
    ...overrides,
  };
  render(
    <table>
      <thead>
        <tr>
          <SortableColumnHeader {...props} />
        </tr>
      </thead>
    </table>,
  );
  return props;
}

describe("SortableColumnHeader", () => {
  it("renders the label", () => {
    renderHeader();
    expect(screen.getByRole("button", { name: /Email/ })).toBeInTheDocument();
  });

  it("shows ↑ when active and sortOrder is asc", () => {
    renderHeader();
    expect(screen.getByRole("button")).toHaveTextContent("↑");
  });

  it("shows ↓ when active and sortOrder is desc", () => {
    renderHeader({ sortOrder: "desc" });
    expect(screen.getByRole("button")).toHaveTextContent("↓");
  });

  it("hides the indicator when this column is not the active sort column", () => {
    renderHeader({ sortBy: "name" });
    const button = screen.getByRole("button", { name: "Email" });
    expect(button).not.toHaveTextContent("↑");
    expect(button).not.toHaveTextContent("↓");
  });

  it("calls onSort with the column key when clicked", async () => {
    const user = userEvent.setup();
    const props = renderHeader();
    await user.click(screen.getByRole("button", { name: /Email/ }));
    expect(props.onSort).toHaveBeenCalledWith("email");
  });

  it("right-aligns when align='right'", () => {
    renderHeader({ align: "right" });
    const th = screen.getByRole("columnheader");
    expect(th.className).toContain("text-right");
  });
});
