/*
  Warnings:

  - You are about to drop the column `budgetLimit` on the `DimCategory` table. All the data in the column will be lost.
  - You are about to drop the `FactSpending` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `updatedAt` to the `DimCategory` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `DimDate` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `DimMerchant` table without a default value. This is not possible if the table is not empty.
  - Added the required column `defaultCurrencyId` to the `DimUser` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `DimUser` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `UserMerchantMapping` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "FactSpending" DROP CONSTRAINT "FactSpending_dateId_fkey";

-- DropForeignKey
ALTER TABLE "FactSpending" DROP CONSTRAINT "FactSpending_merchantId_fkey";

-- DropForeignKey
ALTER TABLE "FactSpending" DROP CONSTRAINT "FactSpending_userId_fkey";

-- AlterTable
ALTER TABLE "DimCategory" DROP COLUMN "budgetLimit",
ADD COLUMN     "budgetLimitDay" DECIMAL(12,2),
ADD COLUMN     "budgetLimitMonth" DECIMAL(12,2),
ADD COLUMN     "budgetLimitYear" DECIMAL(12,2),
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "DimDate" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "DimMerchant" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "DimUser" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "defaultCurrencyId" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "UserMerchantMapping" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- DropTable
DROP TABLE "FactSpending";

-- CreateTable
CREATE TABLE "FactTransactions" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "dateId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FactTransactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DimAccount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "iban" TEXT NOT NULL,
    "currencyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DimAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DimCurrency" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(3) NOT NULL,
    "name" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DimCurrency_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FactTransactions_userId_idx" ON "FactTransactions"("userId");

-- CreateIndex
CREATE INDEX "FactTransactions_accountId_idx" ON "FactTransactions"("accountId");

-- CreateIndex
CREATE INDEX "FactTransactions_merchantId_idx" ON "FactTransactions"("merchantId");

-- CreateIndex
CREATE INDEX "FactTransactions_dateId_idx" ON "FactTransactions"("dateId");

-- CreateIndex
CREATE INDEX "DimAccount_userId_idx" ON "DimAccount"("userId");

-- CreateIndex
CREATE INDEX "DimAccount_currencyId_idx" ON "DimAccount"("currencyId");

-- CreateIndex
CREATE UNIQUE INDEX "DimAccount_userId_iban_key" ON "DimAccount"("userId", "iban");

-- CreateIndex
CREATE UNIQUE INDEX "DimCurrency_code_key" ON "DimCurrency"("code");

-- AddForeignKey
ALTER TABLE "FactTransactions" ADD CONSTRAINT "FactTransactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "DimUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactTransactions" ADD CONSTRAINT "FactTransactions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "DimAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactTransactions" ADD CONSTRAINT "FactTransactions_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "DimMerchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactTransactions" ADD CONSTRAINT "FactTransactions_dateId_fkey" FOREIGN KEY ("dateId") REFERENCES "DimDate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DimAccount" ADD CONSTRAINT "DimAccount_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "DimCurrency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DimAccount" ADD CONSTRAINT "DimAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "DimUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DimUser" ADD CONSTRAINT "DimUser_defaultCurrencyId_fkey" FOREIGN KEY ("defaultCurrencyId") REFERENCES "DimCurrency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
