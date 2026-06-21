import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CsvImportWizard } from "./CsvImportWizard";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

type ImportResult = { imported: number; refreshHint: boolean };

/**
 * Dashboard import card (KAN-163). It is just a drop zone: choosing a CSV opens
 * the {@link CsvImportWizard} modal, which handles detection, format/account
 * selection, optional column mapping, and the import itself. On success the card
 * shows a result summary.
 */
export function CsvImportCard() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  // Bumped per accepted file so the wizard remounts with fresh state.
  const [fileKey, setFileKey] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [typeError, setTypeError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const { t } = useTranslation();

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
    setFile(f);
    setFileKey((k) => k + 1);
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

  function handleImported(r: ImportResult) {
    setResult(r);
    setFile(null);
  }

  function handleReset() {
    setResult(null);
    setFile(null);
    setTypeError(null);
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
            {result.refreshHint && (
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
          </>
        )}
      </CardContent>

      {file && (
        <CsvImportWizard
          key={fileKey}
          file={file}
          onClose={() => setFile(null)}
          onImported={handleImported}
        />
      )}
    </Card>
  );
}
