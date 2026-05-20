-- CreateEnum
CREATE TYPE "MatchType" AS ENUM ('exact', 'contains', 'regex');

-- AlterTable: cast existing string values to the new enum.
-- Drop the unique index first because it depends on the column type.
DROP INDEX IF EXISTS "CategoryRule_userId_pattern_matchType_key";

ALTER TABLE "CategoryRule"
  ALTER COLUMN "matchType" TYPE "MatchType"
  USING "matchType"::"MatchType";

-- Recreate the unique index with the new column type.
CREATE UNIQUE INDEX "CategoryRule_userId_pattern_matchType_key"
  ON "CategoryRule"("userId", "pattern", "matchType");
