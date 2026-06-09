import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import { DASHBOARD_QUERY_KEY } from "../lib/queries/dashboard";
import { useCreateAccount } from "../lib/queries/accounts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "react-i18next";

const QUERY_KEYS_TO_INVALIDATE_AFTER_IMPORT = [
  ["budgets"],
  DASHBOARD_QUERY_KEY,
  ["transactions"],
] as const;

type ImportFormat = string;

type UploadResult = { imported: number };

interface ImportFormatsResponse {
  formats: { value: string; label: string }[];
}

// Mirrors the backend `ColumnMapping` contract (KAN-163). Values are header
// names taken from the file's detected columns. The backend intentionally
// supports only these canonical fields — no currency / value-date / IBAN
// mapping — so the UI offers exactly these and no more.
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
  savedMapping: ColumnMapping | null;
}

// Pre-upload wizard stage. Kept separate from `Resolution` (which is the
// post-upload account-resolution flow) — the two concerns are orthogonal.
type DetectStage =
  | { kind: "idle" } // no file selected yet
  | { kind: "detecting" } // detect request in flight
  | { kind: "confident"; detectedFormat: string } // matched → normal upload, dropdown preselected
  | { kind: "mapping"; columns: string[] } // no match → manual column mapping (custom upload)
  | { kind: "manual" }; // detect failed / empty → fall back to the manual dropdown

const NO_COLUMN = "__none__";

interface AccountCandidate {
  id: string;
  name: string;
  iban: string;
}

type Resolution =
  | { kind: "idle" }
  | { kind: "needs_choice"; candidates: AccountCandidate[]; chosen?: string | undefined }
  | { kind: "no_accounts" };

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

function parseAccountResolutionError(
  err: unknown,
): { code: "AMBIGUOUS_ACCOUNT"; candidates: AccountCandidate[] } | { code: "NO_MATCH" } | null {
  if (!(err instanceof ApiError) || err.status !== 409) return null;
  const body = err.body as { error?: { code?: string; candidates?: AccountCandidate[] } } | null;
  const code = body?.error?.code;
  if (code === "AMBIGUOUS_ACCOUNT") {
    return { code, candidates: body?.error?.candidates ?? [] };
  }
  if (code === "NO_MATCH") {
    return { code };
  }
  return null;
}

// Assembles a backend-ready ColumnMapping from the form draft, or returns null
// when a required field is unset (date, description, and either a single amount
// column or both debit and credit). Pure so it gates the upload button and the
// submit handler from one source of truth.
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

