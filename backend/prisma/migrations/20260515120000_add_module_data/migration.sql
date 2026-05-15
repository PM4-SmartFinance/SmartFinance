-- CreateTable
CREATE TABLE "ModuleData" (
    "id" TEXT NOT NULL,
    "moduleName" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModuleData_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ModuleData_moduleName_userId_idx" ON "ModuleData"("moduleName", "userId");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "ModuleData_moduleName_userId_key_key" ON "ModuleData"("moduleName", "userId", "key");
