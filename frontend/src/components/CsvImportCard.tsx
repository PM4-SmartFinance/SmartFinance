import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import { DASHBOARD_QUERY_KEY } from "../lib/queries/dashboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

interface Account {
  id: string;
  name: string;
  iban: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export function CsvImportCard() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<ImportFormat>("");
  const [accountId, setAccountId] = useState<string>("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [typeError, setTypeError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [refreshHint, setRefreshHint] = useState(false);
  const { t } = useTranslation();

  const { data: formatsData, isError: isFormatsError } = useQuery({
    queryKey: ["import-formats"],
    queryFn: () => api.get<ImportFormatsResponse>("/transactions/import/formats"),
  });
  const formats = formatsData?.formats ?? [];

  const { data: accountsData, isError: isAccountsError } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => api.get<{ accounts: Account[] }>("/accounts"),
  });
  const accounts = accountsData?.accounts ?? [];

  // Derive the active format without writing to state during render.
  const effectiveFormat = format || formats[0]?.value || "";

  // Derive the active account without writing to state during render.
  const effectiveAccountId = accountId || accounts[0]?.id || "";

  const {
    mutate: uploadFile,
    isPending: isUploading,
    error: uploadError,
    reset: resetMutation,
  } = useMutation({
    mutationFn: ({ f, fmt, acId }: { f: File; fmt: string; acId: string }) => {
      const formData = new FormData();
      formData.append("file", f);
      return api.upload<UploadResult>(
        `/transactions/import?accountId=${encodeURIComponent(acId)}&format=${encodeURIComponent(fmt)}`,
        formData,
      );
    },
    onSuccess: async (data) => {
      setResult(data);
      setRefreshHint(false);

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
    resetMutation();
    setFile(f);
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
    if (!file || !effectiveAccountId || !effectiveFormat) return;
    uploadFile({ f: file, fmt: effectiveFormat, acId: effectiveAccountId });
  }

  function handleReset() {
    setFile(null);
    setResult(null);
    setTypeError(null);
    setRefreshHint(false);
    resetMutation();
  }

  const uploadErrorMessage =
    uploadError instanceof ApiError
      ? uploadError.message
      : uploadError instanceof Error
        ? uploadError.message
        : uploadError
          ? t("components.csvImportCard.errors.uploadFailed", "Upload failed.")
          : null;

  const canUpload =
    file !== null && effectiveAccountId !== "" && effectiveFormat !== "" && !isUploading;

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

            {/* ── Selectors row ── */}
            <div className="flex flex-wrap gap-4">
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
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="csv-account" className="text-xs text-muted-foreground">
                  {t("components.csvImportCard.accountLabel", "Account")}
                </Label>
                {isAccountsError ? (
                  <p role="alert" className="py-1.5 text-sm text-destructive">
                    {t(
                      "components.csvImportCard.errors.accountsError",
                      "Failed to load accounts. Please try again.",
                    )}
                  </p>
                ) : accounts.length === 0 ? (
                  <p className="py-1.5 text-sm text-muted-foreground">
                    {t(
                      "components.csvImportCard.errors.noAccounts",
                      "No accounts found. Create an account first.",
                    )}
                  </p>
                ) : (
                  <Select value={effectiveAccountId} onValueChange={(v) => setAccountId(v ?? "")}>
                    <SelectTrigger id="csv-account" className="w-64">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name} — {a.iban}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {/* ── Upload button ── */}
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
                ) : (
                  t("components.csvImportCard.uploadBtn", "Upload")
                )}
              </Button>
            </div>

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
