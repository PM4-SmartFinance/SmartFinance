import { useMemo, useState } from "react";
import { ApiError } from "../lib/api";
import {
  useCategories,
  useCategoryRules,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  useCreateCategoryRule,
  useUpdateCategoryRule,
  useDeleteCategoryRule,
  useRuleMatchPreview,
  type Category,
  type CategoryRule,
  type RuleDraft,
} from "../lib/queries/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RuleEditorState {
  pattern: string;
  matchType: "exact" | "contains";
  priority: number;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

function getInitialRuleState(categoryId: string): Record<string, RuleEditorState> {
  return {
    [categoryId]: { pattern: "", matchType: "contains", priority: 0 },
  };
}

export function CategoriesPage() {
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [ruleError, setRuleError] = useState<string | null>(null);
  const [previewByCategory, setPreviewByCategory] = useState<Record<string, string>>({});
  const [ruleDraftByCategory, setRuleDraftByCategory] = useState<Record<string, RuleEditorState>>(
    {},
  );
  const [ruleEditorById, setRuleEditorById] = useState<Record<string, RuleEditorState>>({});

  const {
    data: categories = [],
    isLoading: isCategoriesLoading,
    error: categoriesLoadError,
  } = useCategories();
  const { data: rules = [], isLoading: isRulesLoading, error: rulesLoadError } = useCategoryRules();

  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const createRule = useCreateCategoryRule();
  const updateRule = useUpdateCategoryRule();
  const deleteRule = useDeleteCategoryRule();
  const previewRule = useRuleMatchPreview();

  const rulesByCategory = useMemo(() => {
    return rules.reduce<Record<string, CategoryRule[]>>((acc, rule) => {
      const list = acc[rule.categoryId] ?? [];
      list.push(rule);
      acc[rule.categoryId] = list.sort((a, b) => a.priority - b.priority);
      return acc;
    }, {});
  }, [rules]);

  async function handleCreateCategory() {
    if (!newCategoryName.trim()) {
      setCategoryError("Category name is required.");
      return;
    }

    setCategoryError(null);
    try {
      await createCategory.mutateAsync(newCategoryName.trim());
      setNewCategoryName("");
    } catch (error) {
      setCategoryError(getErrorMessage(error, "Failed to create category."));
    }
  }

  function handleStartCategoryEdit(category: Category) {
    setEditingCategoryId(category.id);
    setEditingCategoryName(category.categoryName);
    setCategoryError(null);
  }

  async function handleSaveCategoryEdit(categoryId: string) {
    if (!editingCategoryName.trim()) {
      setCategoryError("Category name is required.");
      return;
    }

    setCategoryError(null);
    try {
      await updateCategory.mutateAsync({
        id: categoryId,
        categoryName: editingCategoryName.trim(),
      });
      setEditingCategoryId(null);
      setEditingCategoryName("");
    } catch (error) {
      setCategoryError(getErrorMessage(error, "Failed to update category."));
    }
  }

  async function handleDeleteCategory(categoryId: string) {
    setCategoryError(null);
    try {
      await deleteCategory.mutateAsync(categoryId);
    } catch (error) {
      setCategoryError(getErrorMessage(error, "Failed to delete category."));
    }
  }

  function getRuleDraft(categoryId: string): RuleEditorState {
    return ruleDraftByCategory[categoryId] ?? { pattern: "", matchType: "contains", priority: 0 };
  }

  function setRuleDraft(categoryId: string, draft: RuleEditorState) {
    setRuleDraftByCategory((prev) => ({ ...prev, [categoryId]: draft }));
  }

  function getRuleEditor(rule: CategoryRule): RuleEditorState {
    return (
      ruleEditorById[rule.id] ?? {
        pattern: rule.pattern,
        matchType: rule.matchType,
        priority: rule.priority,
      }
    );
  }

  function setRuleEditor(ruleId: string, editor: RuleEditorState) {
    setRuleEditorById((prev) => ({ ...prev, [ruleId]: editor }));
  }

  async function handleCreateRule(categoryId: string) {
    const draft = getRuleDraft(categoryId);
    if (!draft.pattern.trim()) {
      setRuleError("Rule pattern is required.");
      return;
    }

    setRuleError(null);
    const payload: RuleDraft = {
      categoryId,
      pattern: draft.pattern.trim(),
      matchType: draft.matchType,
      priority: Number.isNaN(draft.priority) ? 0 : draft.priority,
    };

    try {
      await createRule.mutateAsync(payload);
      setRuleDraftByCategory((prev) => ({ ...prev, ...getInitialRuleState(categoryId) }));
      setPreviewByCategory((prev) => ({ ...prev, [categoryId]: "" }));
    } catch (error) {
      setRuleError(getErrorMessage(error, "Failed to create rule."));
    }
  }

  async function handlePreviewRule(categoryId: string) {
    const draft = getRuleDraft(categoryId);
    if (!draft.pattern.trim()) {
      setRuleError("Rule pattern is required for preview.");
      return;
    }

    setRuleError(null);
    const payload: RuleDraft = {
      categoryId,
      pattern: draft.pattern.trim(),
      matchType: draft.matchType,
      priority: Number.isNaN(draft.priority) ? 0 : draft.priority,
    };

    try {
      const response = await previewRule.mutateAsync(payload);
      setPreviewByCategory((prev) => ({
        ...prev,
        [categoryId]: `${response.matchCount} existing transactions would match.`,
      }));
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setPreviewByCategory((prev) => ({
          ...prev,
          [categoryId]: "Preview endpoint is not available yet.",
        }));
        return;
      }
      setRuleError(getErrorMessage(error, "Failed to preview rule matches."));
    }
  }

  async function handleSaveRule(rule: CategoryRule) {
    setRuleError(null);
    const editor = getRuleEditor(rule);
    try {
      await updateRule.mutateAsync({
        id: rule.id,
        draft: {
          pattern: editor.pattern.trim(),
          matchType: editor.matchType,
          priority: editor.priority,
          categoryId: rule.categoryId,
        },
      });
      setRuleEditorById((prev) => {
        const next = { ...prev };
        delete next[rule.id];
        return next;
      });
    } catch (error) {
      setRuleError(getErrorMessage(error, "Failed to update rule."));
    }
  }

  async function handleDeleteRule(ruleId: string) {
    setRuleError(null);
    try {
      await deleteRule.mutateAsync(ruleId);
    } catch (error) {
      setRuleError(getErrorMessage(error, "Failed to delete rule."));
    }
  }

  if (isCategoriesLoading || isRulesLoading) {
    return <main className="min-h-screen bg-background p-6">Loading categories and rules…</main>;
  }

  if (categoriesLoadError || rulesLoadError) {
    return (
      <main className="min-h-screen bg-background p-6">
        Failed to load categories or rules. Please refresh.
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Categories & Rules</h1>
          <p className="text-sm text-muted-foreground">
            Manage your categories and auto-categorization rules in one place.
          </p>
        </header>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Create Category</CardTitle>
          </CardHeader>
          <CardContent className="flex items-end gap-3">
            <div className="flex-1">
              <Label htmlFor="new-category">Name</Label>
              <Input
                id="new-category"
                value={newCategoryName}
                onChange={(event) => setNewCategoryName(event.target.value)}
                placeholder="e.g. Subscriptions"
              />
            </div>
            <Button onClick={handleCreateCategory} disabled={createCategory.isPending}>
              Add
            </Button>
          </CardContent>
        </Card>

        {categoryError && <p className="mb-4 text-sm text-destructive">{categoryError}</p>}
        {ruleError && <p className="mb-4 text-sm text-destructive">{ruleError}</p>}

        <div className="space-y-6">
          {categories.map((category) => {
            const categoryRules = rulesByCategory[category.id] ?? [];
            const draft = getRuleDraft(category.id);
            const isGlobal = category.userId === null;

            return (
              <Card key={category.id}>
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  {editingCategoryId === category.id ? (
                    <div className="flex w-full items-center gap-2">
                      <Input
                        aria-label={`Edit category ${category.categoryName}`}
                        value={editingCategoryName}
                        onChange={(event) => setEditingCategoryName(event.target.value)}
                      />
                      <Button onClick={() => handleSaveCategoryEdit(category.id)} size="sm">
                        Save
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingCategoryId(null);
                          setEditingCategoryName("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="flex w-full items-center justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">{category.categoryName}</CardTitle>
                        {isGlobal && (
                          <p className="text-xs text-muted-foreground">
                            Global category (read-only)
                          </p>
                        )}
                      </div>
                      {!isGlobal && (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStartCategoryEdit(category)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteCategory(category.id)}
                            disabled={deleteCategory.isPending}
                          >
                            Delete
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Rules</h3>
                    {categoryRules.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No rules yet.</p>
                    ) : (
                      <ul className="space-y-2">
                        {categoryRules.map((rule) => {
                          const editor = getRuleEditor(rule);

                          return (
                            <li key={rule.id} className="rounded border p-3">
                              <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                                <Input
                                  aria-label={`Rule pattern ${rule.id}`}
                                  value={editor.pattern}
                                  onChange={(event) => {
                                    setRuleEditor(rule.id, {
                                      ...editor,
                                      pattern: event.target.value,
                                    });
                                  }}
                                />
                                <select
                                  aria-label={`Rule match type ${rule.id}`}
                                  className="rounded border border-input bg-background px-3 py-2 text-sm"
                                  value={editor.matchType}
                                  onChange={(event) => {
                                    setRuleEditor(rule.id, {
                                      ...editor,
                                      matchType: event.target.value as "exact" | "contains",
                                    });
                                  }}
                                >
                                  <option value="contains">contains</option>
                                  <option value="exact">exact</option>
                                </select>
                                <Input
                                  aria-label={`Rule priority ${rule.id}`}
                                  type="number"
                                  value={editor.priority}
                                  onChange={(event) => {
                                    setRuleEditor(rule.id, {
                                      ...editor,
                                      priority: Number(event.target.value || 0),
                                    });
                                  }}
                                />
                                <div className="flex gap-2">
                                  <Button size="sm" onClick={() => handleSaveRule(rule)}>
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleDeleteRule(rule.id)}
                                  >
                                    Delete
                                  </Button>
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  <div className="rounded border p-3">
                    <h4 className="mb-2 text-sm font-semibold">New Rule</h4>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                      <Input
                        aria-label={`New rule pattern for ${category.categoryName}`}
                        placeholder="Pattern"
                        value={draft.pattern}
                        onChange={(event) =>
                          setRuleDraft(category.id, { ...draft, pattern: event.target.value })
                        }
                      />
                      <select
                        aria-label={`New rule match type for ${category.categoryName}`}
                        className="rounded border border-input bg-background px-3 py-2 text-sm"
                        value={draft.matchType}
                        onChange={(event) =>
                          setRuleDraft(category.id, {
                            ...draft,
                            matchType: event.target.value as "exact" | "contains",
                          })
                        }
                      >
                        <option value="contains">contains</option>
                        <option value="exact">exact</option>
                      </select>
                      <Input
                        aria-label={`New rule priority for ${category.categoryName}`}
                        type="number"
                        placeholder="Priority"
                        value={draft.priority}
                        onChange={(event) =>
                          setRuleDraft(category.id, {
                            ...draft,
                            priority: Number(event.target.value || 0),
                          })
                        }
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleCreateRule(category.id)}>
                          Add Rule
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePreviewRule(category.id)}
                        >
                          Match Preview
                        </Button>
                      </div>
                    </div>
                    {previewByCategory[category.id] && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {previewByCategory[category.id]}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </main>
  );
}
