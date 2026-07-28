-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Client" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Client" ("addressCity", "addressCountry", "addressProvince", "addressStreet", "addressZip", "contactPerson", "createdAt", "email", "id", "name", "nif", "notes", "phone", "updatedAt") SELECT "addressCity", "addressCountry", "addressProvince", "addressStreet", "addressZip", "contactPerson", "createdAt", "email", "id", "name", "nif", "notes", "phone", "updatedAt" FROM "Client";
DROP TABLE "Client";
ALTER TABLE "new_Client" RENAME TO "Client";
CREATE INDEX "Client_name_idx" ON "Client"("name");
CREATE INDEX "Client_nif_idx" ON "Client"("nif");
CREATE INDEX "Client_countryCode_idx" ON "Client"("countryCode");
CREATE TABLE "new_Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seriesId" TEXT NOT NULL,
    "seriesPrefix" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "fullNumber" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "issueDate" DATETIME NOT NULL,
    "dueDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "paymentMethod" TEXT,
    "notes" TEXT,
    "subtotal" DECIMAL NOT NULL,
    "vatAmount" DECIMAL NOT NULL,
    "irpfRate" REAL NOT NULL DEFAULT 0,
    "irpfAmount" DECIMAL NOT NULL DEFAULT 0,
    "total" DECIMAL NOT NULL,
    "vatOperationType" TEXT NOT NULL DEFAULT 'SUJETA',
    "cashAccounting" BOOLEAN NOT NULL DEFAULT false,
    "operationKey" TEXT,
    "operationKey347" TEXT,
    "quoteId" TEXT,
    "recurringTemplateId" TEXT,
    "verifactuHash" TEXT,
    "verifactuSentAt" DATETIME,
    "previousInvoiceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Invoice_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "InvoiceSeries" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Invoice_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Invoice_recurringTemplateId_fkey" FOREIGN KEY ("recurringTemplateId") REFERENCES "RecurringInvoiceTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Invoice_previousInvoiceId_fkey" FOREIGN KEY ("previousInvoiceId") REFERENCES "Invoice" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Invoice" ("clientId", "createdAt", "dueDate", "fullNumber", "id", "irpfAmount", "irpfRate", "issueDate", "notes", "number", "paymentMethod", "previousInvoiceId", "quoteId", "recurringTemplateId", "seriesId", "seriesPrefix", "status", "subtotal", "total", "updatedAt", "vatAmount", "verifactuHash", "verifactuSentAt") SELECT "clientId", "createdAt", "dueDate", "fullNumber", "id", "irpfAmount", "irpfRate", "issueDate", "notes", "number", "paymentMethod", "previousInvoiceId", "quoteId", "recurringTemplateId", "seriesId", "seriesPrefix", "status", "subtotal", "total", "updatedAt", "vatAmount", "verifactuHash", "verifactuSentAt" FROM "Invoice";
DROP TABLE "Invoice";
ALTER TABLE "new_Invoice" RENAME TO "Invoice";
CREATE UNIQUE INDEX "Invoice_quoteId_key" ON "Invoice"("quoteId");
CREATE INDEX "Invoice_clientId_idx" ON "Invoice"("clientId");
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");
CREATE INDEX "Invoice_issueDate_idx" ON "Invoice"("issueDate");
CREATE INDEX "Invoice_recurringTemplateId_idx" ON "Invoice"("recurringTemplateId");
CREATE UNIQUE INDEX "Invoice_seriesId_number_key" ON "Invoice"("seriesId", "number");
CREATE TABLE "new_RecurringInvoiceTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "intervalCount" INTEGER NOT NULL DEFAULT 1,
    "dayOfMonth" INTEGER NOT NULL DEFAULT 1,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ACTIVA',
    "notes" TEXT,
    "paymentMethod" TEXT,
    "bankIban" TEXT,
    "irpfRate" REAL NOT NULL DEFAULT 0,
    "vatOperationType" TEXT NOT NULL DEFAULT 'SUJETA',
    "cashAccounting" BOOLEAN NOT NULL DEFAULT false,
    "operationKey" TEXT,
    "operationKey347" TEXT,
    "nextRunDate" DATETIME,
    "lastRunAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RecurringInvoiceTemplate_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_RecurringInvoiceTemplate" ("clientId", "createdAt", "dayOfMonth", "endDate", "frequency", "id", "irpfRate", "lastRunAt", "name", "nextRunDate", "notes", "seriesId", "startDate", "status", "updatedAt") SELECT "clientId", "createdAt", "dayOfMonth", "endDate", "frequency", "id", "irpfRate", "lastRunAt", "name", "nextRunDate", "notes", "seriesId", "startDate", "status", "updatedAt" FROM "RecurringInvoiceTemplate";
DROP TABLE "RecurringInvoiceTemplate";
ALTER TABLE "new_RecurringInvoiceTemplate" RENAME TO "RecurringInvoiceTemplate";
CREATE INDEX "RecurringInvoiceTemplate_status_idx" ON "RecurringInvoiceTemplate"("status");
CREATE INDEX "RecurringInvoiceTemplate_nextRunDate_idx" ON "RecurringInvoiceTemplate"("nextRunDate");
CREATE INDEX "RecurringInvoiceTemplate_clientId_idx" ON "RecurringInvoiceTemplate"("clientId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
