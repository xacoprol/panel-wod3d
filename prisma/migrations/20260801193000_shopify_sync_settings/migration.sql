-- AlterTable
ALTER TABLE "CompanySettings" ADD COLUMN "shopifyShop" TEXT;
ALTER TABLE "CompanySettings" ADD COLUMN "shopifyAccessToken" TEXT;
ALTER TABLE "CompanySettings" ADD COLUMN "shopifyLastSyncAt" TIMESTAMP(3);
