-- CreateEnum
CREATE TYPE "BudgetType" AS ENUM ('DAILY', 'MONTHLY', 'YEARLY', 'SPECIFIC_MONTH', 'SPECIFIC_YEAR', 'SPECIFIC_MONTH_YEAR');

-- Drop old unique index
DROP INDEX "DimBudget_userId_categoryId_month_year_key";

-- Add type column with default
ALTER TABLE "DimBudget" ADD COLUMN "type" "BudgetType" NOT NULL DEFAULT 'MONTHLY';

-- Convert existing rows: they had specific month+year, so mark them as SPECIFIC_MONTH_YEAR
UPDATE "DimBudget" SET "type" = 'SPECIFIC_MONTH_YEAR';

-- Drop unused limit columns
ALTER TABLE "DimBudget" DROP COLUMN "budgetLimitDay";
ALTER TABLE "DimBudget" DROP COLUMN "budgetLimitMonth";
ALTER TABLE "DimBudget" DROP COLUMN "budgetLimitYear";

-- Change month/year defaults to 0 (existing rows keep their values)
ALTER TABLE "DimBudget" ALTER COLUMN "month" SET DEFAULT 0;
ALTER TABLE "DimBudget" ALTER COLUMN "year" SET DEFAULT 0;

-- Add new unique constraint
CREATE UNIQUE INDEX "DimBudget_userId_categoryId_type_month_year_key" ON "DimBudget"("userId", "categoryId", "type", "month", "year");
