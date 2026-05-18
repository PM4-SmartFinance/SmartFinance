-- AlterTable: soft-delete flag on FactTransactions
ALTER TABLE "FactTransactions" ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: redesign AuditLog with structured columns
-- Add new columns first so we can backfill from `details` before dropping it.
ALTER TABLE "AuditLog"
  ADD COLUMN     "changedValues" JSONB,
  ADD COLUMN     "previousValues" JSONB,
  ADD COLUMN     "reason" TEXT,
  ADD COLUMN     "transactionId" TEXT;

-- Data migration: preserve historical audit entries.
-- `details` was a free-form JSON string column. Parse rows that contain valid
-- JSON into `changedValues` so the trail survives the redesign; for rows whose
-- `details` is not valid JSON (or is null), leave `changedValues` as NULL.
-- Postgres has no exception-catching DML; use a CASE to detect JSON shape.
UPDATE "AuditLog"
SET "changedValues" = CASE
  WHEN "details" IS NULL THEN NULL
  WHEN "details" ~ '^\s*\{' OR "details" ~ '^\s*\[' THEN "details"::jsonb
  ELSE jsonb_build_object('details', "details")
END
WHERE "details" IS NOT NULL;

-- Drop the legacy column now that the data is preserved in `changedValues`.
ALTER TABLE "AuditLog" DROP COLUMN "details";

-- CreateIndex
CREATE INDEX "AuditLog_transactionId_idx" ON "AuditLog"("transactionId");
