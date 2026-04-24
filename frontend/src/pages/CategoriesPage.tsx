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
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { RuleRow } from "@/components/RuleRow";
import { NewRuleForm } from "@/components/NewRuleForm";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    if (error.status >= 400 && error.status < 500) return error.message;
    return fallback;
  }
  return fallback;
}

export function CategoriesPage() {
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [createCategoryError, setCreateCategoryError] = useState<string | null>(null);
  const [errorByCategory, setErrorByCategory] = useState<Record<string, string>>({});
  const [previewByCategory, setPreviewByCategory] = useState<Record<string, string>>({});

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

  async function handleCreateRule(
    categoryId: string,
    draft: { pattern: string; matchType: "exact" | "contains"; priority: number },
  ): Promise<boolean> {
    if (!draft.pattern.trim()) {
      setCategoryError(categoryId, "Rule pattern is required.");
      return false;
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
      setPreviewByCategory((prev) => ({ ...prev, [categoryId]: "" }));
      return true;
    } catch (error) {
      setCategoryError(categoryId, getErrorMessage(error, "Failed to create rule."));
      return false;
    }
  }

  async function handlePreviewRule(
    categoryId: string,
    draft: { pattern: string; matchType: "exact" | "contains"; priority: number },
  ) {
    if (!draft.pattern.trim()) {
      setCategoryError(categoryId, "Rule pattern is required for preview.");
      return;
    }

    setCategoryError(categoryId, null);
    setPreviewByCategory((prev) => ({ ...prev, [categoryId]: "" }));
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
          [categoryId]: "Match preview is not available yet.",
        }));
        return;
      }
      setCategoryError(categoryId, getErrorMessage(error, "Failed to preview rule matches."));
    }
  }

  async function handleSaveRule(
    rule: CategoryRule,
    draft: { pattern: string; matchType: "exact" | "contains"; priority: number },
  ) {
    if (!draft.pattern.trim()) {
      setCategoryError(rule.categoryId, "Rule pattern is required.");
      return;
    }

    setCategoryError(rule.categoryId, null);
    try {
      await updateRule.mutateAsync({
        id: rule.id,
        draft: {
          pattern: draft.pattern.trim(),
          matchType: draft.matchType,
          priority: draft.priority,
          categoryId: rule.categoryId,
        },
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

                          <NewRuleForm
                            categoryName={category.categoryName}
                            preview={previewByCategory[category.id] ?? ""}
                            onSubmit={(draft) => handleCreateRule(category.id, draft)}
                            onPreview={(draft) => handlePreviewRule(category.id, draft)}
                            isSubmitting={createRule.isPending}
                            isPreviewing={previewRule.isPending}
                          />

                          <div className="space-y-2">
                            <h3 className="text-sm font-semibold">Existing Rules</h3>
                            {categoryRules.length === 0 ? (
                              <p className="text-sm text-muted-foreground">No rules yet.</p>
                            ) : (
                              <ul className="space-y-2">
                                {categoryRules.map((rule) => (
                                  <RuleRow
                                    key={rule.id}
                                    rule={rule}
                                    onSave={(draft) => handleSaveRule(rule, draft)}
                                    onDelete={() => handleDeleteRule(rule.id, category.id)}
                                    isSaving={updateRule.isPending}
                                    isDeleting={deleteRule.isPending}
                                  />
                                ))}
                              </ul>
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
