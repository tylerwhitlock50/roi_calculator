export type AppUser = {
  id: string
  email: string
  fullName: string
  role: 'admin' | 'member'
}

export type WorkspaceTabKey =
  | 'overview'
  | 'forecast'
  | 'cost'
  | 'unit-economics'
  | 'stress-test'
  | 'venture-lens'
  | 'finalize'

export type ReadinessState = 'not_started' | 'needs_attention' | 'ready'

export type WorkspaceReadinessRecord = {
  tabs: Record<WorkspaceTabKey, ReadinessState>
  hasUnconfirmedPricing: boolean
  costReviewItems: string[]
  roiSummaryStale: boolean
  ventureSummaryStale: boolean
  projectStateLabel: string
  nextActionLabel: string
  nextActionTab: WorkspaceTabKey
  badges: string[]
}

export type SessionPayload = {
  authenticated: boolean
  user: AppUser | null
}

export type MonthlyForecast = {
  month_date: string
  units: number
  price: number
}

export type ForecastRecord = {
  id: string
  ideaId: string
  contributorId: string
  contributorRole: string
  channelOrCustomer: string
  priceBasisConfirmed: boolean | null
  monthlyMarketingSpend: number
  marketingCostPerUnit: number
  customerAcquisitionCostPerUnit: number
  monthlyVolumeEstimate: MonthlyForecast[]
  createdAt: string
  contributor: {
    id: string
    fullName: string
    email: string
  }
}

export type ActivityRateRecord = {
  id: string
  activityName: string
  ratePerHour: number
  createdAt: string
}

export type CategoryOptionRecord = {
  id: string
  name: string
  displayOrder: number
  createdAt: string
}

export type CostEstimateRecord = {
  id: string
  ideaId: string
  toolingCost: number
  engineeringHours: number
  engineeringRatePerHour: number
  launchCashRequirement: number | null
  complianceCost: number | null
  fulfillmentCostPerUnit: number | null
  warrantyReservePct: number | null
  scrapRate: number
  overheadRate: number
  supportTimePct: number
  createdAt: string
  createdById: string
  contributor: {
    id: string
    fullName: string
    email: string
  }
  bomParts: Array<{
    id: string
    item: string
    unitCost: number
    quantity: number
    cashEffect: boolean
  }>
  laborEntries: Array<{
    id: string
    activityId: string
    hours: number
    minutes: number
    seconds: number
    activity: ActivityRateRecord
  }>
}

export type RoiSummaryRecord = {
  id: string
  npv: number
  irr: number
  breakEvenMonth: number
  paybackPeriod: number
  contributionMarginPerUnit: number
  profitPerUnit: number
  assumptions: Record<string, unknown>
  createdAt: string
}

export type VentureRecommendationBucket =
  | 'Kill'
  | 'Validate cheaply'
  | 'Stage build'
  | 'Fund aggressively'

export type VentureRecommendedStage = 'None' | 'Stage 1' | 'Stage 2' | 'Stage 3'

export type VentureSummaryRecord = {
  id: string
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
  createdAt: string
}

export type IdeaRecord = {
  id: string
  title: string
  description: string
  category: string
  status: 'draft' | 'in_review' | 'approved' | 'rejected' | 'archived'
  isHidden: boolean
  positioningStatement: string
  requiredAttributes: string
  competitorOverview: string
  createdAt: string
  createdById: string
  forecastCount: number
  costEstimateCount: number
  owner: {
    id: string
    fullName: string
    email: string
  }
  roiSummary: RoiSummaryRecord | null
  ventureSummary: VentureSummaryRecord | null
  workspaceReadiness: WorkspaceReadinessRecord
}

export type IdeaDetailRecord = IdeaRecord & {
  forecasts: ForecastRecord[]
  costEstimates: CostEstimateRecord[]
}

export type AdminUserRecord = {
  id: string
  email: string
  fullName: string
  role: 'admin' | 'member'
  isActive: boolean
  createdAt: string
}

export async function apiFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)

  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(input, {
    ...init,
    headers,
  })

  const isJson = response.headers.get('content-type')?.includes('application/json')
  const payload = isJson ? await response.json() : null

  if (!response.ok) {
    throw new Error(payload?.error ?? 'Request failed')
  }

  return payload as T
}
