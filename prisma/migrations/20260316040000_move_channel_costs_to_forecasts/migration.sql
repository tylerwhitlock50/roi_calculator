ALTER TABLE "SalesForecast" ADD COLUMN "monthlyMarketingSpend" REAL NOT NULL DEFAULT 0;
ALTER TABLE "SalesForecast" ADD COLUMN "marketingCostPerUnit" REAL NOT NULL DEFAULT 0;
ALTER TABLE "SalesForecast" ADD COLUMN "customerAcquisitionCostPerUnit" REAL NOT NULL DEFAULT 0;

UPDATE "SalesForecast"
SET
  "monthlyMarketingSpend" = COALESCE(
    (
      SELECT "marketingBudget" / NULLIF(
        (
          SELECT COUNT(*)
          FROM "SalesForecast" AS "ForecastCount"
          WHERE "ForecastCount"."ideaId" = "SalesForecast"."ideaId"
        ),
        0
      )
      FROM "CostEstimate"
      WHERE "CostEstimate"."ideaId" = "SalesForecast"."ideaId"
      ORDER BY "createdAt" DESC
      LIMIT 1
    ),
    0
  ),
  "marketingCostPerUnit" = COALESCE(
    (
      SELECT "marketingCostPerUnit"
      FROM "CostEstimate"
      WHERE "CostEstimate"."ideaId" = "SalesForecast"."ideaId"
      ORDER BY "createdAt" DESC
      LIMIT 1
    ),
    0
  ),
  "customerAcquisitionCostPerUnit" = COALESCE(
    (
      SELECT "ppcBudget"
      FROM "CostEstimate"
      WHERE "CostEstimate"."ideaId" = "SalesForecast"."ideaId"
      ORDER BY "createdAt" DESC
      LIMIT 1
    ),
    0
  );

CREATE TABLE "new_CostEstimate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ideaId" TEXT NOT NULL,
    "toolingCost" REAL NOT NULL DEFAULT 0,
    "engineeringHours" REAL NOT NULL DEFAULT 0,
    "engineeringRatePerHour" REAL NOT NULL DEFAULT 125,
    "overheadRate" REAL NOT NULL DEFAULT 60,
    "supportTimePct" REAL NOT NULL DEFAULT 0.2,
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
    "overheadRate",
    "supportTimePct",
    "createdById",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "ideaId",
    "toolingCost",
    "engineeringHours",
    "engineeringRatePerHour",
    "overheadRate",
    "supportTimePct",
    "createdById",
    "createdAt",
    "updatedAt"
FROM "CostEstimate";

DROP TABLE "CostEstimate";

ALTER TABLE "new_CostEstimate" RENAME TO "CostEstimate";

CREATE INDEX "CostEstimate_ideaId_createdAt_idx" ON "CostEstimate"("ideaId", "createdAt");
CREATE INDEX "CostEstimate_createdById_idx" ON "CostEstimate"("createdById");
