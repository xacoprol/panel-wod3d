-- CreateTable
CREATE TABLE "FiscalFiling" (
    "id" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "modelType" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "quarter" INTEGER,
    "filedAt" TIMESTAMP(3),
    "result" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "boxes" JSONB NOT NULL,
    "rawExtract" JSONB,
    "sourceFileName" TEXT,
    "notes" TEXT,
    "confidence" TEXT NOT NULL DEFAULT 'medium',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiscalFiling_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FiscalFiling_periodKey_key" ON "FiscalFiling"("periodKey");

-- CreateIndex
CREATE INDEX "FiscalFiling_modelType_year_idx" ON "FiscalFiling"("modelType", "year");

-- CreateIndex
CREATE INDEX "FiscalFiling_year_quarter_idx" ON "FiscalFiling"("year", "quarter");
