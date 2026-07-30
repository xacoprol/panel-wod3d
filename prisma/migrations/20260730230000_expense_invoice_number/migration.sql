-- AlterTable
ALTER TABLE "Expense" ADD COLUMN "invoiceNumber" TEXT;

-- CreateIndex
CREATE INDEX "Expense_invoiceNumber_idx" ON "Expense"("invoiceNumber");
