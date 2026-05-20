import { useMemo, useState } from "react";
import { api, ApiError } from "../lib/api";
import {
  useCategories,
  useCategoryRules,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  useCreateCategoryRule,
  useUpdateCategoryRule,
  useDeleteCategoryRule,
  useAutoCategorize,
  useRecategorizeRange,
  type Category,
  type CategoryRule,
  type RuleDraft,
} from "../lib/queries/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RuleRow } from "@/components/RuleRow";
import { NewRuleForm } from "@/components/NewRuleForm";
import { BackToDashboardLink } from "@/components/BackToDashboardLink";
import { UserMenu } from "@/components/UserMenu";
import { formatDateId, formatAmount } from "@/lib/format";
import { useTranslation } from "react-i18next";

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
  const [previewByCategory, setPreviewByCategory] = useState<
    Record<string, { summary: string; lines: string[] }>
  >({});
  const [refreshHint, setRefreshHint] = useState(false);
  const onInvalidationFailure = () => setRefreshHint(true);
  const [recategorizeOpen, setRecategorizeOpen] = useState(false);
  const [recategorizeStart, setRecategorizeStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [recategorizeEnd, setRecategorizeEnd] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [actionResult, setActionResult] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const { t, i18n } = useTranslation();

  const {
    data: categories = [],
    isLoading: isCategoriesLoading,
    error: categoriesLoadError,
  } = useCategories();
  const { data: rules = [], isLoading: isRulesLoading, error: rulesLoadError } = useCategoryRules();

  const createCategory = useCreateCategory({ onInvalidationFailure });
  const updateCategory = useUpdateCategory({ onInvalidationFailure });
  const deleteCategory = useDeleteCategory({ onInvalidationFailure });
  const autoCategorize = useAutoCategorize({ onInvalidationFailure });
  const recategorize = useRecategorizeRange({ onInvalidationFailure });

  const createRule = useCreateCategoryRule({ onInvalidationFailure });
  const updateRule = useUpdateCategoryRule({ onInvalidationFailure });
  const deleteRule = useDeleteCategoryRule({ onInvalidationFailure });
  const [pendingRuleSaveId, setPendingRuleSaveId] = useState<string | null>(null);
  const [pendingRuleDeleteId, setPendingRuleDeleteId] = useState<string | null>(null);
  const rulesByCategory = useMemo(() => {
    return rules.reduce<Record<string, CategoryRule[]>>((acc, rule) => {
      const list = acc[rule.categoryId] ?? [];
      list.push(rule);
      acc[rule.categoryId] = list.toSorted((a, b) => a.priority - b.priority);
      return acc;
    }, {});
  }, [rules]);

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.categoryName.localeCompare(b.categoryName)),
    [categories],
  );

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
      setCreateCategoryError(t("categories.errors.nameRequired", "Category name is required."));
      return;
    }

    setCreateCategoryError(null);
    try {
      await createCategory.mutateAsync(newCategoryName.trim());
      setNewCategoryName("");
    } catch (error) {
      setCreateCategoryError(
        getErrorMessage(error, t("categories.errors.createFailed", "Failed to create category.")),
      );
    }
  }

  function handleStartCategoryEdit(category: Category) {
    setEditingCategoryId(category.id);
    setEditingCategoryName(category.categoryName);
    setCategoryError(category.id, null);
  }

  async function handleSaveCategoryEdit(categoryId: string) {
    if (!editingCategoryName.trim()) {
      setCategoryError(
        categoryId,
        t("categories.errors.nameRequired", "Category name is required."),
      );
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
      setCategoryError(
        categoryId,
        getErrorMessage(error, t("categories.errors.updateFailed", "Failed to update category.")),
      );
    }
  }

  async function handleDeleteCategory(categoryId: string) {
    setCategoryError(categoryId, null);
    try {
      await deleteCategory.mutateAsync(categoryId);
      setPreviewByCategory((prev) => {
        const next = { ...prev };
        delete next[categoryId];
        return next;
      });
    } catch (error) {
      setCategoryError(
        categoryId,
        getErrorMessage(error, t("categories.errors.deleteFailed", "Failed to delete category.")),
      );
    }
  }

  async function handleCreateRule(
    categoryId: string,
    draft: { pattern: string; matchType: "exact" | "contains" | "regex"; priority: number },
  ): Promise<boolean> {
    if (!draft.pattern.trim()) {
      setCategoryError(
        categoryId,
        t("categories.errors.rulePatternRequired", "Rule pattern is required."),
      );
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
      setPreviewByCategory((prev) => {
        const next = { ...prev };
        delete next[categoryId];
        return next;
      });
      return true;
    } catch (error) {
      setCategoryError(
        categoryId,
        getErrorMessage(error, t("categories.errors.createRuleFailed", "Failed to create rule.")),
      );
      return false;
    }
  }

  async function handlePreviewRule(
    categoryId: string,
    draft: { pattern: string; matchType: "exact" | "contains" | "regex"; priority: number },
  ) {
    if (!draft.pattern.trim()) {
      setPreviewByCategory((prev) => {
        const next = { ...prev };
        delete next[categoryId];
        return next;
      });
      return;
    }

    const payload: RuleDraft = {
      categoryId,
      pattern: draft.pattern.trim(),
      matchType: draft.matchType,
      priority: Number.isNaN(draft.priority) ? 0 : draft.priority,
    };

    try {
      const response = await api.post<{
        matchCount: number;
        matchedTransactions: Array<{
          id: string;
          merchantName: string;
          amount: number;
          dateId: number;
        }>;
      }>("/category-rules/preview", payload);

      const lines = (response.matchedTransactions ?? []).map((tx) => {
        const amount = formatAmount(tx.amount, i18n.resolvedLanguage);
        return `${tx.merchantName} · ${formatDateId(tx.dateId, i18n.resolvedLanguage)} · ${amount}`;
      });
      setPreviewByCategory((prev) => ({
        ...prev,
        [categoryId]: {
          summary: t("categories.matchCount", { count: response.matchCount }),
          lines,
        },
      }));
    } catch (error) {
      const msg =
        error instanceof ApiError && error.status >= 400 && error.status < 500
          ? error.message
          : t("categories.errors.previewFailed", "Failed to preview rule matches.");
      setPreviewByCategory((prev) => ({
        ...prev,
        [categoryId]: { summary: msg, lines: [] },
      }));
    }
  }

  async function handleSaveRule(
    rule: CategoryRule,
    draft: { pattern: string; matchType: "exact" | "contains" | "regex"; priority: number },
  ): Promise<boolean> {
    if (!draft.pattern.trim()) {
      setCategoryError(
        rule.categoryId,
        t("categories.errors.rulePatternRequired", "Rule pattern is required."),
      );
      return false;
    }

    setCategoryError(rule.categoryId, null);
    setPendingRuleSaveId(rule.id);
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
      return true;
    } catch (error) {
      setCategoryError(
        rule.categoryId,
        getErrorMessage(error, t("categories.errors.updateRuleFailed", "Failed to update rule.")),
      );
      return false;
    } finally {
      setPendingRuleSaveId(null);
    }
  }

  async function handleDeleteRule(ruleId: string, categoryId: string) {
    setCategoryError(categoryId, null);
    setPendingRuleDeleteId(ruleId);
    try {
      await deleteRule.mutateAsync(ruleId);
    } catch (error) {
      setCategoryError(
        categoryId,
        getErrorMessage(error, t("categories.errors.deleteRuleFailed", "Failed to delete rule.")),
      );
    } finally {
      setPendingRuleDeleteId(null);
    }
  }

  async function handleAutoCategorize() {
    setActionError(null);
    setActionResult(null);
    try {
      const { categorized } = await autoCategorize.mutateAsync();
      setActionResult(
        categorized === 0
          ? t("categories.autoCategorizeNone", "No uncategorized transactions matched any rule.")
          : t("categories.autoCategorizeSuccess", { count: categorized }),
      );
    } catch (error) {
      setActionError(
        getErrorMessage(
          error,
          t("categories.errors.autoCategorizeFailed", "Failed to run auto-categorization."),
        ),
      );
    }
  }

  async function handleRecategorize() {
    setActionError(null);
    setActionResult(null);
    if (recategorizeStart > recategorizeEnd) {
      setActionError(t("errors.invalidDateRange", "Start date must not be after end date."));
      return;
    }
    try {
      const { recategorized } = await recategorize.mutateAsync({
        startDate: recategorizeStart,
        endDate: recategorizeEnd,
      });
      setRecategorizeOpen(false);
      setActionResult(
        recategorized === 0
          ? t("categories.recategorizeNone", "No transactions changed in the selected range.")
          : t("categories.recategorizeSuccess", { count: recategorized }),
      );
    } catch (error) {
      setActionError(
        getErrorMessage(
          error,
          t("categories.errors.recategorizeFailed", "Failed to recategorize the selected range."),
        ),
      );
    }
  }

  if (isCategoriesLoading || isRulesLoading) {
    return (
      <main className="min-h-screen bg-background p-6">
        {t("categories.loading", "Loading categories and rules…")}
      </main>
    );
  }

  if (categoriesLoadError || rulesLoadError) {
    return (
      <main className="min-h-screen bg-background p-6">
        {t("categories.loadingError", "Failed to load categories or rules. Please refresh.")}
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {t("categories.title", "Categories & Rules")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t(
                "categories.description",
                "Manage your categories and auto-categorization rules in one place.",
              )}
            </p>
            <BackToDashboardLink className="mt-2" />
          </div>
          <UserMenu />
        </header>

        {refreshHint && (
          <div
            role="alert"
            className="mb-4 rounded border border-destructive bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            {t("categories.refreshHint", "Saved, but the dashboard may need a manual refresh.")}
            <button type="button" className="ml-2 underline" onClick={() => setRefreshHint(false)}>
              {t("common.dismiss", "Dismiss")}
            </button>
          </div>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t("categories.createCategoryTitle", "Create Category")}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-end gap-3">
            <div className="flex-1">
              <Label htmlFor="new-category">{t("common.name", "Name")}</Label>
              <Input
                id="new-category"
                value={newCategoryName}
                onChange={(event) => setNewCategoryName(event.target.value)}
                placeholder={t("categories.newCategoryPlaceholder", "e.g. Subscriptions")}
              />
            </div>
            <Button onClick={handleCreateCategory} disabled={createCategory.isPending}>
              {t("common.add", "Add")}
            </Button>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t("categories.applyRulesTitle", "Apply Rules")}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {t(
                "categories.applyRulesDescription",
                "Auto-categorize processes uncategorized transactions only. Recategorize re-applies every rule (highest priority first) to all non-manually-edited transactions in the selected range, overwriting prior auto-categorizations.",
              )}
            </p>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <Button onClick={handleAutoCategorize} disabled={autoCategorize.isPending}>
              {autoCategorize.isPending
                ? t("categories.autoCategorizing", "Auto-categorizing…")
                : t("categories.autoCategorizeBtn", "Auto-categorize uncategorized")}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setActionError(null);
                setActionResult(null);
                setRecategorizeOpen((open) => !open);
              }}
            >
              {recategorizeOpen
                ? t("common.cancel", "Cancel")
                : t("categories.recategorizeBtn", "Recategorize date range…")}
            </Button>
          </CardContent>
          {recategorizeOpen && (
            <CardContent className="flex flex-wrap items-end gap-3 border-t pt-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="recategorize-start" className="text-xs text-muted-foreground">
                  {t("categories.recategorizeFrom", "From")}
                </Label>
                <Input
                  id="recategorize-start"
                  type="date"
                  value={recategorizeStart}
                  onChange={(event) => setRecategorizeStart(event.target.value)}
                  className="w-44"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="recategorize-end" className="text-xs text-muted-foreground">
                  {t("categories.recategorizeTo", "To")}
                </Label>
                <Input
                  id="recategorize-end"
                  type="date"
                  value={recategorizeEnd}
                  onChange={(event) => setRecategorizeEnd(event.target.value)}
                  className="w-44"
                />
              </div>
              <Button onClick={handleRecategorize} disabled={recategorize.isPending}>
                {recategorize.isPending
                  ? t("categories.recategorizing", "Recategorizing…")
                  : t("common.run", "Run")}
              </Button>
            </CardContent>
          )}
          {actionResult && (
            <CardContent className="border-t pt-4">
              <p role="status" className="text-sm text-foreground">
                {actionResult}
              </p>
            </CardContent>
          )}
          {actionError && (
            <CardContent className="border-t pt-4">
              <p role="alert" className="text-sm text-destructive">
                {actionError}
              </p>
            </CardContent>
          )}
        </Card>

        {createCategoryError && (
          <p className="mb-4 text-sm text-destructive">{createCategoryError}</p>
        )}

        {sortedCategories.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">
                {t("categories.noCategories", "No categories yet.")}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {sortedCategories.map((category) => {
              const categoryRules = rulesByCategory[category.id] ?? [];

              return (
                <Card key={category.id}>
                  <CardHeader className="flex flex-row items-center justify-between gap-2">
                    {editingCategoryId === category.id ? (
                      <div className="flex w-full items-center gap-2">
                        <Input
                          aria-label={t("categories.aria.editCategory", "Edit category {{name}}", {
                            name: category.categoryName,
                          })}
                          value={editingCategoryName}
                          onChange={(event) => setEditingCategoryName(event.target.value)}
                        />
                        <Button
                          aria-label={t("categories.aria.saveCategory", "Save category {{name}}", {
                            name: category.categoryName,
                          })}
                          onClick={() => handleSaveCategoryEdit(category.id)}
                          size="sm"
                        >
                          {t("common.save", "Save")}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingCategoryId(null);
                            setEditingCategoryName("");
                          }}
                        >
                          {t("common.cancel", "Cancel")}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex w-full items-center justify-between gap-3">
                        <CardTitle className="text-base">{category.categoryName}</CardTitle>
                        <div className="flex items-center gap-2">
                          <Button
                            aria-label={t(
                              "categories.aria.editCategory",
                              "Edit category {{name}}",
                              { name: category.categoryName },
                            )}
                            variant="outline"
                            size="sm"
                            onClick={() => handleStartCategoryEdit(category)}
                          >
                            {t("common.edit", "Edit")}
                          </Button>
                          <Button
                            aria-label={t(
                              "categories.aria.deleteCategory",
                              "Delete category {{name}}",
                              { name: category.categoryName },
                            )}
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteCategory(category.id)}
                            disabled={deleteCategory.isPending}
                          >
                            {t("common.delete", "Delete")}
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {errorByCategory[category.id] && (
                      <p className="text-xs text-destructive">{errorByCategory[category.id]}</p>
                    )}

                    <NewRuleForm
                      categoryName={category.categoryName}
                      preview={previewByCategory[category.id] ?? null}
                      onSubmit={(draft) => handleCreateRule(category.id, draft)}
                      onPreview={(draft) => handlePreviewRule(category.id, draft)}
                      isSubmitting={createRule.isPending}
                    />

                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold">
                        {t("categories.existingRules", "Existing Rules")}
                      </h3>
                      {categoryRules.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          {t("categories.noRules", "No rules yet.")}
                        </p>
                      ) : (
                        <ul className="space-y-2">
                          {categoryRules.map((rule) => (
                            <RuleRow
                              key={rule.id}
                              rule={rule}
                              onSave={(draft) => handleSaveRule(rule, draft)}
                              onDelete={() => handleDeleteRule(rule.id, category.id)}
                              isSaving={pendingRuleSaveId === rule.id}
                              isDeleting={pendingRuleDeleteId === rule.id}
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
      </div>
    </main>
  );
}
