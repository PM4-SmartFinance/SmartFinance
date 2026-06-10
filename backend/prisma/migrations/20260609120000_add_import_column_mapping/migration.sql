-- CreateTable
CREATE TABLE "ImportColumnMapping" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "headerSignature" TEXT NOT NULL,
    "format" TEXT,
    "mapping" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportColumnMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportColumnMapping_userId_idx" ON "ImportColumnMapping"("userId");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "ImportColumnMapping_userId_headerSignature_key" ON "ImportColumnMapping"("userId", "headerSignature");

-- AddForeignKey
ALTER TABLE "ImportColumnMapping" ADD CONSTRAINT "ImportColumnMapping_userId_fkey" FOREIGN KEY ("userId") REFERENCES "DimUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
