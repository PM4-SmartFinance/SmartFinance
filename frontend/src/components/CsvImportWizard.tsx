import { Fragment, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "../lib/api";
import { DASHBOARD_QUERY_KEY } from "../lib/queries/dashboard";
import { useAccounts, useCreateAccount } from "../lib/queries/accounts";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

const QUERY_KEYS_TO_INVALIDATE_AFTER_IMPORT = [
  ["budgets"],
  DASHBOARD_QUERY_KEY,
  ["transactions"],
] as const;

// Sentinels for the two mapping-driven format options. Real bank formats use
// their own value; both sentinels resolve to `format=custom` on import.
const SAVED = "__saved__";
const CUSTOM = "__custom__";

type UploadResult = { imported: number };

interface ImportFormatsResponse {
  formats: { value: string; label: string }[];
}

// Mirrors the backend `ColumnMapping` contract (KAN-163). Values are header
// names from the detected columns; the backend supports only these canonical
// fields (no currency / value-date / IBAN), so the UI offers exactly these.
type DateFormat = "iso" | "dmy-dot" | "dmy-dash" | "dmy-slash";

interface ColumnMapping {
  date: string;
  description: string;
  amount?: string;
  debit?: string;
  credit?: string;
  subject?: string;
  dateFormat?: DateFormat;
}

interface DetectResult {
  detectedFormat: string | null;
  confidence: number;
  columns: string[];
  headerSignature: string;
  sampleRow: string[];
  savedMapping: ColumnMapping | null;
  suggestedAccountId: string | null;
}

// Preview-only helpers mirroring the backend generic parser's per-row transform
// (backend/src/services/importers/generic.parser.ts). They drive the live
// "imported as" preview; the backend remains the source of truth on import.
function previewToIso(raw: string, format: DateFormat): string | null {
  let m: RegExpMatchArray | null;
  switch (format) {
    case "iso":
      m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
    case "dmy-dot":
      m = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
      return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
    case "dmy-dash":
      m = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
      return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
    case "dmy-slash":
      m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
  }
}

function previewDate(raw: string, format?: DateFormat): string {
  if (!raw) return "";
  const formats: DateFormat[] = format ? [format] : ["iso", "dmy-dot", "dmy-dash", "dmy-slash"];
  for (const f of formats) {
    const iso = previewToIso(raw, f);
    if (iso) return iso;
  }
  return raw;
}

function previewAmount(raw: string): string {
  if (!raw) return "";
  let s = raw.replace(/['\s]/g, "");
  if (s.includes(",") && !s.includes(".")) s = s.replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? String(n) : raw;
}

// Assembles a backend-ready ColumnMapping from the form draft, or null when a
// required field is unset. Pure, so it gates the Import button and the submit
// handler from one source of truth.
function buildColumnMapping(
  draft: ColumnMapping,
  amountMode: "single" | "split",
): ColumnMapping | null {
  if (!draft.date || !draft.description) return null;
  const result: ColumnMapping = { date: draft.date, description: draft.description };
  if (amountMode === "single") {
    if (!draft.amount) return null;
    result.amount = draft.amount;
  } else {
    if (!draft.debit || !draft.credit) return null;
    result.debit = draft.debit;
    result.credit = draft.credit;
  }
  if (draft.subject) result.subject = draft.subject;
  if (draft.dateFormat) result.dateFormat = draft.dateFormat;
  return result;
}

interface Props {
  file: File;
  onClose: () => void;
  onImported: (result: { imported: number; refreshHint: boolean }) => void;
}

/**
 * Modal that opens when a CSV is dropped (KAN-163). On open it asks the backend
 * to sniff the file, then pre-fills an editable Format and Account dropdown from
 * the detection result; a manual column-mapping step covers files the backend
 * can't auto-detect, and an inline create-account form covers users with no
 * account yet.
 */
export function CsvImportWizard({ file, onClose, onImported }: Props) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const [format, setFormat] = useState<string>("");
  const [accountId, setAccountId] = useState<string>("");
  const [columns, setColumns] = useState<string[]>([]);
  const [sampleRow, setSampleRow] = useState<string[]>([]);
  const [savedMapping, setSavedMapping] = useState<ColumnMapping | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({ date: "", description: "" });
  const [amountMode, setAmountMode] = useState<"single" | "split">("single");
  const [mappingError, setMappingError] = useState<string | null>(null);

  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountIban, setNewAccountIban] = useState("");
  const [createAccountError, setCreateAccountError] = useState<string | null>(null);

  const { data: accounts, isLoading: accountsLoading } = useAccounts();
  const activeAccounts = (accounts ?? []).filter((a) => a.active);
  const { mutateAsync: createAccount, isPending: isCreatingAccount } = useCreateAccount();

  const { data: formatsData } = useQuery({
    queryKey: ["import-formats"],
    queryFn: () => api.get<ImportFormatsResponse>("/transactions/import/formats"),
  });
  const formats = formatsData?.formats ?? [];

  const {
    mutate: runDetect,
    isPending: isDetecting,
    isError: detectFailed,
  } = useMutation({
    mutationFn: (f: File) => {
      const formData = new FormData();
      formData.append("file", f);
      return api.upload<DetectResult>("/transactions/import/detect", formData);
    },
    onSuccess: (data) => {
      setColumns(Array.isArray(data.columns) ? data.columns : []);
      setSampleRow(Array.isArray(data.sampleRow) ? data.sampleRow : []);
      setSavedMapping(data.savedMapping);

      if (data.detectedFormat) {
        setFormat(data.detectedFormat);
      } else if (data.savedMapping) {
        setFormat(SAVED);
        setMapping({ ...data.savedMapping });
        setAmountMode(
          !data.savedMapping.amount && (data.savedMapping.debit || data.savedMapping.credit)
            ? "split"
            : "single",
        );
      }
      if (data.suggestedAccountId) setAccountId(data.suggestedAccountId);
    },
  });

  // Detect once when the modal opens. `file` is fixed per instance (the card
  // keys the wizard by file), and react-query's `runDetect` is stable.
  useEffect(() => {
    runDetect(file);
  }, [file, runDetect]);

  const {
    mutate: importFile,
    isPending: isImporting,
    error: importError,
  } = useMutation({
    mutationFn: ({ fmt, columnMapping }: { fmt: string; columnMapping?: ColumnMapping }) => {
      const formData = new FormData();
      // The backend reads the mapping from a field that must precede the file.
      if (columnMapping) formData.append("mapping", JSON.stringify(columnMapping));
      formData.append("file", file);
      const params = new URLSearchParams({ format: fmt });
      params.set("accountId", accountId);
      return api.upload<UploadResult>(`/transactions/import?${params.toString()}`, formData);
    },
    onSuccess: async (data) => {
      const settled = await Promise.allSettled(
        QUERY_KEYS_TO_INVALIDATE_AFTER_IMPORT.map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      );
      const refreshHint = settled.some((r) => r.status === "rejected");
      onImported({ imported: data.imported, refreshHint });
      onClose();
    },
  });

  const isMappingFormat = format === SAVED || format === CUSTOM;
  const builtMapping = isMappingFormat ? buildColumnMapping(mapping, amountMode) : null;
  const noActiveAccounts = !accountsLoading && activeAccounts.length === 0;

  const canImport =
    !isImporting &&
    !isDetecting &&
    !noActiveAccounts &&
    accountId !== "" &&
    (isMappingFormat ? builtMapping !== null : format !== "");

  function handleImport() {
    if (isMappingFormat) {
      if (!builtMapping) {
        setMappingError(
          t(
            "components.csvImportCard.mapping.errorRequired",
            "Map the date, description, and amount (or debit and credit) columns before importing.",
          ),
        );
        return;
      }
      setMappingError(null);
      importFile({ fmt: "custom", columnMapping: builtMapping });
      return;
    }
    if (!format || !accountId) return;
    importFile({ fmt: format });
  }

  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault();
    setCreateAccountError(null);
    const name = newAccountName.trim();
    const iban = newAccountIban.trim();
    if (!name || !iban) {
      setCreateAccountError(
        t("components.csvImportCard.createAccount.errorRequired", "Name and IBAN are required."),
      );
      return;
    }
    try {
      const { account } = await createAccount({ name, iban });
      setNewAccountName("");
      setNewAccountIban("");
      setAccountId(account.id);
    } catch (err) {
      setCreateAccountError(
        err instanceof ApiError && err.status === 409
          ? t(
              "components.csvImportCard.createAccount.errorExists",
              "An account with this IBAN already exists.",
            )
          : err instanceof Error
            ? err.message
            : t("components.csvImportCard.createAccount.errorFailed", "Failed to create account."),
      );
    }
  }

  const importErrorMessage =
    importError instanceof Error
      ? importError.message
      : importError
        ? t("components.csvImportCard.errors.uploadFailed", "Upload failed.")
        : null;

  const formatOptions = [
    ...formats,
    ...(savedMapping
      ? [
          {
            value: SAVED,
            label: t("components.csvImportCard.wizard.savedMappingOption", "Saved mapping"),
          },
        ]
      : []),
    {
      value: CUSTOM,
      label: t("components.csvImportCard.wizard.customMappingOption", "Custom mapping"),
    },
  ];

  // First-row value for a mapped column, for the live preview.
  const sampleValueOf = (col?: string) => {
    if (!col) return "";
    const i = columns.indexOf(col);
    return i >= 0 ? (sampleRow[i] ?? "") : "";
  };

  const previewFields: Array<{ label: string; value: string }> = [
    {
      label: t("components.csvImportCard.mapping.dateLabel", "Date column"),
      value: sampleValueOf(mapping.date),
    },
    {
      label: t("components.csvImportCard.mapping.descriptionLabel", "Description column"),
      value: sampleValueOf(mapping.description),
    },
    ...(amountMode === "single"
      ? [
          {
            label: t("components.csvImportCard.mapping.amountLabel", "Amount column"),
            value: sampleValueOf(mapping.amount),
          },
        ]
      : [
          {
            label: t("components.csvImportCard.mapping.debitLabel", "Debit column"),
            value: sampleValueOf(mapping.debit),
          },
          {
            label: t("components.csvImportCard.mapping.creditLabel", "Credit column"),
            value: sampleValueOf(mapping.credit),
          },
        ]),
    ...(mapping.subject
      ? [
          {
            label: t("components.csvImportCard.mapping.subjectLabel", "Subject column (optional)"),
            value: sampleValueOf(mapping.subject),
          },
        ]
      : []),
  ];

  const previewAmountValue =
    amountMode === "single"
      ? previewAmount(sampleValueOf(mapping.amount))
      : (() => {
          const credit = previewAmount(sampleValueOf(mapping.credit));
          if (credit) return String(Math.abs(Number(credit)));
          const debit = previewAmount(sampleValueOf(mapping.debit));
          return debit ? String(-Math.abs(Number(debit))) : "";
        })();

  const previewTransaction = {
    date: previewDate(sampleValueOf(mapping.date), mapping.dateFormat),
    amount: previewAmountValue,
    description: sampleValueOf(mapping.description).replace(/\s+/g, " ").trim() || "Unknown",
    subject: sampleValueOf(mapping.subject).trim(),
  };

  return (
    <Dialog isOpen onClose={onClose} size="md">
      <h2 className="mb-1 text-lg font-semibold text-foreground">
        {t("components.csvImportCard.wizard.title", "Import CSV")}
      </h2>
      <p className="mb-4 text-xs text-muted-foreground">{file.name}</p>

      {isDetecting ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {t("components.csvImportCard.wizard.analyzing", "Analyzing file…")}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {detectFailed && (
            <p className="text-xs text-muted-foreground">
              {t(
                "components.csvImportCard.wizard.noMatchHint",
                "We couldn't auto-detect this file — choose a format and account.",
              )}
            </p>
          )}

          {/* ── Format ── */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">
              {t("components.csvImportCard.wizard.formatLabel", "Format")}
            </Label>
            <NativeSelect
              aria-label={t("components.csvImportCard.wizard.formatLabel", "Format")}
              value={format}
              onChange={(e) => {
                const v = e.target.value;
                setFormat(v);
                if (v === SAVED && savedMapping) {
                  setMapping({ ...savedMapping });
                  setAmountMode(
                    !savedMapping.amount && (savedMapping.debit || savedMapping.credit)
                      ? "split"
                      : "single",
                  );
                }
                setMappingError(null);
              }}
            >
              <option value="">
                {t("components.csvImportCard.wizard.formatPlaceholder", "Select a format")}
              </option>
              {formatOptions.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </NativeSelect>
          </div>

          {/* ── Account (or inline create) ── */}
          {noActiveAccounts ? (
            <form
              onSubmit={handleCreateAccount}
              aria-labelledby="csv-create-account-title"
              className="flex flex-col gap-2 rounded border border-border bg-muted/30 p-3"
            >
              <p id="csv-create-account-title" className="text-sm font-medium">
                {t("components.csvImportCard.createAccount.title", "No account yet")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t(
                  "components.csvImportCard.createAccount.help",
                  "Create an account to import into, then upload again.",
                )}
              </p>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="csv-new-account-name" className="text-xs text-muted-foreground">
                  {t("components.csvImportCard.createAccount.nameLabel", "Account name")}
                </Label>
                <Input
                  id="csv-new-account-name"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  placeholder={t(
                    "components.csvImportCard.createAccount.namePlaceholder",
                    "e.g. Main Account",
                  )}
                  disabled={isCreatingAccount}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="csv-new-account-iban" className="text-xs text-muted-foreground">
                  {t("components.csvImportCard.createAccount.ibanLabel", "IBAN")}
                </Label>
                <Input
                  id="csv-new-account-iban"
                  value={newAccountIban}
                  onChange={(e) => setNewAccountIban(e.target.value)}
                  placeholder="CH93 0076 2011 6238 5295 7"
                  disabled={isCreatingAccount}
                />
              </div>
              {createAccountError && (
                <p role="alert" className="text-xs text-destructive">
                  {createAccountError}
                </p>
              )}
              <div>
                <Button type="submit" size="sm" disabled={isCreatingAccount}>
                  {isCreatingAccount
                    ? t("common.creating", "Creating…")
                    : t("components.csvImportCard.createAccount.submitBtn", "Create account")}
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">
                {t("components.csvImportCard.wizard.accountLabel", "Account")}
              </Label>
              <NativeSelect
                aria-label={t("components.csvImportCard.wizard.accountLabel", "Account")}
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              >
                <option value="">
                  {t("components.csvImportCard.wizard.accountPlaceholder", "Select an account")}
                </option>
                {activeAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} — {a.iban}
                  </option>
                ))}
              </NativeSelect>
            </div>
          )}

          {/* ── Column mapping (saved or custom) ── */}
          {isMappingFormat && (
            <section
              aria-labelledby="csv-mapping-title"
              className="flex flex-col gap-3 rounded border border-border bg-muted/30 p-3"
            >
              <p id="csv-mapping-title" className="text-sm font-medium">
                {t("components.csvImportCard.mapping.title", "Map your columns")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t(
                  "components.csvImportCard.mapping.help",
                  "We couldn't auto-detect this bank. Match each field to a column from your file.",
                )}
              </p>

              {renderColumnSelect(
                "date",
                t("components.csvImportCard.mapping.dateLabel", "Date column"),
              )}
              {renderColumnSelect(
                "description",
                t("components.csvImportCard.mapping.descriptionLabel", "Description column"),
              )}

              <fieldset className="flex flex-col gap-1.5">
                <legend className="text-xs text-muted-foreground">
                  {t("components.csvImportCard.mapping.amountModeLegend", "Amount columns")}
                </legend>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="csv-amount-mode"
                    checked={amountMode === "single"}
                    onChange={() => setAmountMode("single")}
                  />
                  {t("components.csvImportCard.mapping.amountModeSingle", "Single amount column")}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="csv-amount-mode"
                    checked={amountMode === "split"}
                    onChange={() => setAmountMode("split")}
                  />
                  {t("components.csvImportCard.mapping.amountModeSplit", "Separate debit & credit")}
                </label>
              </fieldset>

              {amountMode === "single" ? (
                renderColumnSelect(
                  "amount",
                  t("components.csvImportCard.mapping.amountLabel", "Amount column"),
                )
              ) : (
                <>
                  {renderColumnSelect(
                    "debit",
                    t("components.csvImportCard.mapping.debitLabel", "Debit column"),
                  )}
                  {renderColumnSelect(
                    "credit",
                    t("components.csvImportCard.mapping.creditLabel", "Credit column"),
                  )}
                </>
              )}

              {renderColumnSelect(
                "subject",
                t("components.csvImportCard.mapping.subjectLabel", "Subject column (optional)"),
                true,
              )}

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">
                  {t("components.csvImportCard.mapping.dateFormatLabel", "Date format (optional)")}
                </Label>
                <NativeSelect
                  aria-label={t(
                    "components.csvImportCard.mapping.dateFormatLabel",
                    "Date format (optional)",
                  )}
                  value={mapping.dateFormat ?? ""}
                  onChange={(e) =>
                    setMapping((m) => {
                      const next: ColumnMapping = { ...m };
                      const v = e.target.value;
                      if (!v) delete next.dateFormat;
                      else next.dateFormat = v as DateFormat;
                      return next;
                    })
                  }
                >
                  <option value="">
                    {t("components.csvImportCard.mapping.dateFormatPlaceholder", "Auto")}
                  </option>
                  <option value="iso">
                    {t("components.csvImportCard.mapping.dateFormatIso", "ISO (2025-01-31)")}
                  </option>
                  <option value="dmy-dot">
                    {t("components.csvImportCard.mapping.dateFormatDmyDot", "DD.MM.YYYY")}
                  </option>
                  <option value="dmy-dash">
                    {t("components.csvImportCard.mapping.dateFormatDmyDash", "DD-MM-YYYY")}
                  </option>
                  <option value="dmy-slash">
                    {t("components.csvImportCard.mapping.dateFormatDmySlash", "DD/MM/YYYY")}
                  </option>
                </NativeSelect>
              </div>

              {sampleRow.length > 0 && (
                <div className="flex flex-col gap-2 rounded border border-border bg-background p-2 text-xs">
                  <p className="font-medium">
                    {t("components.csvImportCard.wizard.preview.firstEntry", "First entry")}
                  </p>
                  <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5">
                    {previewFields.map((f) => (
                      <Fragment key={f.label}>
                        <dt className="text-muted-foreground">{f.label}</dt>
                        <dd className="truncate font-mono">{f.value || "—"}</dd>
                      </Fragment>
                    ))}
                  </dl>

                  <p className="font-medium">
                    {t("components.csvImportCard.wizard.preview.importedAs", "Imported as")}
                  </p>
                  <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5">
                    <dt className="text-muted-foreground">
                      {t("components.csvImportCard.wizard.preview.date", "Date")}
                    </dt>
                    <dd className="font-mono">{previewTransaction.date || "—"}</dd>
                    <dt className="text-muted-foreground">
                      {t("components.csvImportCard.wizard.preview.amount", "Amount")}
                    </dt>
                    <dd className="font-mono">{previewTransaction.amount || "—"}</dd>
                    <dt className="text-muted-foreground">
                      {t("components.csvImportCard.wizard.preview.description", "Description")}
                    </dt>
                    <dd className="truncate">{previewTransaction.description}</dd>
                    {previewTransaction.subject && (
                      <>
                        <dt className="text-muted-foreground">
                          {t("components.csvImportCard.wizard.preview.subject", "Subject")}
                        </dt>
                        <dd className="truncate">{previewTransaction.subject}</dd>
                      </>
                    )}
                  </dl>
                </div>
              )}

              {mappingError && (
                <p role="alert" className="text-xs text-destructive">
                  {mappingError}
                </p>
              )}
            </section>
          )}

          {importErrorMessage && (
            <p role="alert" className="text-xs text-destructive">
              {importErrorMessage}
            </p>
          )}

          {/* ── Footer ── */}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isImporting}>
              {t("components.csvImportCard.wizard.cancelBtn", "Cancel")}
            </Button>
            <Button type="button" disabled={!canImport} onClick={handleImport}>
              {isImporting
                ? t("components.csvImportCard.uploading", "Uploading…")
                : t("components.csvImportCard.wizard.importBtn", "Import")}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );

  // One labelled column dropdown for the manual-mapping step. The empty option
  // is the placeholder for required fields and the "none" choice for optional
  // ones; either way an empty value reads as "unset" in buildColumnMapping.
  function renderColumnSelect(
    field: "date" | "description" | "amount" | "debit" | "credit" | "subject",
    label: string,
    optional = false,
  ) {
    return (
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <NativeSelect
          aria-label={label}
          value={mapping[field] ?? ""}
          onChange={(e) => setMapping((m) => ({ ...m, [field]: e.target.value }))}
        >
          <option value="">
            {optional
              ? t("components.csvImportCard.mapping.subjectNone", "— None —")
              : t("components.csvImportCard.mapping.columnPlaceholder", "Select a column")}
          </option>
          {columns.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </NativeSelect>
      </div>
    );
  }
}
