import type {
  CostEstimateRecord,
  ForecastRecord,
  IdeaRecord,
  RoiSummaryRecord,
  VentureSummaryRecord,
  WorkspaceReadinessRecord,
  WorkspaceTabKey,
} from '@/lib/api'
import {
  buildRoiDecisionSnapshot,
  buildRoiDecisionSummary,
} from '@/lib/roi-decision'
import { calculateRoiMetrics, calculateUnitEconomics } from '@/lib/roi-calculations'
import { doesSavedVentureSummaryMatchCurrentModel } from '@/lib/venture-summary'

function getCostReviewItems(estimate?: CostEstimateRecord | null) {
  if (!estimate) {
    return []
  }

  const items: string[] = []

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

function buildRoiStaleState({
  roiSummary,
  forecasts,
  costEstimates,
}: {
  roiSummary: RoiSummaryRecord | null
  forecasts: ForecastRecord[]
  costEstimates: CostEstimateRecord[]
}) {
  if (!roiSummary) {
    return false
  }

  const calculations = calculateRoiMetrics(forecasts, costEstimates)
  const decisionSummary = buildRoiDecisionSummary({ forecasts, costEstimates, calculations })
  const decisionSnapshot = buildRoiDecisionSnapshot(decisionSummary)

  return (
    roiSummary.npv.toFixed(2) !== calculations.npv.toFixed(2) ||
    roiSummary.irr.toFixed(4) !== calculations.irr.toFixed(4) ||
    roiSummary.breakEvenMonth !== calculations.breakEvenMonth ||
    roiSummary.paybackPeriod.toFixed(2) !== calculations.paybackPeriod.toFixed(2) ||
    JSON.stringify((roiSummary.assumptions as Record<string, unknown>)?.decisionSummary ?? null) !==
      JSON.stringify(decisionSnapshot)
  )
}

function getTabState({
  forecasts,
  latestEstimate,
  hasUnconfirmedPricing,
  costReviewItems,
  ventureSummary,
  ventureSummaryStale,
  roiSummary,
  roiSummaryStale,
}: {
  forecasts: ForecastRecord[]
  latestEstimate: CostEstimateRecord | null
  hasUnconfirmedPricing: boolean
  costReviewItems: string[]
  ventureSummary: VentureSummaryRecord | null
  ventureSummaryStale: boolean
  roiSummary: RoiSummaryRecord | null
  roiSummaryStale: boolean
}): Record<WorkspaceTabKey, WorkspaceReadinessRecord['tabs'][WorkspaceTabKey]> {
  const hasForecasts = forecasts.length > 0
  const hasCostEstimate = Boolean(latestEstimate)
  const unitEconomics =
    hasForecasts && latestEstimate ? calculateUnitEconomics(forecasts, [latestEstimate]) : null
  const hasUsableUnitEconomics =
    (unitEconomics?.totalUnits ?? 0) > 0 &&
    (unitEconomics?.averageSellingPrice ?? 0) > 0

  return {
    overview: 'ready',
    forecast: !hasForecasts ? 'not_started' : hasUnconfirmedPricing ? 'needs_attention' : 'ready',
    cost: !hasCostEstimate ? 'not_started' : costReviewItems.length ? 'needs_attention' : 'ready',
    'unit-economics': !hasForecasts || !hasCostEstimate ? 'not_started' : hasUsableUnitEconomics ? 'ready' : 'needs_attention',
    'stress-test': !hasForecasts || !hasCostEstimate ? 'not_started' : hasUsableUnitEconomics ? 'ready' : 'needs_attention',
    'venture-lens':
      !hasForecasts || !hasCostEstimate
        ? 'not_started'
        : !ventureSummary || ventureSummaryStale
          ? 'needs_attention'
          : 'ready',
    finalize:
      !hasForecasts || !hasCostEstimate
        ? 'not_started'
        : !roiSummary || roiSummaryStale || hasUnconfirmedPricing || costReviewItems.length
          ? 'needs_attention'
          : 'ready',
  }
}

export function buildWorkspaceReadiness({
  forecasts,
  costEstimates,
  roiSummary,
  ventureSummary,
}: {
  forecasts: ForecastRecord[]
  costEstimates: CostEstimateRecord[]
  roiSummary: RoiSummaryRecord | null
  ventureSummary: VentureSummaryRecord | null
}): WorkspaceReadinessRecord {
  const latestEstimate = costEstimates[0] ?? null
  const hasForecasts = forecasts.length > 0
  const hasUnconfirmedPricing = forecasts.some((forecast) => forecast.priceBasisConfirmed !== true)
  const costReviewItems = getCostReviewItems(latestEstimate)
  const roiSummaryStale = buildRoiStaleState({ roiSummary, forecasts, costEstimates })
  const ventureSummaryStale = ventureSummary
    ? !doesSavedVentureSummaryMatchCurrentModel(ventureSummary, forecasts, costEstimates)
    : false

  const tabs = getTabState({
    forecasts,
    latestEstimate,
    hasUnconfirmedPricing,
    costReviewItems,
    ventureSummary,
    ventureSummaryStale,
    roiSummary,
    roiSummaryStale,
  })

  let projectStateLabel = 'Ready for decision'
  if (!hasForecasts) {
    projectStateLabel = 'Needs forecast'
  } else if (!latestEstimate) {
    projectStateLabel = 'Needs cost review'
  } else if (hasUnconfirmedPricing || costReviewItems.length) {
    projectStateLabel = 'Needs review'
  } else if (roiSummary && roiSummaryStale) {
    projectStateLabel = 'ROI stale'
  } else if (ventureSummary && ventureSummaryStale) {
    projectStateLabel = 'Venture stale'
  } else if (!ventureSummary) {
    projectStateLabel = 'No venture score'
  } else if (!roiSummary) {
    projectStateLabel = 'Ready for ROI'
  }

  const badges: string[] = []

  if (hasUnconfirmedPricing) {
    badges.push('Pricing review')
  }

  if (costReviewItems.length) {
    badges.push('Cost review')
  }

  if (roiSummaryStale) {
    badges.push('ROI stale')
  }

  if (!ventureSummary) {
    badges.push('No venture score')
  } else if (ventureSummaryStale) {
    badges.push('Venture stale')
  }

  if (!badges.length && roiSummary && !roiSummaryStale) {
    badges.push('Ready for decision')
  }

  let nextActionTab: WorkspaceTabKey = 'finalize'
  let nextActionLabel = 'Save ROI'

  if (!hasForecasts || hasUnconfirmedPricing) {
    nextActionTab = 'forecast'
    nextActionLabel = 'Continue with forecast'
  } else if (!latestEstimate || costReviewItems.length) {
    nextActionTab = 'cost'
    nextActionLabel = 'Review cost inputs'
  } else if (ventureSummary && ventureSummaryStale) {
    nextActionTab = 'venture-lens'
    nextActionLabel = 'Refresh Venture Lens'
  }

  return {
    tabs,
    hasUnconfirmedPricing,
    costReviewItems,
    roiSummaryStale,
    ventureSummaryStale,
    projectStateLabel,
    nextActionLabel,
    nextActionTab,
    badges,
  }
}

export function getReadinessTone(state: WorkspaceReadinessRecord['tabs'][WorkspaceTabKey]) {
  if (state === 'ready') {
    return 'positive'
  }

  if (state === 'needs_attention') {
    return 'caution'
  }

  return 'default'
}

export function getReadinessLabel(state: WorkspaceReadinessRecord['tabs'][WorkspaceTabKey]) {
  if (state === 'ready') {
    return 'Ready'
  }

  if (state === 'needs_attention') {
    return 'Needs attention'
  }

  return 'Not started'
}

export function hasVentureLensPrereqs(idea: Pick<IdeaRecord, 'forecastCount' | 'costEstimateCount'>) {
  return idea.forecastCount > 0 && idea.costEstimateCount > 0
}
