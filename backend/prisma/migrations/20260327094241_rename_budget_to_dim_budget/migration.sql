-- AlterTable: remove budget limit columns from DimCategory
ALTER TABLE "DimCategory" DROP COLUMN IF EXISTS "budgetLimitDay",
DROP COLUMN IF EXISTS "budgetLimitMonth",
DROP COLUMN IF EXISTS "budgetLimitYear";

-- RenameTable: Budget -> DimBudget
ALTER TABLE "Budget" RENAME TO "DimBudget";

-- AlterTable: add new columns to DimBudget
ALTER TABLE "DimBudget" ADD COLUMN "budgetLimitDay" DECIMAL(12,2),
ADD COLUMN "budgetLimitMonth" DECIMAL(12,2),
ADD COLUMN "budgetLimitYear" DECIMAL(12,2),
ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

-- RenameIndex
ALTER INDEX "Budget_pkey" RENAME TO "DimBudget_pkey";
ALTER INDEX "Budget_userId_idx" RENAME TO "DimBudget_userId_idx";
ALTER INDEX "Budget_categoryId_idx" RENAME TO "DimBudget_categoryId_idx";
ALTER INDEX "Budget_userId_categoryId_month_year_key" RENAME TO "DimBudget_userId_categoryId_month_year_key";

-- RenameForeignKey
ALTER TABLE "DimBudget" RENAME CONSTRAINT "Budget_categoryId_fkey" TO "DimBudget_categoryId_fkey";
ALTER TABLE "DimBudget" RENAME CONSTRAINT "Budget_userId_fkey" TO "DimBudget_userId_fkey";
