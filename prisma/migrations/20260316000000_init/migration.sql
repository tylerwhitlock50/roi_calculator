-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Idea" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "positioningStatement" TEXT NOT NULL,
    "requiredAttributes" TEXT NOT NULL,
    "competitorOverview" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdById" TEXT NOT NULL,
    CONSTRAINT "Idea_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SalesForecast" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ideaId" TEXT NOT NULL,
    "contributorId" TEXT NOT NULL,
    "contributorRole" TEXT NOT NULL,
    "channelOrCustomer" TEXT NOT NULL,
    "monthlyVolumeEstimate" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SalesForecast_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "Idea" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SalesForecast_contributorId_fkey" FOREIGN KEY ("contributorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActivityRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "activityName" TEXT NOT NULL,
    "ratePerHour" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CostEstimate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ideaId" TEXT NOT NULL,
    "toolingCost" REAL NOT NULL DEFAULT 0,
    "engineeringHours" INTEGER NOT NULL DEFAULT 0,
    "marketingBudget" REAL NOT NULL DEFAULT 0,
    "marketingCostPerUnit" REAL NOT NULL DEFAULT 0,
    "overheadRate" REAL NOT NULL DEFAULT 60,
    "supportTimePct" REAL NOT NULL DEFAULT 0.2,
    "ppcBudget" REAL NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CostEstimate_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "Idea" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CostEstimate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BomPart" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "costEstimateId" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "unitCost" REAL NOT NULL DEFAULT 0,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "cashEffect" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BomPart_costEstimateId_fkey" FOREIGN KEY ("costEstimateId") REFERENCES "CostEstimate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LaborEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "costEstimateId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "hours" INTEGER NOT NULL DEFAULT 0,
    "minutes" INTEGER NOT NULL DEFAULT 0,
    "seconds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LaborEntry_costEstimateId_fkey" FOREIGN KEY ("costEstimateId") REFERENCES "CostEstimate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LaborEntry_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "ActivityRate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RoiSummary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ideaId" TEXT NOT NULL,
    "npv" REAL NOT NULL DEFAULT 0,
    "irr" REAL NOT NULL DEFAULT 0,
    "breakEvenMonth" INTEGER NOT NULL DEFAULT 0,
    "paybackPeriod" REAL NOT NULL DEFAULT 0,
    "contributionMarginPerUnit" REAL NOT NULL DEFAULT 0,
    "profitPerUnit" REAL NOT NULL DEFAULT 0,
    "assumptions" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RoiSummary_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "Idea" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Idea_createdAt_idx" ON "Idea"("createdAt");

-- CreateIndex
CREATE INDEX "Idea_createdById_idx" ON "Idea"("createdById");

-- CreateIndex
CREATE INDEX "SalesForecast_ideaId_createdAt_idx" ON "SalesForecast"("ideaId", "createdAt");

-- CreateIndex
CREATE INDEX "SalesForecast_contributorId_idx" ON "SalesForecast"("contributorId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityRate_activityName_key" ON "ActivityRate"("activityName");

-- CreateIndex
CREATE INDEX "CostEstimate_ideaId_createdAt_idx" ON "CostEstimate"("ideaId", "createdAt");

-- CreateIndex
CREATE INDEX "CostEstimate_createdById_idx" ON "CostEstimate"("createdById");

-- CreateIndex
CREATE INDEX "BomPart_costEstimateId_idx" ON "BomPart"("costEstimateId");

-- CreateIndex
CREATE INDEX "LaborEntry_costEstimateId_idx" ON "LaborEntry"("costEstimateId");

-- CreateIndex
CREATE INDEX "LaborEntry_activityId_idx" ON "LaborEntry"("activityId");

-- CreateIndex
CREATE UNIQUE INDEX "RoiSummary_ideaId_key" ON "RoiSummary"("ideaId");

