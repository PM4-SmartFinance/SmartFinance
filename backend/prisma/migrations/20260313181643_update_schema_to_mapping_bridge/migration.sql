/*
  Warnings:

  - You are about to drop the `Budget` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Category` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CategoryRule` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `LineItem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Transaction` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Budget" DROP CONSTRAINT "Budget_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "Budget" DROP CONSTRAINT "Budget_userId_fkey";

-- DropForeignKey
ALTER TABLE "Category" DROP CONSTRAINT "Category_userId_fkey";

-- DropForeignKey
ALTER TABLE "CategoryRule" DROP CONSTRAINT "CategoryRule_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "LineItem" DROP CONSTRAINT "LineItem_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "LineItem" DROP CONSTRAINT "LineItem_transactionId_fkey";

-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_userId_fkey";

-- DropTable
DROP TABLE "Budget";

-- DropTable
DROP TABLE "Category";

-- DropTable
DROP TABLE "CategoryRule";

-- DropTable
DROP TABLE "LineItem";

-- DropTable
DROP TABLE "Transaction";

-- DropTable
DROP TABLE "User";

-- CreateTable
CREATE TABLE "FactSpending" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "userId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "dateId" INTEGER NOT NULL,

    CONSTRAINT "FactSpending_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserMerchantMapping" (
    "userId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "UserMerchantMapping_pkey" PRIMARY KEY ("userId","merchantId")
);

-- CreateTable
CREATE TABLE "DimMerchant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "DimMerchant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DimCategory" (
    "id" TEXT NOT NULL,
    "categoryName" TEXT NOT NULL,
    "budgetLimit" DECIMAL(12,2) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "DimCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DimUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT NOT NULL,

    CONSTRAINT "DimUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DimDate" (
    "id" INTEGER NOT NULL,
    "dayOfWeek" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,

    CONSTRAINT "DimDate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FactSpending_userId_idx" ON "FactSpending"("userId");

-- CreateIndex
CREATE INDEX "FactSpending_merchantId_idx" ON "FactSpending"("merchantId");

-- CreateIndex
CREATE INDEX "FactSpending_dateId_idx" ON "FactSpending"("dateId");

-- CreateIndex
CREATE INDEX "UserMerchantMapping_categoryId_idx" ON "UserMerchantMapping"("categoryId");

-- CreateIndex
CREATE INDEX "DimCategory_userId_idx" ON "DimCategory"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DimCategory_userId_categoryName_key" ON "DimCategory"("userId", "categoryName");

-- CreateIndex
CREATE UNIQUE INDEX "DimUser_email_key" ON "DimUser"("email");

-- AddForeignKey
ALTER TABLE "FactSpending" ADD CONSTRAINT "FactSpending_userId_fkey" FOREIGN KEY ("userId") REFERENCES "DimUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactSpending" ADD CONSTRAINT "FactSpending_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "DimMerchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactSpending" ADD CONSTRAINT "FactSpending_dateId_fkey" FOREIGN KEY ("dateId") REFERENCES "DimDate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMerchantMapping" ADD CONSTRAINT "UserMerchantMapping_userId_fkey" FOREIGN KEY ("userId") REFERENCES "DimUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMerchantMapping" ADD CONSTRAINT "UserMerchantMapping_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "DimMerchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMerchantMapping" ADD CONSTRAINT "UserMerchantMapping_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "DimCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DimCategory" ADD CONSTRAINT "DimCategory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "DimUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
