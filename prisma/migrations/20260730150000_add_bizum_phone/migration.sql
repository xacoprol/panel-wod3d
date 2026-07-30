-- AlterTable
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "bizumPhone" TEXT DEFAULT '603024030';

UPDATE "CompanySettings"
SET "bizumPhone" = '603024030'
WHERE "bizumPhone" IS NULL;
