import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { RuleRow } from "./RuleRow";
import type { CategoryRule } from "../lib/queries/categories";

const apiGet = vi.fn();

vi.mock("../lib/api", () => ({
  api: { get: (...args: unknown[]) => apiGet(...args) },
}));

const baseRule: CategoryRule = {
  id: "rule-1",
  userId: "user-1",
  categoryId: "cat-1",
  pattern: "Migros",
  matchType: "contains",
  priority: 10,
  createdAt: "2026-05-20T00:00:00.000Z",
  updatedAt: "2026-05-20T00:00:00.000Z",
  isValid: true,
};

function renderRow(rule: CategoryRule) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <RuleRow
        rule={rule}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        isSaving={false}
        isDeleting={false}
      />
    </QueryClientProvider>,
  );
}

describe("RuleRow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiGet.mockResolvedValue({ conflicts: [] });
  });

  it("does not render the invalid-rule badge when isValid is true", () => {
    renderRow(baseRule);
    expect(screen.queryByTestId(`invalid-rule-badge-${baseRule.id}`)).not.toBeInTheDocument();
  });

  it("renders the invalid-rule badge when isValid is false", () => {
    renderRow({ ...baseRule, matchType: "regex", pattern: "[invalid(", isValid: false });
    const badge = screen.getByTestId(`invalid-rule-badge-${baseRule.id}`);
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent(/Invalid regex/i);
  });
});
