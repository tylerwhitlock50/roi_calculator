-- CreateTable
CREATE TABLE "VentureSummary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ideaId" TEXT NOT NULL,
    "marketCeiling24Month" REAL NOT NULL DEFAULT 0,
    "marketCeiling36Month" REAL NOT NULL DEFAULT 0,
    "probabilitySuccessPct" REAL NOT NULL DEFAULT 0,
    "adjacencyScore" INTEGER NOT NULL DEFAULT 1,
    "asymmetricUpsideScore" INTEGER NOT NULL DEFAULT 1,
    "attentionDemandScore" INTEGER NOT NULL DEFAULT 1,
    "speedToSignalDays" INTEGER NOT NULL DEFAULT 120,
    "validationCapital" REAL NOT NULL DEFAULT 0,
    "buildCapital" REAL NOT NULL DEFAULT 0,
    "scaleCapital" REAL NOT NULL DEFAULT 0,
    "ventureScore" REAL NOT NULL DEFAULT 0,
    "recommendationBucket" TEXT NOT NULL DEFAULT 'Kill',
    "recommendedStage" TEXT NOT NULL DEFAULT 'None',
    "forecastRevenue24Month" REAL NOT NULL DEFAULT 0,
    "forecastRevenue36Month" REAL NOT NULL DEFAULT 0,
    "expectedOpportunityValue" REAL NOT NULL DEFAULT 0,
    "returnOnFocus" REAL NOT NULL DEFAULT 0,
    "accessCapital" REAL NOT NULL DEFAULT 0,
    "capitalEfficiencyRatio" REAL NOT NULL DEFAULT 0,
    "salesPerEngineeringHour" REAL NOT NULL DEFAULT 0,
    "contributionMarginPct" REAL NOT NULL DEFAULT 0,
    "assumptions" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VentureSummary_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "Idea" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "VentureSummary_ideaId_key" ON "VentureSummary"("ideaId");
