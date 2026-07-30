-- CreateTable
CREATE TABLE "MarketplaceIncome" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "externalKey" TEXT NOT NULL,
    "externalRef" TEXT,
    "orderId" TEXT,
    "sku" TEXT,
    "description" TEXT,
    "transactionType" TEXT NOT NULL,
    "vatStatus" TEXT NOT NULL,
    "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(65,30) NOT NULL,
    "vatAmount" DECIMAL(65,30) NOT NULL,
    "total" DECIMAL(65,30) NOT NULL,
    "shipToCountry" TEXT,
    "sourceFile" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceIncome_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketplaceIncome_issueDate_idx" ON "MarketplaceIncome"("issueDate");

-- CreateIndex
CREATE INDEX "MarketplaceIncome_channel_idx" ON "MarketplaceIncome"("channel");

-- CreateIndex
CREATE INDEX "MarketplaceIncome_vatStatus_idx" ON "MarketplaceIncome"("vatStatus");

-- CreateIndex
CREATE INDEX "MarketplaceIncome_externalRef_idx" ON "MarketplaceIncome"("externalRef");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceIncome_channel_externalKey_key" ON "MarketplaceIncome"("channel", "externalKey");
