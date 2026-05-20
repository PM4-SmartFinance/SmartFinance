import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { RegexHelper } from "./RegexHelper";

describe("RegexHelper", () => {
  it("shows the validity prompt for an empty pattern", () => {
    render(<RegexHelper pattern="" idSuffix="t" />);
    expect(screen.getByTestId("regex-validity-t")).toHaveTextContent(/type a pattern/i);
  });

  it("flags an invalid pattern", () => {
    render(<RegexHelper pattern="[invalid(" idSuffix="t" />);
    expect(screen.getByTestId("regex-validity-t")).toHaveTextContent(/invalid/i);
  });

  it("flags a catastrophic-backtracking pattern as slow", () => {
    render(<RegexHelper pattern="(a+)+b" idSuffix="t" />);
    expect(screen.getByTestId("regex-validity-t")).toHaveTextContent(/warning|slow|catastrophic/i);
  });

  it("renders a valid badge for a sane pattern", () => {
    render(<RegexHelper pattern="Migros.*Online" idSuffix="t" />);
    expect(screen.getByTestId("regex-validity-t")).toHaveTextContent(/valid pattern/i);
  });

  it("shows matches when the sample satisfies the pattern", async () => {
    const user = userEvent.setup();
    render(<RegexHelper pattern="Migros.*Online" idSuffix="t" />);

    await user.type(screen.getByLabelText(/test against/i), "Migros Bahnhof Online");

    expect(screen.getByTestId("regex-test-result-t")).toHaveTextContent(/matches/i);
  });

  it("shows no match when the sample does not satisfy the pattern", async () => {
    const user = userEvent.setup();
    render(<RegexHelper pattern="^Coop$" idSuffix="t" />);

    await user.type(screen.getByLabelText(/test against/i), "Coop City");

    expect(screen.getByTestId("regex-test-result-t")).toHaveTextContent(/no match/i);
  });

  it("matches case-insensitively (mirrors backend `i` flag)", async () => {
    const user = userEvent.setup();
    render(<RegexHelper pattern="migros" idSuffix="t" />);

    await user.type(screen.getByLabelText(/test against/i), "MIGROS");

    expect(screen.getByTestId("regex-test-result-t")).toHaveTextContent(/matches/i);
  });
});
