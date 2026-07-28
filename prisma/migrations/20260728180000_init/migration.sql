-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanySettings" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "nif" TEXT NOT NULL DEFAULT '',
    "addressStreet" TEXT NOT NULL DEFAULT '',
    "addressCity" TEXT NOT NULL DEFAULT '',
    "addressProvince" TEXT NOT NULL DEFAULT '',
    "addressZip" TEXT NOT NULL DEFAULT '',
    "addressCountry" TEXT NOT NULL DEFAULT 'España',
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "logoUrl" TEXT,
    "defaultVatRate" DOUBLE PRECISION NOT NULL DEFAULT 21,
    "defaultIrpfRate" DOUBLE PRECISION NOT NULL DEFAULT 15,
    "emailSubject" TEXT NOT NULL DEFAULT 'Documento {{number}} de {{company}}',
    "emailBody" TEXT NOT NULL DEFAULT 'Adjuntamos el documento {{number}}.

Un saludo,
{{company}}',
    "bankIban" TEXT,
    "bankName" TEXT,
    "themeBg" TEXT NOT NULL DEFAULT '#f3efe6',
    "themeBgElevated" TEXT NOT NULL DEFAULT '#faf7f0',
    "themeInk" TEXT NOT NULL DEFAULT '#1a2332',
    "themeInkMuted" TEXT NOT NULL DEFAULT '#5c6b7a',
    "themeLine" TEXT NOT NULL DEFAULT '#d4cbb8',
    "themeAccent" TEXT NOT NULL DEFAULT '#0d6e6e',
    "themeAccentHover" TEXT NOT NULL DEFAULT '#0a5858',
    "themeAccentSoft" TEXT NOT NULL DEFAULT '#e0f0ef',
    "themeSidebar" TEXT NOT NULL DEFAULT '#1a2332',
    "themeSidebarText" TEXT NOT NULL DEFAULT '#e8e4db',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceSeries" (
    "id" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nextNumber" INTEGER NOT NULL DEFAULT 1,
    "year" INTEGER,
    "padLength" INTEGER NOT NULL DEFAULT 3,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceSeries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteSeries" (
    "id" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nextNumber" INTEGER NOT NULL DEFAULT 1,
    "year" INTEGER,
    "padLength" INTEGER NOT NULL DEFAULT 3,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteSeries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nif" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT 'ES',
    "addressStreet" TEXT NOT NULL,
    "addressCity" TEXT NOT NULL,
    "addressProvince" TEXT NOT NULL,
    "addressZip" TEXT NOT NULL,
    "addressCountry" TEXT NOT NULL DEFAULT 'España',
    "email" TEXT,
    "phone" TEXT,
    "contactPerson" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "seriesPrefix" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "fullNumber" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'BORRADOR',
    "notes" TEXT,
    "conditions" TEXT,
    "subtotal" DECIMAL(65,30) NOT NULL,
    "vatAmount" DECIMAL(65,30) NOT NULL,
    "total" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteLine" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "unitPrice" DECIMAL(65,30) NOT NULL,
    "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 21,
    "discountPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lineSubtotal" DECIMAL(65,30) NOT NULL,
    "lineVat" DECIMAL(65,30) NOT NULL,
    "lineTotal" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "QuoteLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "seriesPrefix" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "fullNumber" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "paymentMethod" TEXT,
    "notes" TEXT,
    "subtotal" DECIMAL(65,30) NOT NULL,
    "vatAmount" DECIMAL(65,30) NOT NULL,
    "irpfRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "irpfAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total" DECIMAL(65,30) NOT NULL,
    "vatOperationType" TEXT NOT NULL DEFAULT 'SUJETA',
    "cashAccounting" BOOLEAN NOT NULL DEFAULT false,
    "operationKey" TEXT,
    "operationKey347" TEXT,
    "quoteId" TEXT,
    "recurringTemplateId" TEXT,
    "verifactuHash" TEXT,
    "verifactuSentAt" TIMESTAMP(3),
    "previousInvoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "unitPrice" DECIMAL(65,30) NOT NULL,
    "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 21,
    "discountPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lineSubtotal" DECIMAL(65,30) NOT NULL,
    "lineVat" DECIMAL(65,30) NOT NULL,
    "lineTotal" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringInvoiceTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "intervalCount" INTEGER NOT NULL DEFAULT 1,
    "dayOfMonth" INTEGER NOT NULL DEFAULT 1,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVA',
    "notes" TEXT,
    "paymentMethod" TEXT,
    "bankIban" TEXT,
    "irpfRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vatOperationType" TEXT NOT NULL DEFAULT 'SUJETA',
    "cashAccounting" BOOLEAN NOT NULL DEFAULT false,
    "operationKey" TEXT,
    "operationKey347" TEXT,
    "nextRunDate" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringInvoiceTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringLine" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "unitPrice" DECIMAL(65,30) NOT NULL,
    "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 21,
    "discountPct" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "RecurringLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CronRunLog" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "success" BOOLEAN NOT NULL DEFAULT false,
    "templatesChecked" INTEGER NOT NULL DEFAULT 0,
    "invoicesCreated" INTEGER NOT NULL DEFAULT 0,
    "details" TEXT,
    "error" TEXT,

    CONSTRAINT "CronRunLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceSeries_prefix_key" ON "InvoiceSeries"("prefix");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteSeries_prefix_key" ON "QuoteSeries"("prefix");

-- CreateIndex
CREATE INDEX "Client_name_idx" ON "Client"("name");

-- CreateIndex
CREATE INDEX "Client_nif_idx" ON "Client"("nif");

-- CreateIndex
CREATE INDEX "Client_countryCode_idx" ON "Client"("countryCode");

-- CreateIndex
CREATE INDEX "Quote_clientId_idx" ON "Quote"("clientId");

-- CreateIndex
CREATE INDEX "Quote_status_idx" ON "Quote"("status");

-- CreateIndex
CREATE INDEX "Quote_issueDate_idx" ON "Quote"("issueDate");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_seriesId_number_key" ON "Quote"("seriesId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_quoteId_key" ON "Invoice"("quoteId");

-- CreateIndex
CREATE INDEX "Invoice_clientId_idx" ON "Invoice"("clientId");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE INDEX "Invoice_issueDate_idx" ON "Invoice"("issueDate");

-- CreateIndex
CREATE INDEX "Invoice_recurringTemplateId_idx" ON "Invoice"("recurringTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_seriesId_number_key" ON "Invoice"("seriesId", "number");

-- CreateIndex
CREATE INDEX "RecurringInvoiceTemplate_status_idx" ON "RecurringInvoiceTemplate"("status");

-- CreateIndex
CREATE INDEX "RecurringInvoiceTemplate_nextRunDate_idx" ON "RecurringInvoiceTemplate"("nextRunDate");

-- CreateIndex
CREATE INDEX "RecurringInvoiceTemplate_clientId_idx" ON "RecurringInvoiceTemplate"("clientId");

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "QuoteSeries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteLine" ADD CONSTRAINT "QuoteLine_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "InvoiceSeries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_recurringTemplateId_fkey" FOREIGN KEY ("recurringTemplateId") REFERENCES "RecurringInvoiceTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_previousInvoiceId_fkey" FOREIGN KEY ("previousInvoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringInvoiceTemplate" ADD CONSTRAINT "RecurringInvoiceTemplate_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringLine" ADD CONSTRAINT "RecurringLine_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "RecurringInvoiceTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

