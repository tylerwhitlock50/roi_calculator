-- Add scrap rate to cost estimates so COPQ/yield can be modeled directly.
ALTER TABLE "CostEstimate"
ADD COLUMN "scrapRate" REAL NOT NULL DEFAULT 0;
