import { useEffect, useMemo, useRef, useState } from "react";
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
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

interface RuleEditorState {
  pattern: string;
  matchType: "exact" | "contains";
  priority: number;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    if (error.status >= 400 && error.status < 500) return error.message;
    return fallback;
  }
  return fallback;
}

function formatDateId(dateId: number): string {
  const year = Math.trunc(dateId / 10000);
  const month = Math.trunc((dateId % 10000) / 100) - 1;
  const day = dateId % 100;
  return new Date(Date.UTC(year, month, day)).toLocaleDateString("de-CH");
}

export function CategoriesPage() {
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [createCategoryError, setCreateCategoryError] = useState<string | null>(null);
  const [errorByCategory, setErrorByCategory] = useState<Record<string, string>>({});
  const [previewByCategory, setPreviewByCategory] = useState<Record<string, string>>({});
  const [previewMatchesByCategory, setPreviewMatchesByCategory] = useState<
    Record<string, string[]>
  >({});
  const [previewErrorByCategory, setPreviewErrorByCategory] = useState<Record<string, string>>({});
  const [ruleDraftByCategory, setRuleDraftByCategory] = useState<Record<string, RuleEditorState>>(
    {},
  );
  const [ruleEditorById, setRuleEditorById] = useState<Record<string, RuleEditorState>>({});
  const previewTimerByCategoryRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const previewRequestVersionRef = useRef<Record<string, number>>({});

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

  const categorySections = useMemo(() => {
    const personal = categories
      .filter((category) => category.userId !== null)
      .sort((a, b) => a.categoryName.localeCompare(b.categoryName));
    const global = categories
      .filter((category) => category.userId === null)
      .sort((a, b) => a.categoryName.localeCompare(b.categoryName));

    return [
      {
        id: "personal",
        title: "Your Categories",
        description: "Editable categories you created.",
        categories: personal,
      },
      {
        id: "global",
        title: "Global Categories",
        description: "Shared defaults available to all users.",
        categories: global,
      },
    ];
  }, [categories]);

  function setCategoryError(categoryId: string, message: string | null) {
    setErrorByCategory((prev) => {
      if (message === null) {
        const next = { ...prev };
        delete next[categoryId];
        return next;
      }
      return { ...prev, [categoryId]: message };
    });
  }

  async function handleCreateCategory() {
    if (!newCategoryName.trim()) {
      setCreateCategoryError("Category name is required.");
      return;
    }

    setCreateCategoryError(null);
    try {
      await createCategory.mutateAsync(newCategoryName.trim());
      setNewCategoryName("");
    } catch (error) {
      setCreateCategoryError(getErrorMessage(error, "Failed to create category."));
    }
  }

  function handleStartCategoryEdit(category: Category) {
    setEditingCategoryId(category.id);
    setEditingCategoryName(category.categoryName);
    setCategoryError(category.id, null);
  }

  async function handleSaveCategoryEdit(categoryId: string) {
    if (!editingCategoryName.trim()) {
      setCategoryError(categoryId, "Category name is required.");
      return;
    }

    setCategoryError(categoryId, null);
    try {
      await updateCategory.mutateAsync({
        id: categoryId,
        categoryName: editingCategoryName.trim(),
      });
      setEditingCategoryId(null);
      setEditingCategoryName("");
    } catch (error) {
      setCategoryError(categoryId, getErrorMessage(error, "Failed to update category."));
    }
  }

  async function handleDeleteCategory(categoryId: string) {
    setCategoryError(categoryId, null);
    try {
      await deleteCategory.mutateAsync(categoryId);
    } catch (error) {
      setCategoryError(categoryId, getErrorMessage(error, "Failed to delete category."));
    }
  }

  function getRuleDraft(categoryId: string): RuleEditorState {
    return ruleDraftByCategory[categoryId] ?? { pattern: "", matchType: "contains", priority: 0 };
  }

  function setRuleDraft(categoryId: string, draft: RuleEditorState) {
    setRuleDraftByCategory((prev) => ({ ...prev, [categoryId]: draft }));
    scheduleLivePreview(categoryId, draft);
  }

  useEffect(() => {
    return () => {
      Object.values(previewTimerByCategoryRef.current).forEach((timerId) => {
        clearTimeout(timerId);
      });
    };
  }, []);

  function setPreviewError(categoryId: string, message: string | null) {
    setPreviewErrorByCategory((prev) => {
      if (message === null) {
        const next = { ...prev };
        delete next[categoryId];
        return next;
      }
      return { ...prev, [categoryId]: message };
    });
  }

  function scheduleLivePreview(categoryId: string, draft: RuleEditorState) {
    const existingTimer = previewTimerByCategoryRef.current[categoryId];
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    previewTimerByCategoryRef.current[categoryId] = setTimeout(() => {
      void handleLivePreviewRule(categoryId, draft);
    }, 300);
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
      setCategoryError(categoryId, "Rule pattern is required.");
      return;
    }

    setCategoryError(categoryId, null);
    const payload: RuleDraft = {
      categoryId,
      pattern: draft.pattern.trim(),
      matchType: draft.matchType,
      priority: Number.isNaN(draft.priority) ? 0 : draft.priority,
    };

    try {
      await createRule.mutateAsync(payload);
      setRuleDraftByCategory((prev) => ({
        ...prev,
        [categoryId]: { pattern: "", matchType: "contains", priority: 0 },
      }));
      setPreviewByCategory((prev) => ({ ...prev, [categoryId]: "" }));
      setPreviewMatchesByCategory((prev) => ({ ...prev, [categoryId]: [] }));
      setPreviewError(categoryId, null);
    } catch (error) {
      setCategoryError(categoryId, getErrorMessage(error, "Failed to create rule."));
    }
  }

  async function handleLivePreviewRule(categoryId: string, draft: RuleEditorState) {
    if (!draft.pattern.trim()) {
      setPreviewByCategory((prev) => ({ ...prev, [categoryId]: "" }));
      setPreviewError(categoryId, null);
      return;
    }

    setPreviewError(categoryId, null);
    const payload: RuleDraft = {
      categoryId,
      pattern: draft.pattern.trim(),
      matchType: draft.matchType,
      priority: Number.isNaN(draft.priority) ? 0 : draft.priority,
    };
    const requestVersion = (previewRequestVersionRef.current[categoryId] ?? 0) + 1;
    previewRequestVersionRef.current[categoryId] = requestVersion;

    try {
      const response = await previewRule.mutateAsync(payload);
      if (previewRequestVersionRef.current[categoryId] !== requestVersion) return;
      setPreviewByCategory((prev) => ({
        ...prev,
        [categoryId]: `${response.matchCount} existing transactions would match.`,
      }));
      setPreviewMatchesByCategory((prev) => ({
        ...prev,
        [categoryId]: (response.matchedTransactions ?? []).map((transaction) => {
          const amount = `${transaction.amount < 0 ? "−" : ""}CHF ${Math.abs(
            transaction.amount,
          ).toFixed(2)}`;
          return `${transaction.merchantName} · ${formatDateId(transaction.dateId)} · ${amount}`;
        }),
      }));
      setPreviewError(categoryId, null);
    } catch (error) {
      if (previewRequestVersionRef.current[categoryId] !== requestVersion) {
        return;
      }

      setPreviewByCategory((prev) => ({ ...prev, [categoryId]: "" }));
      setPreviewMatchesByCategory((prev) => ({ ...prev, [categoryId]: [] }));
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        setPreviewError(categoryId, error.message);
        return;
      }
      setPreviewError(categoryId, "Failed to preview rule matches.");
    }
  }

  async function handleSaveRule(rule: CategoryRule) {
    const editor = getRuleEditor(rule);
    if (!editor.pattern.trim()) {
      setCategoryError(rule.categoryId, "Rule pattern is required.");
      return;
    }

    setCategoryError(rule.categoryId, null);
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
      setCategoryError(rule.categoryId, getErrorMessage(error, "Failed to update rule."));
    }
  }

  async function handleDeleteRule(ruleId: string, categoryId: string) {
    setCategoryError(categoryId, null);
    try {
      await deleteRule.mutateAsync(ruleId);
    } catch (error) {
      setCategoryError(categoryId, getErrorMessage(error, "Failed to delete rule."));
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
          <Link
            to="/"
            className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to Dashboard
          </Link>
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

        {createCategoryError && (
          <p className="mb-4 text-sm text-destructive">{createCategoryError}</p>
        )}

        <div className="space-y-8">
          {categorySections.map((section) => (
            <section key={section.id} className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{section.title}</h2>
                <p className="text-sm text-muted-foreground">{section.description}</p>
              </div>

              {section.categories.length === 0 ? (
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">No categories in this section.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-6">
                  {section.categories.map((category) => {
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
                              <Button
                                aria-label={`Save category ${category.categoryName}`}
                                onClick={() => handleSaveCategoryEdit(category.id)}
                                size="sm"
                              >
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
                                    aria-label={`Edit category ${category.categoryName}`}
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleStartCategoryEdit(category)}
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    aria-label={`Delete category ${category.categoryName}`}
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
                          {errorByCategory[category.id] && (
                            <p className="text-xs text-destructive">
                              {errorByCategory[category.id]}
                            </p>
                          )}
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
                                          <Button
                                            aria-label={`Save rule ${rule.id}`}
                                            size="sm"
                                            onClick={() => handleSaveRule(rule)}
                                            disabled={updateRule.isPending}
                                          >
                                            Save
                                          </Button>
                                          <Button
                                            aria-label={`Delete rule ${rule.id}`}
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleDeleteRule(rule.id, category.id)}
                                            disabled={deleteRule.isPending}
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
                                  setRuleDraft(category.id, {
                                    ...draft,
                                    pattern: event.target.value,
                                  })
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
                                <Button
                                  size="sm"
                                  onClick={() => handleCreateRule(category.id)}
                                  disabled={createRule.isPending}
                                >
                                  Add Rule
                                </Button>
                              </div>
                            </div>
                            {previewByCategory[category.id] && (
                              <p className="mt-2 text-xs text-muted-foreground">
                                {previewByCategory[category.id]}
                              </p>
                            )}
                            {(previewMatchesByCategory[category.id]?.length ?? 0) > 0 && (
                              <div className="mt-2">
                                <p className="text-xs font-medium text-muted-foreground">
                                  Matching transactions:
                                </p>
                                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                                  {previewMatchesByCategory[category.id].map((name, index) => (
                                    <li key={`${name}-${index}`}>{name}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {previewErrorByCategory[category.id] && (
                              <p className="mt-2 text-xs text-destructive">
                                {previewErrorByCategory[category.id]}
                              </p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
