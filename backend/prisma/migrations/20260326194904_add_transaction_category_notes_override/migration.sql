-- AlterTable
ALTER TABLE "FactTransactions" ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "manualOverride" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notes" TEXT;

-- CreateIndex
CREATE INDEX "FactTransactions_categoryId_idx" ON "FactTransactions"("categoryId");

-- AddForeignKey
ALTER TABLE "FactTransactions" ADD CONSTRAINT "FactTransactions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "DimCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
