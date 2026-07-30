-- AlterTable CompanySettings: reminder fields
ALTER TABLE "CompanySettings" ADD COLUMN "reminderEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CompanySettings" ADD COLUMN "reminderDaysBefore" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "CompanySettings" ADD COLUMN "reminderOnOverdue" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "CompanySettings" ADD COLUMN "reminderSubject" TEXT NOT NULL DEFAULT 'Recordatorio: factura {{number}} pendiente';
ALTER TABLE "CompanySettings" ADD COLUMN "reminderBody" TEXT NOT NULL DEFAULT E'Hola {{contact}},\n\nLe recordamos que la factura {{number}} por {{remaining}} vence el {{dueDate}}.\n\nUn saludo,\n{{company}}';

-- CreateTable InvoicePayment
CREATE TABLE "InvoicePayment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoicePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable InvoiceReminderLog
CREATE TABLE "InvoiceReminderLog" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" TEXT NOT NULL,

    CONSTRAINT "InvoiceReminderLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable CatalogItem
CREATE TABLE "CatalogItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unitPrice" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 21,
    "defaultDiscountPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvoicePayment_invoiceId_idx" ON "InvoicePayment"("invoiceId");
CREATE INDEX "InvoicePayment_paidAt_idx" ON "InvoicePayment"("paidAt");
CREATE INDEX "InvoiceReminderLog_invoiceId_idx" ON "InvoiceReminderLog"("invoiceId");
CREATE INDEX "InvoiceReminderLog_sentAt_idx" ON "InvoiceReminderLog"("sentAt");
CREATE INDEX "InvoiceReminderLog_kind_idx" ON "InvoiceReminderLog"("kind");
CREATE INDEX "CatalogItem_name_idx" ON "CatalogItem"("name");
CREATE INDEX "CatalogItem_active_idx" ON "CatalogItem"("active");

-- AddForeignKey
ALTER TABLE "InvoicePayment" ADD CONSTRAINT "InvoicePayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoiceReminderLog" ADD CONSTRAINT "InvoiceReminderLog_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
