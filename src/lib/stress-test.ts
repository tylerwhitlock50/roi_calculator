import type { CostEstimateRecord, ForecastRecord } from '@/lib/api'
import { calculateRoiMetrics, type RoiCalculations } from '@/lib/roi-calculations'

export type ForecastStressMode = 'price' | 'volume'

export type TargetIrrChangeResult = {
  mode: ForecastStressMode
  factor: number
  changePct: number
  calculations: RoiCalculations
}

const EXPANSION_FACTOR = 1.5
const MAX_SEARCH_STEPS = 24
const MAX_BINARY_STEPS = 40
const TARGET_IRR_TOLERANCE = 0.0001
const MIN_FACTOR = 0.05
const MAX_FACTOR = 20

export function scaleForecasts(
  forecasts: ForecastRecord[],
  { priceFactor = 1, unitFactor = 1 }: { priceFactor?: number; unitFactor?: number }
) {
  return forecasts.map((forecast) => ({
    ...forecast,
    monthlyVolumeEstimate: forecast.monthlyVolumeEstimate.map((month) => ({
      ...month,
      units: Math.max(0, month.units * unitFactor),
      price: Math.max(0, month.price * priceFactor),
    })),
  }))
}

export function scaleCostEstimates(costEstimates: CostEstimateRecord[], factor: number) {
  return costEstimates.map((estimate) => ({
    ...estimate,
    toolingCost: estimate.toolingCost * factor,
    engineeringRatePerHour: estimate.engineeringRatePerHour * factor,
    launchCashRequirement: estimate.launchCashRequirement === null ? null : estimate.launchCashRequirement * factor,
    complianceCost: estimate.complianceCost === null ? null : estimate.complianceCost * factor,
    fulfillmentCostPerUnit: estimate.fulfillmentCostPerUnit === null ? null : estimate.fulfillmentCostPerUnit * factor,
    warrantyReservePct: estimate.warrantyReservePct === null ? null : estimate.warrantyReservePct * factor,
    overheadRate: estimate.overheadRate * factor,
    bomParts: estimate.bomParts.map((part) => ({
      ...part,
      unitCost: part.unitCost * factor,
    })),
    laborEntries: estimate.laborEntries.map((entry) => ({
      ...entry,
      activity: {
        ...entry.activity,
        ratePerHour: entry.activity.ratePerHour * factor,
      },
    })),
  }))
}

export function findRequiredForecastChangeForTargetIrr({
  forecasts,
  costEstimates,
  mode,
  targetIrr,
  baseCalculations = calculateRoiMetrics(forecasts, costEstimates),
}: {
  forecasts: ForecastRecord[]
  costEstimates: CostEstimateRecord[]
  mode: ForecastStressMode
  targetIrr: number
  baseCalculations?: RoiCalculations
}): TargetIrrChangeResult | null {
  if (!forecasts.some((forecast) => forecast.monthlyVolumeEstimate.some((month) => month.units > 0 && month.price > 0))) {
    return null
  }

  const evaluate = (factor: number) =>
    calculateRoiMetrics(
      scaleForecasts(
        forecasts,
        mode === 'price' ? { priceFactor: factor } : { unitFactor: factor }
      ),
      costEstimates
    )

  const baseIrr = normalizeIrr(baseCalculations)
  if (Math.abs(baseIrr - targetIrr) <= TARGET_IRR_TOLERANCE) {
    return {
      mode,
      factor: 1,
      changePct: 0,
      calculations: baseCalculations,
    }
  }

  let lowFactor = 1
  let highFactor = 1
  let lowCalculations = baseCalculations
  let highCalculations = baseCalculations

  if (baseIrr < targetIrr) {
    for (let step = 0; step < MAX_SEARCH_STEPS; step += 1) {
      const nextFactor = Math.min(MAX_FACTOR, highFactor * EXPANSION_FACTOR)
      if (nextFactor === highFactor) {
        break
      }

      highFactor = nextFactor
      highCalculations = evaluate(highFactor)
      if (normalizeIrr(highCalculations) >= targetIrr) {
        break
      }
    }

    if (normalizeIrr(highCalculations) < targetIrr) {
      return null
    }
  } else {
    for (let step = 0; step < MAX_SEARCH_STEPS; step += 1) {
      const nextFactor = Math.max(MIN_FACTOR, lowFactor / EXPANSION_FACTOR)
      if (nextFactor === lowFactor) {
        break
      }

      lowFactor = nextFactor
      lowCalculations = evaluate(lowFactor)
      if (normalizeIrr(lowCalculations) <= targetIrr) {
        break
      }
    }

    if (normalizeIrr(lowCalculations) > targetIrr) {
      return null
    }
  }

  let bestFactor = 1
  let bestCalculations = baseCalculations
  let bestDistance = Math.abs(baseIrr - targetIrr)

  for (const candidate of [
    { factor: lowFactor, calculations: lowCalculations },
    { factor: highFactor, calculations: highCalculations },
  ]) {
    const distance = Math.abs(normalizeIrr(candidate.calculations) - targetIrr)
    if (distance < bestDistance) {
      bestFactor = candidate.factor
      bestCalculations = candidate.calculations
      bestDistance = distance
    }
  }

  for (let step = 0; step < MAX_BINARY_STEPS; step += 1) {
    const midFactor = (lowFactor + highFactor) / 2
    const midCalculations = evaluate(midFactor)
    const midIrr = normalizeIrr(midCalculations)
    const distance = Math.abs(midIrr - targetIrr)

    if (distance < bestDistance) {
      bestFactor = midFactor
      bestCalculations = midCalculations
      bestDistance = distance
    }

    if (midIrr < targetIrr) {
      lowFactor = midFactor
      lowCalculations = midCalculations
    } else {
      highFactor = midFactor
      highCalculations = midCalculations
    }
  }

  return {
    mode,
    factor: bestFactor,
    changePct: (bestFactor - 1) * 100,
    calculations: bestCalculations,
  }
}

function normalizeIrr(calculations: RoiCalculations) {
  return Number.isFinite(calculations.irr) ? calculations.irr : Number.NEGATIVE_INFINITY
}
