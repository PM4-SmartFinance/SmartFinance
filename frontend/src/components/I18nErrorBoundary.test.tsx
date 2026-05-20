import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { I18nErrorBoundary } from "./I18nErrorBoundary";

function Throw({ message }: { message: string }) {
  throw new Error(message);
}

describe("I18nErrorBoundary", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  afterEach(() => {
    errorSpy?.mockRestore();
  });

  it("renders children when no error", () => {
    render(
      <I18nErrorBoundary>
        <p>Healthy child</p>
      </I18nErrorBoundary>,
    );
    expect(screen.getByText("Healthy child")).toBeInTheDocument();
  });

  it("renders the alert when a child throws", () => {
    // Suppress React's console.error from the boundary's componentDidCatch
    // path so the test output stays clean.
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <I18nErrorBoundary>
        <Throw message="locales/de/translation.json: 404" />
      </I18nErrorBoundary>,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Failed to load translations.");
    expect(alert).toHaveTextContent("locales/de/translation.json: 404");
  });

  it("exposes a Retry button that reloads the page", () => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const reloadSpy = vi.fn();
    const original = globalThis.location;
    Object.defineProperty(globalThis, "location", {
      configurable: true,
      value: { ...original, reload: reloadSpy },
    });

    render(
      <I18nErrorBoundary>
        <Throw message="boom" />
      </I18nErrorBoundary>,
    );

    const retry = screen.getByRole("button", { name: /retry/i });
    retry.click();
    expect(reloadSpy).toHaveBeenCalledTimes(1);

    Object.defineProperty(globalThis, "location", { configurable: true, value: original });
  });

  it("offers a homepage escape hatch when reload keeps failing", () => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <I18nErrorBoundary>
        <Throw message="boom" />
      </I18nErrorBoundary>,
    );

    const home = screen.getByRole("link", { name: /go to homepage/i });
    expect(home).toHaveAttribute("href", "/");
  });

  it("logs the error via componentDidCatch", () => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <I18nErrorBoundary>
        <Throw message="boom" />
      </I18nErrorBoundary>,
    );

    // React logs its own componentDidCatch trace plus our boundary's log.
    // Asserting any call with the boundary's prefix is enough to prove the
    // logger ran.
    const calls = errorSpy.mock.calls.flat().map(String);
    expect(calls.some((c) => c.includes("[i18n] Translation load failed"))).toBe(true);
  });
});
