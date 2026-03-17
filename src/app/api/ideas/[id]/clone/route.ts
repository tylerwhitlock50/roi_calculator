import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

import { badRequest, jsonError, notFound } from '@/lib/http'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/server-auth'
import { ideaDetailInclude } from '@/lib/server-data'
import { serializeIdeaDetail } from '@/lib/serializers'

type Params = {
  params: Promise<{ id: string }>
}

function buildDefaultCloneTitle(sourceTitle: string, existingTitles: string[]) {
  const usedTitles = new Set(existingTitles)
  const baseTitle = `${sourceTitle} (Scenario)`

  if (!usedTitles.has(baseTitle)) {
    return baseTitle
  }

  let suffix = 2

  while (usedTitles.has(`${sourceTitle} (Scenario ${suffix})`)) {
    suffix += 1
  }

  return `${sourceTitle} (Scenario ${suffix})`
}

async function parseCloneRequest(request: Request) {
  const rawBody = await request.text()

  if (!rawBody.trim()) {
    return {}
  }

  try {
    return JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    throw badRequest('Invalid JSON body')
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params
    const source = await prisma.idea.findUnique({
      where: { id },
      include: ideaDetailInclude,
    })

    if (!source) {
      throw notFound('Idea not found')
    }

    const body = await parseCloneRequest(request)
    const requestedTitle = typeof body.title === 'string' ? body.title.trim() : ''

    if (body.title !== undefined && !requestedTitle) {
      throw badRequest('Clone title cannot be empty')
    }

    const defaultTitleCandidates = requestedTitle
      ? []
      : await prisma.idea.findMany({
          where: {
            title: {
              startsWith: source.title,
            },
          },
          select: {
            title: true,
          },
        })

    const clone = await prisma.idea.create({
      data: {
        title: requestedTitle || buildDefaultCloneTitle(source.title, defaultTitleCandidates.map((idea) => idea.title)),
        description: source.description,
        category: source.category,
        status: 'DRAFT',
        isHidden: false,
        positioningStatement: source.positioningStatement,
        requiredAttributes: source.requiredAttributes,
        competitorOverview: source.competitorOverview,
        createdById: user.id,
        salesForecasts: {
          create: source.salesForecasts.map((forecast) => ({
            contributorId: user.id,
            contributorRole: forecast.contributorRole,
            channelOrCustomer: forecast.channelOrCustomer,
            priceBasisConfirmed: forecast.priceBasisConfirmed,
            monthlyMarketingSpend: forecast.monthlyMarketingSpend,
            marketingCostPerUnit: forecast.marketingCostPerUnit,
            customerAcquisitionCostPerUnit: forecast.customerAcquisitionCostPerUnit,
            monthlyVolumeEstimate: forecast.monthlyVolumeEstimate as Prisma.InputJsonValue,
          })),
        },
        costEstimates: {
          create: source.costEstimates.map((estimate) => ({
            createdById: user.id,
            toolingCost: estimate.toolingCost,
            engineeringHours: estimate.engineeringHours,
            engineeringRatePerHour: estimate.engineeringRatePerHour,
            launchCashRequirement: estimate.launchCashRequirement,
            complianceCost: estimate.complianceCost,
            fulfillmentCostPerUnit: estimate.fulfillmentCostPerUnit,
            warrantyReservePct: estimate.warrantyReservePct,
            scrapRate: estimate.scrapRate,
            overheadRate: estimate.overheadRate,
            supportTimePct: estimate.supportTimePct,
            bomParts: {
              create: estimate.bomParts.map((part) => ({
                item: part.item,
                unitCost: part.unitCost,
                quantity: part.quantity,
                cashEffect: part.cashEffect,
              })),
            },
            laborEntries: {
              create: estimate.laborEntries.map((entry) => ({
                activityId: entry.activityId,
                hours: entry.hours,
                minutes: entry.minutes,
                seconds: entry.seconds,
              })),
            },
          })),
        },
        roiSummary: source.roiSummary
          ? {
              create: {
                npv: source.roiSummary.npv,
                irr: source.roiSummary.irr,
                breakEvenMonth: source.roiSummary.breakEvenMonth,
                paybackPeriod: source.roiSummary.paybackPeriod,
                contributionMarginPerUnit: source.roiSummary.contributionMarginPerUnit,
                profitPerUnit: source.roiSummary.profitPerUnit,
                assumptions: source.roiSummary.assumptions as Prisma.InputJsonValue,
              },
            }
          : undefined,
        ventureSummary: source.ventureSummary
          ? {
              create: {
                marketCeiling24Month: source.ventureSummary.marketCeiling24Month,
                marketCeiling36Month: source.ventureSummary.marketCeiling36Month,
                probabilitySuccessPct: source.ventureSummary.probabilitySuccessPct,
                adjacencyScore: source.ventureSummary.adjacencyScore,
                asymmetricUpsideScore: source.ventureSummary.asymmetricUpsideScore,
                attentionDemandScore: source.ventureSummary.attentionDemandScore,
                speedToSignalDays: source.ventureSummary.speedToSignalDays,
                validationCapital: source.ventureSummary.validationCapital,
                buildCapital: source.ventureSummary.buildCapital,
                scaleCapital: source.ventureSummary.scaleCapital,
                ventureScore: source.ventureSummary.ventureScore,
                recommendationBucket: source.ventureSummary.recommendationBucket,
                recommendedStage: source.ventureSummary.recommendedStage,
                forecastRevenue24Month: source.ventureSummary.forecastRevenue24Month,
                forecastRevenue36Month: source.ventureSummary.forecastRevenue36Month,
                expectedOpportunityValue: source.ventureSummary.expectedOpportunityValue,
                returnOnFocus: source.ventureSummary.returnOnFocus,
                accessCapital: source.ventureSummary.accessCapital,
                capitalEfficiencyRatio: source.ventureSummary.capitalEfficiencyRatio,
                salesPerEngineeringHour: source.ventureSummary.salesPerEngineeringHour,
                contributionMarginPct: source.ventureSummary.contributionMarginPct,
                assumptions: source.ventureSummary.assumptions as Prisma.InputJsonValue,
              },
            }
          : undefined,
      },
      include: ideaDetailInclude,
    })

    return NextResponse.json(serializeIdeaDetail(clone), { status: 201 })
  } catch (error) {
    return jsonError(error)
  }
}
