import type { CostEstimateRecord, ForecastRecord } from '@/lib/api'
import { calculateRoiMetrics, calculateUnitEconomics, type RoiCalculations } from '@/lib/roi-calculations'

export type RoiDecisionVerdict = 'Proceed' | 'Proceed with caveats' | 'Do not proceed'

export type RoiDownsideSummary = {
  calculations: RoiCalculations
  survives: boolean
  breakEvenWithinHorizon: boolean
  description: string
}

export type RoiDecisionSummary = {
  verdict: RoiDecisionVerdict
  why: string[]
  missingReviewItems: string[]
  nextAction: string
  baseCasePasses: boolean
  breakEvenWithinHorizon: boolean
  downside: RoiDownsideSummary
}

export const STANDARD_DOWNSIDE_DESCRIPTION =
  'Price -10%, volume -20%, COGS +10%, CAC +15%, fulfillment +10%.'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatUnitCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

export function hasBreakEvenWithinHorizon(calculations: RoiCalculations) {
  let cumulative = 0

  for (const flow of calculations.cashFlows) {
    cumulative += flow.total
    if (cumulative >= 0) {
      return true
    }
  }

  return false
}

export function calculateStandardDownsideMetrics(
  forecasts: ForecastRecord[],
  costEstimates: CostEstimateRecord[]
): RoiCalculations {
  const downsideForecasts = forecasts.map((forecast) => ({
    ...forecast,
    customerAcquisitionCostPerUnit: forecast.customerAcquisitionCostPerUnit * 1.15,
    monthlyVolumeEstimate: forecast.monthlyVolumeEstimate.map((month) => ({
      ...month,
      units: Math.max(0, month.units * 0.8),
      price: Math.max(0, month.price * 0.9),
    })),
  }))

  const downsideCosts = costEstimates.map((estimate) => ({
    ...estimate,
    fulfillmentCostPerUnit:
      estimate.fulfillmentCostPerUnit === null ? null : estimate.fulfillmentCostPerUnit * 1.1,
    bomParts: estimate.bomParts.map((part) => ({
      ...part,
      unitCost: part.unitCost * 1.1,
    })),
  }))

  return calculateRoiMetrics(downsideForecasts, downsideCosts)
}

function buildMissingReviewItems(forecasts: ForecastRecord[], estimate?: CostEstimateRecord) {
  const items: string[] = []

  if (!forecasts.length) {
    items.push('Add at least one saved forecast.')
  }

  if (forecasts.some((forecast) => forecast.priceBasisConfirmed !== true)) {
    items.push('Confirm that every forecast price is net to the business.')
  }

  if (!estimate) {
    items.push('Add a saved cost estimate for the current product concept.')
    return items
  }

  if (estimate.launchCashRequirement === null) {
    items.push('Review the launch cash requirement.')
  }

  if (estimate.complianceCost === null) {
    items.push('Review compliance cost.')
  }

  if (estimate.fulfillmentCostPerUnit === null) {
    items.push('Review fulfillment cost per unit.')
  }

  if (estimate.warrantyReservePct === null) {
    items.push('Review warranty reserve percentage.')
  }

  return items
}

