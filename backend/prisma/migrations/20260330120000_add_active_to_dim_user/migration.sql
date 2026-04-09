-- Add active column to DimUser for soft-delete support
ALTER TABLE "DimUser" ADD COLUMN "active" boolean NOT NULL DEFAULT true;

-- Ensure new column has an index if desired (optional)
CREATE INDEX IF NOT EXISTS "DimUser_active_idx" ON "DimUser"("active");

