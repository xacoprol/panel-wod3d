-- AlterTable
ALTER TABLE "FiscalFiling" ADD COLUMN "incomeBase" DECIMAL(65,30),
ADD COLUMN "expensesBase" DECIMAL(65,30),
ADD COLUMN "vatRepercutida" DECIMAL(65,30),
ADD COLUMN "vatDeductible" DECIMAL(65,30);