export function CsvImportCard() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<ImportFormat>("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [typeError, setTypeError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [refreshHint, setRefreshHint] = useState(false);
  const [resolution, setResolution] = useState<Resolution>({ kind: "idle" });
  const [stage, setStage] = useState<DetectStage>({ kind: "idle" });
  const [mapping, setMapping] = useState<ColumnMapping>({ date: "", description: "" });
  const [amountMode, setAmountMode] = useState<"single" | "split">("single");
  const [mappingError, setMappingError] = useState<string | null>(null);
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountIban, setNewAccountIban] = useState("");
  const [createAccountError, setCreateAccountError] = useState<string | null>(null);
  const { t } = useTranslation();

  const { mutateAsync: createAccount, isPending: isCreatingAccount } = useCreateAccount();

  const { data: formatsData, isError: isFormatsError } = useQuery({
    queryKey: ["import-formats"],
    queryFn: () => api.get<ImportFormatsResponse>("/transactions/import/formats"),
  });
  const formats = formatsData?.formats ?? [];

  // Derive the active format without writing to state during render.
  const effectiveFormat = format || formats[0]?.value || "";

  const {
    mutate: uploadFile,
    isPending: isUploading,
    error: uploadError,
    reset: resetMutation,
  } = useMutation({
    mutationFn: ({
      f,
      fmt,
      acId,
      mapping,
    }: {
      f: File;
      fmt: ImportFormat;
      acId?: string | undefined;
      mapping?: ColumnMapping | undefined;
    }) => {
      const formData = new FormData();
      // The backend reads the mapping from a field that must precede the file
      // part (KAN-163), so append it first.
      if (mapping) formData.append("mapping", JSON.stringify(mapping));
      formData.append("file", f);
      const params = new URLSearchParams({ format: mapping ? "custom" : fmt });
      if (acId) params.set("accountId", acId);
      return api.upload<UploadResult>(`/transactions/import?${params.toString()}`, formData);
    },
    onSuccess: async (data) => {
      setResult(data);
      setRefreshHint(false);
      setResolution({ kind: "idle" });

      const invalidations = await Promise.allSettled(
        QUERY_KEYS_TO_INVALIDATE_AFTER_IMPORT.map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      );

      let anyRejected = false;
      invalidations.forEach((result, index) => {
        if (result.status === "rejected") {
          anyRejected = true;
          const key = QUERY_KEYS_TO_INVALIDATE_AFTER_IMPORT[index]!.join("/");
          console.error(
            `CsvImportCard: failed to invalidate query '${key}' after import`,
            result.reason,
          );
        }
      });
      if (anyRejected) setRefreshHint(true);
    },
    onError: (err) => {
      const parsed = parseAccountResolutionError(err);
      if (parsed?.code === "AMBIGUOUS_ACCOUNT") {
        setResolution({ kind: "needs_choice", candidates: parsed.candidates });
      } else if (parsed?.code === "NO_MATCH") {
        setResolution({ kind: "no_accounts" });
      }
    },
  });

  // On file select we ask the backend to sniff the header. A confident match
  // pre-selects the bank format; otherwise we show the file's columns for manual
  // mapping. Any failure falls back to the manual dropdown (current behaviour).
  const { mutate: runDetect } = useMutation({
    mutationFn: (f: File) => {
      const formData = new FormData();
      formData.append("file", f);
      return api.upload<DetectResult>("/transactions/import/detect", formData);
    },
    onSuccess: (data) => {
      if (data.detectedFormat && formats.some((fmt) => fmt.value === data.detectedFormat)) {
        setFormat(data.detectedFormat);
        setStage({ kind: "confident", detectedFormat: data.detectedFormat });
        return;
      }
      if (Array.isArray(data.columns) && data.columns.length > 0) {
        const saved = data.savedMapping;
        setMapping(saved ? { ...saved } : { date: "", description: "" });
        setAmountMode(saved && !saved.amount && (saved.debit || saved.credit) ? "split" : "single");
        setStage({ kind: "mapping", columns: data.columns });
        return;
      }
      setStage({ kind: "manual" });
    },
    onError: () => setStage({ kind: "manual" }),
  });

  function acceptFile(f: File) {
    if (!f.name.toLowerCase().endsWith(".csv")) {
      setTypeError(
        t("components.csvImportCard.errors.invalidType", "Only .csv files are accepted."),
      );
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      setTypeError(
        t("components.csvImportCard.errors.fileTooLarge", "File exceeds the 10 MB size limit."),
      );
      return;
    }
    setTypeError(null);
    setResult(null);
    setResolution({ kind: "idle" });
    resetMutation();
    setFile(f);

    // Reset any prior wizard state and kick off detection for the new file.
    setFormat("");
    setMapping({ date: "", description: "" });
    setAmountMode("single");
    setMappingError(null);
    setStage({ kind: "detecting" });
    runDetect(f);
  }

  function handleDrop(e: React.DragEvent<HTMLButtonElement>) {
    e.preventDefault();
    setIsDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) acceptFile(dropped);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (picked) acceptFile(picked);
    e.target.value = "";
  }

  function handleUpload() {
    if (!file) return;
    const acId = resolution.kind === "needs_choice" ? resolution.chosen : undefined;

    if (stage.kind === "mapping") {
      const built = buildColumnMapping(mapping, amountMode);
      if (!built) {
        setMappingError(
          t(
            "components.csvImportCard.mapping.errorRequired",
            "Map the date, description, and amount (or debit and credit) columns before importing.",
          ),
        );
        return;
      }
      setMappingError(null);
      uploadFile({ f: file, fmt: "custom", acId, mapping: built });
      return;
    }

    if (!effectiveFormat) return;
    uploadFile({ f: file, fmt: effectiveFormat, acId });
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
      await createAccount({ name, iban });
      // The user now has exactly one account, so import resolution will
      // auto-select it: clear the inline form and let them upload again.
      setNewAccountName("");
      setNewAccountIban("");
      setResolution({ kind: "idle" });
      resetMutation();
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

  function handleReset() {
    setFile(null);
    setResult(null);
    setTypeError(null);
    setRefreshHint(false);
    setResolution({ kind: "idle" });
    setStage({ kind: "idle" });
    setFormat("");
    setMapping({ date: "", description: "" });
    setAmountMode("single");
    setMappingError(null);
    setNewAccountName("");
    setNewAccountIban("");
    setCreateAccountError(null);
    resetMutation();
  }

  // Suppress the generic error message when we have a structured resolution
  // flow on screen — that flow already explains what to do.
  const showStructuredResolution = resolution.kind !== "idle";
  const uploadErrorMessage = showStructuredResolution
    ? null
    : uploadError instanceof ApiError
      ? uploadError.message
      : uploadError instanceof Error
        ? uploadError.message
        : uploadError
          ? t("components.csvImportCard.errors.uploadFailed", "Upload failed.")
          : null;

  const mappingValid = stage.kind !== "mapping" || buildColumnMapping(mapping, amountMode) !== null;
  const canUpload =
    file !== null &&
    !isUploading &&
    stage.kind !== "detecting" &&
    resolution.kind !== "no_accounts" &&
    (resolution.kind !== "needs_choice" || resolution.chosen !== undefined) &&
    (stage.kind === "mapping" ? mappingValid : effectiveFormat !== "");

  // One labelled column dropdown for the manual-mapping step. Optional fields
  // get a "none" sentinel; required fields show the placeholder until chosen.
  type MappingField = "date" | "description" | "amount" | "debit" | "credit" | "subject";
  function columnSelect(field: MappingField, columns: string[], label: string, optional = false) {
    return (
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <Select
          value={mapping[field] ?? (optional ? NO_COLUMN : "")}
          onValueChange={(v) =>
            setMapping((m) => {
              const next: ColumnMapping = { ...m };
              if (!v || v === NO_COLUMN) {
                // Only optional columns expose a "none" choice, so the key is
                // safe to drop. `exactOptionalPropertyTypes` forbids setting it
                // to undefined, hence the delete.
                delete (next as Partial<ColumnMapping>)[field];
              } else {
                next[field] = v;
              }
              return next;
            })
          }
        >
          <SelectTrigger aria-label={label} className="w-56">
            <SelectValue
              placeholder={t(
                "components.csvImportCard.mapping.columnPlaceholder",
                "Select a column",
              )}
            />
          </SelectTrigger>
          <SelectContent>
            {optional && (
              <SelectItem value={NO_COLUMN}>
                {t("components.csvImportCard.mapping.subjectNone", "— None —")}
              </SelectItem>
            )}
            {columns.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <Card className="col-span-1 sm:col-span-2 lg:col-span-3">
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-wider">
          {t("components.csvImportCard.title", "Import Transactions")}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {result ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30"
              aria-hidden="true"
            >
              <svg
                className="h-6 w-6 text-green-600 dark:text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm font-medium text-foreground">
              {result.imported > 0
                ? t(
                    "components.csvImportCard.resultSuccess",
                    "{{count}} transactions imported successfully.",
                    { count: result.imported },
                  )
                : t(
                    "components.csvImportCard.resultZero",
                    "No new transactions found (all rows may be duplicates).",
                  )}
            </p>
            {refreshHint && (
              <p
                role="alert"
                className="rounded border border-destructive bg-destructive/10 px-3 py-2 text-xs text-destructive"
              >
                {t(
                  "components.csvImportCard.refreshHint",
                  "Imported, but the dashboard may need a manual refresh.",
                )}
              </p>
            )}
            <Button variant="outline" size="sm" onClick={handleReset}>
              {t("components.csvImportCard.resetBtn", "Import another file")}
            </Button>
          </div>
        ) : (
          <>
            {/* ── Drop zone ── */}
            <button
              type="button"
              aria-label={t("components.csvImportCard.dropZoneAria", "File drop zone")}
              className={[
                "flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors",
                isDragOver
                  ? "border-primary bg-primary/5"
                  : "border-border bg-muted/20 hover:bg-muted/40",
              ].join(" ")}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
            >
              <svg
                className="h-8 w-8 text-muted-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                />
              </svg>
              <p className="text-sm text-muted-foreground">
                {isDragOver
                  ? t("components.csvImportCard.dropZoneActive", "Release to select file")
                  : file
                    ? t("components.csvImportCard.dropZoneSelected", "Selected: {{name}}", {
                        name: file.name,
                      })
                    : t(
                        "components.csvImportCard.dropZoneIdle",
                        "Drop a CSV file here, or click to browse",
                      )}
              </p>
              <p className="text-xs text-muted-foreground/60">
                {t("components.csvImportCard.dropZoneSubtext", ".csv files only · max 10 MB")}
              </p>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="sr-only"
              onChange={handleFileInput}
              aria-hidden="true"
              tabIndex={-1}
            />

            {typeError && (
              <p role="alert" className="text-xs text-destructive">
                {typeError}
              </p>
            )}

            {/* ── Detecting hint ── */}
            {stage.kind === "detecting" && (
              <p className="text-xs text-muted-foreground">
                {t("components.csvImportCard.detecting", "Analyzing file…")}
              </p>
            )}

            {/* ── Bank-format selector (hidden during manual column mapping) ── */}
            {stage.kind !== "mapping" && stage.kind !== "detecting" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="csv-format" className="text-xs text-muted-foreground">
                  {t("components.csvImportCard.formatLabel", "Bank format")}
                </Label>
                {isFormatsError ? (
                  <p role="alert" className="py-1.5 text-sm text-destructive">
                    {t(
                      "components.csvImportCard.errors.formatsError",
                      "Failed to load formats. Please refresh.",
                    )}
                  </p>
                ) : (
                  <Select
                    value={effectiveFormat}
                    onValueChange={(v) => {
                      if (v !== null && formats.some((f) => f.value === v)) setFormat(v);
                    }}
                  >
                    <SelectTrigger id="csv-format" className="w-40">
                      <SelectValue placeholder="Select format" />
                    </SelectTrigger>
                    <SelectContent>
                      {formats.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {stage.kind === "confident" && (
                  <p className="text-xs text-muted-foreground">
                    {t(
                      "components.csvImportCard.detectedHint",
                      "Detected automatically — change it if it's wrong.",
                    )}
                  </p>
                )}
                {stage.kind === "manual" && file && (
                  <p className="text-xs text-muted-foreground">
                    {t(
                      "components.csvImportCard.detectFallback",
                      "Couldn't analyze the file — pick a bank format manually.",
                    )}
                  </p>
                )}
              </div>
            )}

            {/* ── Manual column mapping ── */}
            {stage.kind === "mapping" && (
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

                {columnSelect(
                  "date",
                  stage.columns,
                  t("components.csvImportCard.mapping.dateLabel", "Date column"),
                )}
                {columnSelect(
                  "description",
                  stage.columns,
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
                    {t(
                      "components.csvImportCard.mapping.amountModeSplit",
                      "Separate debit & credit",
                    )}
                  </label>
                </fieldset>

                {amountMode === "single" ? (
                  columnSelect(
                    "amount",
                    stage.columns,
                    t("components.csvImportCard.mapping.amountLabel", "Amount column"),
                  )
                ) : (
                  <>
                    {columnSelect(
                      "debit",
                      stage.columns,
                      t("components.csvImportCard.mapping.debitLabel", "Debit column"),
                    )}
                    {columnSelect(
                      "credit",
                      stage.columns,
                      t("components.csvImportCard.mapping.creditLabel", "Credit column"),
                    )}
                  </>
                )}

                {columnSelect(
                  "subject",
                  stage.columns,
                  t("components.csvImportCard.mapping.subjectLabel", "Subject column (optional)"),
                  true,
                )}

                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">
                    {t(
                      "components.csvImportCard.mapping.dateFormatLabel",
                      "Date format (optional)",
                    )}
                  </Label>
                  <Select
                    value={mapping.dateFormat ?? NO_COLUMN}
                    onValueChange={(v) =>
                      setMapping((m) => {
                        const next: ColumnMapping = { ...m };
                        if (!v || v === NO_COLUMN) delete next.dateFormat;
                        else next.dateFormat = v as DateFormat;
                        return next;
                      })
                    }
                  >
                    <SelectTrigger
                      aria-label={t(
                        "components.csvImportCard.mapping.dateFormatLabel",
                        "Date format (optional)",
                      )}
                      className="w-56"
                    >
                      <SelectValue
                        placeholder={t(
                          "components.csvImportCard.mapping.dateFormatPlaceholder",
                          "Auto",
                        )}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_COLUMN}>
                        {t("components.csvImportCard.mapping.dateFormatPlaceholder", "Auto")}
                      </SelectItem>
                      <SelectItem value="iso">
                        {t("components.csvImportCard.mapping.dateFormatIso", "ISO (2025-01-31)")}
                      </SelectItem>
                      <SelectItem value="dmy-dot">
                        {t("components.csvImportCard.mapping.dateFormatDmyDot", "DD.MM.YYYY")}
                      </SelectItem>
                      <SelectItem value="dmy-dash">
                        {t("components.csvImportCard.mapping.dateFormatDmyDash", "DD-MM-YYYY")}
                      </SelectItem>
                      <SelectItem value="dmy-slash">
                        {t("components.csvImportCard.mapping.dateFormatDmySlash", "DD/MM/YYYY")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {mappingError && (
                  <p role="alert" className="text-xs text-destructive">
                    {mappingError}
                  </p>
                )}
              </section>
            )}

            {resolution.kind === "needs_choice" && (
              <div
                role="group"
                aria-labelledby="csv-account-title"
                className="flex flex-col gap-2 rounded border border-border bg-muted/30 p-3"
              >
                <p id="csv-account-title" className="text-sm font-medium">
                  {t("components.csvImportCard.chooseAccountTitle", "Multiple accounts available")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t(
                    "components.csvImportCard.chooseAccountHelp",
                    "Pick which account this CSV belongs to and continue.",
                  )}
                </p>
                <Select
                  value={resolution.chosen ?? ""}
                  onValueChange={(v) =>
                    setResolution({
                      kind: "needs_choice",
                      candidates: resolution.candidates,
                      chosen: v ?? undefined,
                    })
                  }
                >
                  <SelectTrigger
                    aria-label={t(
                      "components.csvImportCard.chooseAccountAriaLabel",
                      "Choose import account",
                    )}
                    className="w-72"
                  >
                    <SelectValue
                      placeholder={t(
                        "components.csvImportCard.chooseAccountPlaceholder",
                        "Select an account",
                      )}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {resolution.candidates.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} — {a.iban}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {resolution.kind === "no_accounts" && (
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
            )}

            {/* ── Upload button ── */}
            {resolution.kind !== "no_accounts" && (
              <div className="flex items-center gap-3">
                <Button disabled={!canUpload} onClick={handleUpload}>
                  {isUploading ? (
                    <>
                      <svg
                        className="h-4 w-4 animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                        />
                      </svg>
                      {t("components.csvImportCard.uploading", "Uploading…")}
                    </>
                  ) : resolution.kind === "needs_choice" ? (
                    t("components.csvImportCard.continueBtn", "Continue")
                  ) : (
                    t("components.csvImportCard.uploadBtn", "Upload")
                  )}
                </Button>
              </div>
            )}

            {uploadErrorMessage && (
              <p role="alert" className="text-xs text-destructive">
                {uploadErrorMessage}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
