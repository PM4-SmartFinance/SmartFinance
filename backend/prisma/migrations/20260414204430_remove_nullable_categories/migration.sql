/*
  Warnings:

  - Made the column `userId` on table `DimCategory` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "CategoryRule" DROP CONSTRAINT "CategoryRule_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "DimBudget" DROP CONSTRAINT "DimBudget_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "FactTransactions" DROP CONSTRAINT "FactTransactions_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "UserMerchantMapping" DROP CONSTRAINT "UserMerchantMapping_categoryId_fkey";

-- DropIndex
DROP INDEX "DimUser_active_idx";

-- AlterTable
ALTER TABLE "DimCategory" ALTER COLUMN "userId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "FactTransactions_userId_dateId_idx" ON "FactTransactions"("userId", "dateId");

-- AddForeignKey
ALTER TABLE "FactTransactions" ADD CONSTRAINT "FactTransactions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "DimCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMerchantMapping" ADD CONSTRAINT "UserMerchantMapping_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "DimCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryRule" ADD CONSTRAINT "CategoryRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "DimCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DimBudget" ADD CONSTRAINT "DimBudget_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "DimCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
