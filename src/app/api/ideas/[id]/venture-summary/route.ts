import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

import { badRequest, jsonError, notFound } from '@/lib/http'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/server-auth'
import { serializeCostEstimate, serializeForecast, serializeVentureSummary } from '@/lib/serializers'
import { buildVentureSummary } from '@/lib/venture-summary'

type Params = {
  params: Promise<{ id: string }>
}

function parseNumber(value: unknown, fieldLabel: string) {
  const parsed = Number(value)

  if (!Number.isFinite(parsed)) {
    throw badRequest(`Invalid ${fieldLabel}`)
  }

  return parsed
}

export async function POST(request: Request, { params }: Params) {
  try {
    await requireUser()
    const { id } = await params
    const idea = await prisma.idea.findUnique({
      where: { id },
      include: {
        salesForecasts: {
          include: {
            contributor: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        costEstimates: {
          include: {
            createdBy: true,
            bomParts: true,
            laborEntries: {
              include: {
                activity: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    })

    if (!idea) {
      throw notFound('Idea not found')
    }

    const body = await request.json()

    const marketCeiling24Month = parseNumber(body.marketCeiling24Month, '24-month market ceiling')
    const marketCeiling36Month =
      body.marketCeiling36Month === undefined
        ? marketCeiling24Month
        : parseNumber(body.marketCeiling36Month, '36-month market ceiling')

    const summary = buildVentureSummary(
      {
        marketCeiling24Month,
        marketCeiling36Month,
        probabilitySuccessPct: parseNumber(body.probabilitySuccessPct, 'probability of success'),
        adjacencyScore: parseNumber(body.adjacencyScore, 'operational lift score'),
        asymmetricUpsideScore: parseNumber(body.asymmetricUpsideScore, 'asymmetric upside score'),
        attentionDemandScore: parseNumber(body.attentionDemandScore, 'attention demand score'),
        speedToSignalDays: parseNumber(body.speedToSignalDays, 'speed to signal'),
        validationCapital: parseNumber(body.validationCapital, 'validation capital'),
        buildCapital: parseNumber(body.buildCapital, 'build capital'),
        scaleCapital: parseNumber(body.scaleCapital, 'scale capital'),
      },
      idea.salesForecasts.map(serializeForecast),
      idea.costEstimates.map(serializeCostEstimate)
    )

    const persistedSummary = {
      ...summary,
      assumptions: summary.assumptions as Prisma.InputJsonValue,
    }

    const saved = await prisma.ventureSummary.upsert({
      where: { ideaId: id },
      update: persistedSummary,
      create: {
        ideaId: id,
        ...persistedSummary,
      },
    })

    return NextResponse.json(serializeVentureSummary(saved))
  } catch (error) {
    return jsonError(error)
  }
}
