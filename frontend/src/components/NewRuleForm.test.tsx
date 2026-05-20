import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { NewRuleForm } from "./NewRuleForm";

const apiGet = vi.fn();

vi.mock("../lib/api", () => ({
  api: { get: (...args: unknown[]) => apiGet(...args) },
}));

function renderForm(onSubmit = vi.fn(), onPreview = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return {
    onSubmit,
    onPreview,
    ...render(
      <QueryClientProvider client={queryClient}>
        <NewRuleForm
          categoryName="Groceries"
          preview={null}
          onSubmit={onSubmit}
          onPreview={onPreview}
          isSubmitting={false}
        />
      </QueryClientProvider>,
    ),
  };
}

describe("NewRuleForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiGet.mockResolvedValue({ conflicts: [] });
  });

  it("skips the overlap network call when matchType is 'regex'", async () => {
    const user = userEvent.setup();
    renderForm();

    // Switch to regex before typing so the overlap query is never enabled.
    const matchType = screen.getByLabelText("New rule match type for Groceries");
    await user.selectOptions(matchType, "regex");

    const pattern = screen.getByLabelText("New rule pattern for Groceries");
    await user.type(pattern, "Migros.*Online");

    await waitFor(() => {
      expect(screen.getByTestId("overlap-skipped-regex-new")).toBeInTheDocument();
    });

    const overlapCalls = apiGet.mock.calls.filter(([url]) =>
      String(url).includes("/category-rules/overlap"),
    );
    expect(overlapCalls).toHaveLength(0);
  });

  it("calls the overlap network call once for non-regex matchType (after debounce settles)", async () => {
    const user = userEvent.setup();
    renderForm();

    const pattern = screen.getByLabelText("New rule pattern for Groceries");
    await user.type(pattern, "Migros");

    await waitFor(() => {
      const overlapCalls = apiGet.mock.calls.filter(([url]) =>
        String(url).includes("/category-rules/overlap"),
      );
      expect(overlapCalls.length).toBeGreaterThan(0);
    });
  });

  it("renders the new regex option in the match-type select", () => {
    renderForm();
    const select = screen.getByLabelText("New rule match type for Groceries");
    expect(select).toHaveTextContent("regex");
  });
});
