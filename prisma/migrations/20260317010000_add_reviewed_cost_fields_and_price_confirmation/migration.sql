ALTER TABLE "SalesForecast" ADD COLUMN "priceBasisConfirmed" BOOLEAN;

ALTER TABLE "CostEstimate" ADD COLUMN "launchCashRequirement" REAL;
ALTER TABLE "CostEstimate" ADD COLUMN "complianceCost" REAL;
ALTER TABLE "CostEstimate" ADD COLUMN "fulfillmentCostPerUnit" REAL;
ALTER TABLE "CostEstimate" ADD COLUMN "warrantyReservePct" REAL;