export function buildRoiDecisionSummary({
  forecasts,
  costEstimates,
  calculations = calculateRoiMetrics(forecasts, costEstimates),
}: {
  forecasts: ForecastRecord[]
  costEstimates: CostEstimateRecord[]
  calculations?: RoiCalculations
}): RoiDecisionSummary {
  const latestEstimate = costEstimates[0]
  const unitEconomics = calculateUnitEconomics(forecasts, costEstimates)
  const downsideCalculations = calculateStandardDownsideMetrics(forecasts, costEstimates)
  const breakEvenWithinHorizon = hasBreakEvenWithinHorizon(calculations)
  const downsideBreakEvenWithinHorizon = hasBreakEvenWithinHorizon(downsideCalculations)
  const missingReviewItems = buildMissingReviewItems(forecasts, latestEstimate)
  const baseCasePasses = calculations.profitPerUnit > 0 && calculations.irr >= 0.1 && breakEvenWithinHorizon
  const downsideSurvives =
    downsideCalculations.profitPerUnit > 0 &&
    downsideCalculations.irr >= 0.1 &&
    downsideBreakEvenWithinHorizon

  let verdict: RoiDecisionVerdict = 'Proceed'
  if (!baseCasePasses) {
    verdict = 'Do not proceed'
  } else if (!downsideSurvives || missingReviewItems.length > 0) {
    verdict = 'Proceed with caveats'
  }

  const largestRecurringBucket =
    unitEconomics.costStack
      .filter((segment) => !['Profit', 'Funding needed', 'Upfront launch / unit'].includes(segment.label))
      .sort((left, right) => right.value - left.value)[0] ?? null

  const why = [
    `Blended net price is ${formatUnitCurrency(unitEconomics.averageSellingPrice)} per unit against ${formatUnitCurrency(unitEconomics.recurringCostPerUnit)} recurring cost, leaving ${formatUnitCurrency(calculations.contributionMarginPerUnit)} contribution.`,
    `Upfront launch investment is ${formatCurrency(Number(calculations.assumptions.upfrontCost ?? 0))}, or ${formatUnitCurrency(unitEconomics.upfrontCostPerUnit)} per unit across ${Number(calculations.assumptions.totalUnits ?? 0).toLocaleString()} forecast units.`,
    largestRecurringBucket
      ? `Largest recurring cost bucket is ${largestRecurringBucket.label.toLowerCase()} at ${formatUnitCurrency(largestRecurringBucket.value)} per unit across ${unitEconomics.monthsCount} active forecast months.`
      : `The model covers ${Number(calculations.assumptions.totalUnits ?? 0).toLocaleString()} forecast units across ${unitEconomics.monthsCount} active forecast months.`,
  ]

  let nextAction = 'Move forward with a scoped launch plan and validate the first production run against these assumptions.'
  if (verdict === 'Proceed with caveats') {
    nextAction = 'Resolve the flagged review items or tighten the downside exposure before treating this as a clean go decision.'
  } else if (verdict === 'Do not proceed') {
    nextAction = 'Rework price, volume, or cost structure before committing launch cash.'
  }

  return {
    verdict,
    why,
    missingReviewItems,
    nextAction,
    baseCasePasses,
    breakEvenWithinHorizon,
    downside: {
      calculations: downsideCalculations,
      survives: downsideSurvives,
      breakEvenWithinHorizon: downsideBreakEvenWithinHorizon,
      description: STANDARD_DOWNSIDE_DESCRIPTION,
    },
  }
}

export function buildRoiDecisionSnapshot(summary: RoiDecisionSummary) {
  return {
    verdict: summary.verdict,
    why: summary.why,
    missingReviewItems: summary.missingReviewItems,
    nextAction: summary.nextAction,
    baseCasePasses: summary.baseCasePasses,
    breakEvenWithinHorizon: summary.breakEvenWithinHorizon,
    downside: {
      description: summary.downside.description,
      survives: summary.downside.survives,
      breakEvenWithinHorizon: summary.downside.breakEvenWithinHorizon,
      npv: Number(summary.downside.calculations.npv.toFixed(2)),
      irr: Number(summary.downside.calculations.irr.toFixed(4)),
      profitPerUnit: Number(summary.downside.calculations.profitPerUnit.toFixed(2)),
    },
  }
}

export function formatVerdictTone(verdict: RoiDecisionVerdict) {
  if (verdict === 'Proceed') {
    return 'positive'
  }

  if (verdict === 'Proceed with caveats') {
    return 'caution'
  }

  return 'negative'
}

export function formatBreakEvenSummary(calculations: RoiCalculations) {
  return hasBreakEvenWithinHorizon(calculations)
    ? `Break-even by month ${calculations.breakEvenMonth}`
    : 'No break-even in modeled horizon'
}

export function formatDownsideSummary(summary: RoiDownsideSummary) {
  return `${summary.survives ? 'Survives downside' : 'Fails downside'}: NPV ${formatCurrency(summary.calculations.npv)}, IRR ${formatPercent(summary.calculations.irr)}, profit / unit ${formatUnitCurrency(summary.calculations.profitPerUnit)}.`
}
