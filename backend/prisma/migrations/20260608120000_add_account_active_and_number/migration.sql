-- Add soft-deactivation flag and bank account number to DimAccount (KAN-169).
ALTER TABLE "DimAccount" ADD COLUMN "accountNumber" TEXT;
ALTER TABLE "DimAccount" ADD COLUMN "active" boolean NOT NULL DEFAULT true;

-- Index the active flag: the transactions view and import resolution both
-- filter accounts by it.
CREATE INDEX IF NOT EXISTS "DimAccount_active_idx" ON "DimAccount"("active");
