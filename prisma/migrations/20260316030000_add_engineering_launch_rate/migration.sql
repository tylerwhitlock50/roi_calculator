ALTER TABLE "CostEstimate" ADD COLUMN "engineeringRatePerHour" REAL NOT NULL DEFAULT 125;

CREATE TABLE "new_CostEstimate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ideaId" TEXT NOT NULL,
    "toolingCost" REAL NOT NULL DEFAULT 0,
    "engineeringHours" REAL NOT NULL DEFAULT 0,
    "engineeringRatePerHour" REAL NOT NULL DEFAULT 125,
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

INSERT INTO "new_CostEstimate" (
    "id",
    "ideaId",
    "toolingCost",
    "engineeringHours",
    "engineeringRatePerHour",
    "marketingBudget",
    "marketingCostPerUnit",
    "overheadRate",
    "supportTimePct",
    "ppcBudget",
    "createdById",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "ideaId",
    "toolingCost",
    CAST("engineeringHours" AS REAL),
    "engineeringRatePerHour",
    "marketingBudget",
    "marketingCostPerUnit",
    "overheadRate",
    "supportTimePct",
    "ppcBudget",
    "createdById",
    "createdAt",
    "updatedAt"
FROM "CostEstimate";

DROP TABLE "CostEstimate";

ALTER TABLE "new_CostEstimate" RENAME TO "CostEstimate";

CREATE INDEX "CostEstimate_ideaId_createdAt_idx" ON "CostEstimate"("ideaId", "createdAt");
CREATE INDEX "CostEstimate_createdById_idx" ON "CostEstimate"("createdById");
