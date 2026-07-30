-- AlterTable
ALTER TABLE "CompanySettings" ADD COLUMN "fiscalRegime" TEXT NOT NULL DEFAULT '130';

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "supplierName" TEXT NOT NULL,
    "supplierNif" TEXT,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'OTROS',
    "subtotal" DECIMAL(65,30) NOT NULL,
    "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 21,
    "vatAmount" DECIMAL(65,30) NOT NULL,
    "total" DECIMAL(65,30) NOT NULL,
    "deductible" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Expense_issueDate_idx" ON "Expense"("issueDate");

-- CreateIndex
CREATE INDEX "Expense_category_idx" ON "Expense"("category");

-- CreateIndex
CREATE INDEX "Expense_supplierName_idx" ON "Expense"("supplierName");
