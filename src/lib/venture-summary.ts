import type {
  CostEstimateRecord,
  ForecastRecord,
  VentureRecommendationBucket,
  VentureRecommendedStage,
  VentureSummaryRecord,
} from '@/lib/api'
import { calculateUnitEconomics } from '@/lib/roi-calculations'

export type VentureManualInputs = {
  marketCeiling24Month: number
  marketCeiling36Month: number
  probabilitySuccessPct: number
  adjacencyScore: number
  asymmetricUpsideScore: number
  attentionDemandScore: number
  speedToSignalDays: number
  validationCapital: number
  buildCapital: number
  scaleCapital: number
}

export type VentureComputedSummary = VentureManualInputs & {
  ventureScore: number
  recommendationBucket: VentureRecommendationBucket
  recommendedStage: VentureRecommendedStage
  forecastRevenue24Month: number
  forecastRevenue36Month: number
  expectedOpportunityValue: number
  returnOnFocus: number
  accessCapital: number
  capitalEfficiencyRatio: number
  salesPerEngineeringHour: number
  contributionMarginPct: number
  assumptions: Record<string, unknown>
}

export const VENTURE_SCORE_MAX = 100
export const VENTURE_SCORE_BUCKETS = [
  { label: 'Kill', min: 0, max: 39 },
  { label: 'Validate cheaply', min: 40, max: 59 },
  { label: 'Stage build', min: 60, max: 79 },
  { label: 'Fund aggressively', min: 80, max: 100 },
] as const

export function getVentureRecommendationTone(bucket: VentureRecommendationBucket) {
  if (bucket === 'Fund aggressively') {
    return 'positive'
  }

  if (bucket === 'Stage build' || bucket === 'Validate cheaply') {
    return 'caution'
  }

  return 'negative'
}

export function getRecommendedStageCapital(
  summary: Pick<VentureManualInputs, 'validationCapital' | 'buildCapital' | 'scaleCapital'> & {
    recommendedStage: VentureRecommendedStage
  }
) {
  switch (summary.recommendedStage) {
    case 'Stage 1':
      return summary.validationCapital
    case 'Stage 2':
      return summary.buildCapital
    case 'Stage 3':
      return summary.scaleCapital
    case 'None':
    default:
      return 0
  }
}

type VentureInputSource = Pick<
  VentureSummaryRecord,
  | 'marketCeiling24Month'
  | 'marketCeiling36Month'
  | 'probabilitySuccessPct'
  | 'adjacencyScore'
  | 'asymmetricUpsideScore'
  | 'attentionDemandScore'
  | 'speedToSignalDays'
  | 'validationCapital'
  | 'buildCapital'
  | 'scaleCapital'
>

