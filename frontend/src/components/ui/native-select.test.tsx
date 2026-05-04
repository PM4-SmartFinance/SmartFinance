import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { NativeSelect } from "./native-select";

describe("NativeSelect", () => {
  it("renders a select with provided options", () => {
    render(
      <NativeSelect aria-label="size">
        <option value="s">Small</option>
        <option value="m">Medium</option>
      </NativeSelect>,
    );
    expect(screen.getByRole("combobox", { name: "size" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Small" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Medium" })).toBeInTheDocument();
  });

  it("propagates onChange and value", async () => {
    const user = userEvent.setup();
    function Probe() {
      const [v, setV] = useState("a");
      return (
        <>
          <NativeSelect aria-label="letter" value={v} onChange={(e) => setV(e.target.value)}>
            <option value="a">A</option>
            <option value="b">B</option>
          </NativeSelect>
          <span data-testid="value">{v}</span>
        </>
      );
    }
    render(<Probe />);
    expect(screen.getByTestId("value")).toHaveTextContent("a");
    await user.selectOptions(screen.getByRole("combobox", { name: "letter" }), "b");
    expect(screen.getByTestId("value")).toHaveTextContent("b");
  });

  it("merges custom className with base classes", () => {
    render(
      <NativeSelect aria-label="x" className="w-40">
        <option value="1">1</option>
      </NativeSelect>,
    );
    const select = screen.getByRole("combobox", { name: "x" });
    expect(select.className).toContain("w-40");
    expect(select.className).toContain("border-input");
  });

  it("supports disabled prop", () => {
    render(
      <NativeSelect aria-label="x" disabled>
        <option value="1">1</option>
      </NativeSelect>,
    );
    expect(screen.getByRole("combobox", { name: "x" })).toBeDisabled();
  });
});
