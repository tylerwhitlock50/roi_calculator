import type {
  ActivityRate,
  CostEstimate,
  Idea,
  IdeaStatus,
  LaborEntry,
  BomPart,
  RoiSummary,
  SalesForecast,
  User,
} from '@prisma/client'

import type {
  ActivityRateRecord,
  CostEstimateRecord,
  ForecastRecord,
  IdeaDetailRecord,
  IdeaRecord,
  RoiSummaryRecord,
} from '@/lib/api'

function serializeStatus(status: IdeaStatus): IdeaRecord['status'] {
  switch (status) {
    case 'IN_REVIEW':
      return 'in_review'
    case 'APPROVED':
      return 'approved'
    case 'REJECTED':
      return 'rejected'
    case 'ARCHIVED':
      return 'archived'
    case 'DRAFT':
    default:
      return 'draft'
  }
}

export function serializeRoiSummary(summary: RoiSummary | null): RoiSummaryRecord | null {
  if (!summary) {
    return null
  }

  return {
    id: summary.id,
    npv: summary.npv,
    irr: summary.irr,
    breakEvenMonth: summary.breakEvenMonth,
    paybackPeriod: summary.paybackPeriod,
    contributionMarginPerUnit: summary.contributionMarginPerUnit,
    profitPerUnit: summary.profitPerUnit,
    assumptions: (summary.assumptions ?? {}) as Record<string, unknown>,
    createdAt: summary.createdAt.toISOString(),
  }
}

export function serializeIdea(
  idea: Pick<
    Idea,
    | 'id'
    | 'title'
    | 'description'
    | 'category'
    | 'status'
    | 'positioningStatement'
    | 'requiredAttributes'
    | 'competitorOverview'
    | 'createdAt'
    | 'createdById'
  > & {
    isHidden: boolean
    createdBy: User
    roiSummary: RoiSummary | null
  }
): IdeaRecord {
  return {
    id: idea.id,
    title: idea.title,
    description: idea.description,
    category: idea.category,
    status: serializeStatus(idea.status),
    isHidden: idea.isHidden,
    positioningStatement: idea.positioningStatement,
    requiredAttributes: idea.requiredAttributes,
    competitorOverview: idea.competitorOverview,
    createdAt: idea.createdAt.toISOString(),
    createdById: idea.createdById,
    owner: {
      id: idea.createdBy.id,
      fullName: idea.createdBy.fullName,
      email: idea.createdBy.email,
    },
    roiSummary: serializeRoiSummary(idea.roiSummary),
  }
}

export function serializeActivityRate(rate: ActivityRate): ActivityRateRecord {
  return {
    id: rate.id,
    activityName: rate.activityName,
    ratePerHour: rate.ratePerHour,
    createdAt: rate.createdAt.toISOString(),
  }
}

export function serializeForecast(
  forecast: SalesForecast & {
    contributor: User
  }
): ForecastRecord {
  return {
    id: forecast.id,
    ideaId: forecast.ideaId,
    contributorId: forecast.contributorId,
    contributorRole: forecast.contributorRole,
    channelOrCustomer: forecast.channelOrCustomer,
    monthlyMarketingSpend: forecast.monthlyMarketingSpend,
    marketingCostPerUnit: forecast.marketingCostPerUnit,
    customerAcquisitionCostPerUnit: forecast.customerAcquisitionCostPerUnit,
    monthlyVolumeEstimate: (forecast.monthlyVolumeEstimate as ForecastRecord['monthlyVolumeEstimate']) ?? [],
    createdAt: forecast.createdAt.toISOString(),
    contributor: {
      id: forecast.contributor.id,
      fullName: forecast.contributor.fullName,
      email: forecast.contributor.email,
    },
  }
}

export function serializeCostEstimate(
  estimate: CostEstimate & {
    createdBy: User
    bomParts: BomPart[]
    laborEntries: Array<
      LaborEntry & {
        activity: ActivityRate
      }
    >
  }
): CostEstimateRecord {
  return {
    id: estimate.id,
    ideaId: estimate.ideaId,
    toolingCost: estimate.toolingCost,
    engineeringHours: estimate.engineeringHours,
    engineeringRatePerHour: estimate.engineeringRatePerHour,
    overheadRate: estimate.overheadRate,
    supportTimePct: estimate.supportTimePct,
    createdAt: estimate.createdAt.toISOString(),
    createdById: estimate.createdById,
    contributor: {
      id: estimate.createdBy.id,
      fullName: estimate.createdBy.fullName,
      email: estimate.createdBy.email,
    },
    bomParts: estimate.bomParts.map((part) => ({
      id: part.id,
      item: part.item,
      unitCost: part.unitCost,
      quantity: part.quantity,
      cashEffect: part.cashEffect,
    })),
    laborEntries: estimate.laborEntries.map((entry) => ({
      id: entry.id,
      activityId: entry.activityId,
      hours: entry.hours,
      minutes: entry.minutes,
      seconds: entry.seconds,
      activity: serializeActivityRate(entry.activity),
    })),
  }
}

export function serializeIdeaDetail(
  idea: Idea & {
    createdBy: User
    roiSummary: RoiSummary | null
    salesForecasts: Array<
      SalesForecast & {
        contributor: User
      }
    >
    costEstimates: Array<
      CostEstimate & {
        createdBy: User
        bomParts: BomPart[]
        laborEntries: Array<
          LaborEntry & {
            activity: ActivityRate
          }
        >
      }
    >
  }
): IdeaDetailRecord {
  return {
    ...serializeIdea(idea),
    forecasts: idea.salesForecasts.map(serializeForecast),
    costEstimates: idea.costEstimates.map(serializeCostEstimate),
  }
}