const EXPECTED_OPPORTUNITY_TARGET = 2_000_000
const CAPITAL_EFFICIENCY_TARGET = 20
const SPEED_SCORE_BY_DAYS: Record<number, number> = {
  30: 15,
  60: 10,
  90: 5,
  120: 0,
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function roundCurrency(value: number) {
  return Number(value.toFixed(2))
}

function roundRatio(value: number) {
  return Number(value.toFixed(4))
}

function normalizeManualInputs(inputs: VentureManualInputs): VentureManualInputs {
  const normalized24Month = Math.max(0, Number(inputs.marketCeiling24Month) || 0)

  return {
    marketCeiling24Month: normalized24Month,
    marketCeiling36Month: Math.max(0, Number(inputs.marketCeiling36Month) || normalized24Month),
    probabilitySuccessPct: clamp(Number(inputs.probabilitySuccessPct) || 0, 0, 1),
    adjacencyScore: Math.round(clamp(Number(inputs.adjacencyScore) || 1, 1, 10)),
    asymmetricUpsideScore: Math.round(clamp(Number(inputs.asymmetricUpsideScore) || 1, 1, 10)),
    attentionDemandScore: Math.round(clamp(Number(inputs.attentionDemandScore) || 1, 1, 10)),
    speedToSignalDays: [30, 60, 90, 120].includes(Number(inputs.speedToSignalDays))
      ? Number(inputs.speedToSignalDays)
      : 120,
    validationCapital: Math.max(0, Number(inputs.validationCapital) || 0),
    buildCapital: Math.max(0, Number(inputs.buildCapital) || 0),
    scaleCapital: Math.max(0, Number(inputs.scaleCapital) || 0),
  }
}

function scoreLinear(value: number, maxValue: number, maxPoints: number) {
  return clamp(value / Math.max(maxValue, 1), 0, 1) * maxPoints
}

function scoreTenPointInput(score: number, maxPoints: number) {
  return ((clamp(score, 1, 10) - 1) / 9) * maxPoints
}

function calculateContributionLeveragePoints(contributionMarginPct: number) {
  if (contributionMarginPct >= 0.4) {
    return 10
  }

  if (contributionMarginPct >= 0.3) {
    return 7
  }

  if (contributionMarginPct >= 0.2) {
    return 4
  }

  return 0
}

function calculateForecastRevenueForMonths(forecasts: ForecastRecord[], horizonMonths: number) {
  const revenueByMonth: Record<string, number> = {}

  for (const forecast of forecasts) {
    for (const month of forecast.monthlyVolumeEstimate) {
      if (!month.month_date || month.units <= 0 || month.price <= 0) {
        continue
      }

      revenueByMonth[month.month_date] = (revenueByMonth[month.month_date] ?? 0) + month.units * month.price
    }
  }

  return Object.keys(revenueByMonth)
    .sort()
    .slice(0, horizonMonths)
    .reduce((sum, month) => sum + revenueByMonth[month], 0)
}

function mapBucket(score: number): VentureRecommendationBucket {
  if (score >= 80) {
    return 'Fund aggressively'
  }

  if (score >= 60) {
    return 'Stage build'
  }

  if (score >= 40) {
    return 'Validate cheaply'
  }

  return 'Kill'
}

function mapStage(bucket: VentureRecommendationBucket): VentureRecommendedStage {
  switch (bucket) {
    case 'Validate cheaply':
      return 'Stage 1'
    case 'Stage build':
      return 'Stage 2'
    case 'Fund aggressively':
      return 'Stage 3'
    case 'Kill':
    default:
      return 'None'
  }
}

function buildComparableSummaryShape(
  summary: Pick<
    VentureComputedSummary,
    | 'marketCeiling24Month'
    | 'marketCeiling36Month'
    | 'probabilitySuccessPct'
    | 'adjacencyScore'
    | 'asymmetricUpsideScore'
    | 'attentionDemandScore'
    | 'speedToSignalDays'
    | 'validationCapital'
    | 'buildCapital'
    | 'scaleCapital'
    | 'ventureScore'
    | 'recommendationBucket'
    | 'recommendedStage'
    | 'forecastRevenue24Month'
    | 'forecastRevenue36Month'
    | 'expectedOpportunityValue'
    | 'returnOnFocus'
    | 'accessCapital'
    | 'capitalEfficiencyRatio'
    | 'salesPerEngineeringHour'
    | 'contributionMarginPct'
  >
) {
  return {
    marketCeiling24Month: Number(summary.marketCeiling24Month.toFixed(2)),
    marketCeiling36Month: Number(summary.marketCeiling36Month.toFixed(2)),
    probabilitySuccessPct: Number(summary.probabilitySuccessPct.toFixed(4)),
    adjacencyScore: summary.adjacencyScore,
    asymmetricUpsideScore: summary.asymmetricUpsideScore,
    attentionDemandScore: summary.attentionDemandScore,
    speedToSignalDays: summary.speedToSignalDays,
    validationCapital: Number(summary.validationCapital.toFixed(2)),
    buildCapital: Number(summary.buildCapital.toFixed(2)),
    scaleCapital: Number(summary.scaleCapital.toFixed(2)),
    ventureScore: Number(summary.ventureScore.toFixed(2)),
    recommendationBucket: summary.recommendationBucket,
    recommendedStage: summary.recommendedStage,
    forecastRevenue24Month: Number(summary.forecastRevenue24Month.toFixed(2)),
    forecastRevenue36Month: Number(summary.forecastRevenue36Month.toFixed(2)),
    expectedOpportunityValue: Number(summary.expectedOpportunityValue.toFixed(2)),
    returnOnFocus: Number(summary.returnOnFocus.toFixed(2)),
    accessCapital: Number(summary.accessCapital.toFixed(2)),
    capitalEfficiencyRatio: Number(summary.capitalEfficiencyRatio.toFixed(4)),
    salesPerEngineeringHour: Number(summary.salesPerEngineeringHour.toFixed(2)),
    contributionMarginPct: Number(summary.contributionMarginPct.toFixed(4)),
  }
}

export function getVentureManualInputsFromSummary(summary: VentureInputSource): VentureManualInputs {
  return {
    marketCeiling24Month: summary.marketCeiling24Month,
    marketCeiling36Month: summary.marketCeiling36Month,
    probabilitySuccessPct: summary.probabilitySuccessPct,
    adjacencyScore: summary.adjacencyScore,
    asymmetricUpsideScore: summary.asymmetricUpsideScore,
    attentionDemandScore: summary.attentionDemandScore,
    speedToSignalDays: summary.speedToSignalDays,
    validationCapital: summary.validationCapital,
    buildCapital: summary.buildCapital,
    scaleCapital: summary.scaleCapital,
  }
}

export function buildCurrentVentureSummary(
  ventureSummary: VentureSummaryRecord | null,
  forecasts: ForecastRecord[],
  costEstimates: CostEstimateRecord[]
) {
  if (!ventureSummary) {
    return null
  }

  return buildVentureSummary(getVentureManualInputsFromSummary(ventureSummary), forecasts, costEstimates)
}

export function doesSavedVentureSummaryMatchCurrentModel(
  ventureSummary: VentureSummaryRecord,
  forecasts: ForecastRecord[],
  costEstimates: CostEstimateRecord[]
) {
  const currentSummary = buildCurrentVentureSummary(ventureSummary, forecasts, costEstimates)

  if (!currentSummary) {
    return false
  }

  return JSON.stringify(buildComparableSummaryShape(ventureSummary)) === JSON.stringify(buildComparableSummaryShape(currentSummary))
}

export function buildVentureSummary(
  inputs: VentureManualInputs,
  forecasts: ForecastRecord[],
  costEstimates: CostEstimateRecord[]
): VentureComputedSummary {
  const normalized = normalizeManualInputs(inputs)
  const forecastRevenue24Month = calculateForecastRevenueForMonths(forecasts, 24)
  const forecastRevenue36Month = calculateForecastRevenueForMonths(forecasts, 36)
  const accessCapital = normalized.validationCapital + normalized.buildCapital
  const latestEstimate = costEstimates[0]
  const unitEconomics = calculateUnitEconomics(forecasts, costEstimates)
  const contributionMarginPct =
    unitEconomics.averageSellingPrice > 0
      ? unitEconomics.contributionMarginPerUnit / unitEconomics.averageSellingPrice
      : 0
  const expectedOpportunityValue = normalized.marketCeiling24Month * normalized.probabilitySuccessPct
  const returnOnFocus =
    expectedOpportunityValue / Math.max(normalized.attentionDemandScore, 1)
  const capitalEfficiencyRatio =
    accessCapital > 0
      ? normalized.marketCeiling24Month / accessCapital
      : normalized.marketCeiling24Month > 0
        ? CAPITAL_EFFICIENCY_TARGET
        : 0
  const salesPerEngineeringHour =
    latestEstimate && latestEstimate.engineeringHours > 0
      ? forecastRevenue24Month / latestEstimate.engineeringHours
      : 0

  const scoreBreakdown = {
    expectedOpportunity: scoreLinear(expectedOpportunityValue, EXPECTED_OPPORTUNITY_TARGET, 30),
    capitalEfficiency: scoreLinear(capitalEfficiencyRatio, CAPITAL_EFFICIENCY_TARGET, 15),
    operationalEase: scoreTenPointInput(11 - normalized.adjacencyScore, 15),
    asymmetricUpside: scoreTenPointInput(normalized.asymmetricUpsideScore, 15),
    speedToSignal: SPEED_SCORE_BY_DAYS[normalized.speedToSignalDays] ?? 0,
    contributionLeverage: calculateContributionLeveragePoints(contributionMarginPct),
    attentionPenalty: scoreTenPointInput(normalized.attentionDemandScore, 20),
  }

  const rawScore = clamp(
    scoreBreakdown.expectedOpportunity +
      scoreBreakdown.capitalEfficiency +
      scoreBreakdown.operationalEase +
      scoreBreakdown.asymmetricUpside +
      scoreBreakdown.speedToSignal +
      scoreBreakdown.contributionLeverage -
      scoreBreakdown.attentionPenalty,
    0,
    100
  )

  const hardGates: string[] = []

  if (normalized.speedToSignalDays > 90) {
    hardGates.push('Speed to signal is slower than 90 days.')
  }

  if (normalized.marketCeiling24Month <= accessCapital) {
    hardGates.push('24-month market ceiling does not exceed access capital.')
  }

  const ventureScore = roundCurrency(hardGates.length > 0 ? Math.min(rawScore, 39) : rawScore)
  const recommendationBucket = hardGates.length > 0 ? 'Kill' : mapBucket(ventureScore)
  const recommendedStage = mapStage(recommendationBucket)

  return {
    ...normalized,
    ventureScore,
    recommendationBucket,
    recommendedStage,
    forecastRevenue24Month: roundCurrency(forecastRevenue24Month),
    forecastRevenue36Month: roundCurrency(forecastRevenue36Month),
    expectedOpportunityValue: roundCurrency(expectedOpportunityValue),
    returnOnFocus: roundCurrency(returnOnFocus),
    accessCapital: roundCurrency(accessCapital),
    capitalEfficiencyRatio: roundRatio(capitalEfficiencyRatio),
    salesPerEngineeringHour: roundCurrency(salesPerEngineeringHour),
    contributionMarginPct: roundRatio(contributionMarginPct),
    assumptions: {
      scoreBreakdown: {
        expectedOpportunity: roundCurrency(scoreBreakdown.expectedOpportunity),
        capitalEfficiency: roundCurrency(scoreBreakdown.capitalEfficiency),
        operationalEase: roundCurrency(scoreBreakdown.operationalEase),
        asymmetricUpside: roundCurrency(scoreBreakdown.asymmetricUpside),
        speedToSignal: roundCurrency(scoreBreakdown.speedToSignal),
        contributionLeverage: roundCurrency(scoreBreakdown.contributionLeverage),
        attentionPenalty: roundCurrency(scoreBreakdown.attentionPenalty),
      },
      scoreBands: {
        expectedOpportunityTarget: EXPECTED_OPPORTUNITY_TARGET,
        capitalEfficiencyTarget: CAPITAL_EFFICIENCY_TARGET,
        speedToSignal: SPEED_SCORE_BY_DAYS,
        scoreMaximum: VENTURE_SCORE_MAX,
        buckets: VENTURE_SCORE_BUCKETS,
        operationalEase: {
          inputLabel: 'Operational lift / adjacency gap',
          bestInput: 1,
          worstInput: 10,
          note: 'Lower lift scores better because it fits current processes more easily.',
        },
        contributionLeverage: {
          under20Pct: 0,
          between20And30Pct: 4,
          between30And40Pct: 7,
          above40Pct: 10,
        },
      },
      rawScore: roundCurrency(rawScore),
      hardGates,
      dataSources: {
        latestCostEstimateId: latestEstimate?.id ?? null,
        forecastCount: forecasts.length,
      },
      note:
        'The venture lens keeps the ROI model intact and scores optionality separately. Opportunity and capital efficiency use the 24-month ceiling, while forecast revenue and contribution leverage are derived from the saved forecast and latest cost estimate.',
    },
  }
}
