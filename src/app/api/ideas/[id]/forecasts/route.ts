import { NextResponse } from 'next/server'

import { badRequest, jsonError, notFound } from '@/lib/http'
import { prisma } from '@/lib/prisma'
import { ensureCanManageRecord, requireUser } from '@/lib/server-auth'
import { serializeForecast } from '@/lib/serializers'

type Params = {
  params: Promise<{ id: string }>
}

async function ensureIdeaExists(id: string) {
  const idea = await prisma.idea.findUnique({ where: { id } })

  if (!idea) {
    throw notFound('Idea not found')
  }

  return idea
}

function parseFiniteNumber(value: unknown, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function hasDuplicateMonths(value: unknown) {
  if (!Array.isArray(value)) {
    return false
  }

  const months = value
    .filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null)
    .map((row) => String(row.month_date ?? '').trim())
    .filter(Boolean)

  return new Set(months).size !== months.length
}

export async function GET(_request: Request, { params }: Params) {
  try {
    await requireUser()
    const { id } = await params
    await ensureIdeaExists(id)

    const forecasts = await prisma.salesForecast.findMany({
      where: { ideaId: id },
      include: {
        contributor: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(forecasts.map(serializeForecast))
  } catch (error) {
    return jsonError(error)
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params
    await ensureIdeaExists(id)
    const body = await request.json()

    const {
      contributorRole,
      channelOrCustomer,
      monthlyMarketingSpend,
      marketingCostPerUnit,
      customerAcquisitionCostPerUnit,
      monthlyVolumeEstimate,
    } = body

    if (!contributorRole || !channelOrCustomer || !Array.isArray(monthlyVolumeEstimate)) {
      throw badRequest('Missing required forecast fields')
    }

    if (hasDuplicateMonths(monthlyVolumeEstimate)) {
      throw badRequest('Each forecast can only include one row per month')
    }

    const forecast = await prisma.salesForecast.create({
      data: {
        ideaId: id,
        contributorId: user.id,
        contributorRole: String(contributorRole).trim(),
        channelOrCustomer: String(channelOrCustomer).trim(),
        monthlyMarketingSpend: parseFiniteNumber(monthlyMarketingSpend, 0),
        marketingCostPerUnit: parseFiniteNumber(marketingCostPerUnit, 0),
        customerAcquisitionCostPerUnit: parseFiniteNumber(customerAcquisitionCostPerUnit, 0),
        monthlyVolumeEstimate,
      },
      include: {
        contributor: true,
      },
    })

    return NextResponse.json(serializeForecast(forecast), { status: 201 })
  } catch (error) {
    return jsonError(error)
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params
    await ensureIdeaExists(id)
    const body = await request.json()
    const forecastId = body.forecastId

    if (!forecastId) {
      throw badRequest('forecastId is required')
    }

    if (body.monthlyVolumeEstimate !== undefined && hasDuplicateMonths(body.monthlyVolumeEstimate)) {
      throw badRequest('Each forecast can only include one row per month')
    }

    const existing = await prisma.salesForecast.findUnique({
      where: { id: String(forecastId) },
    })

    if (!existing || existing.ideaId !== id) {
      throw notFound('Forecast not found')
    }

    ensureCanManageRecord(user, existing.contributorId)

    const forecast = await prisma.salesForecast.update({
      where: { id: existing.id },
      data: {
        contributorRole: body.contributorRole !== undefined ? String(body.contributorRole).trim() : undefined,
        channelOrCustomer: body.channelOrCustomer !== undefined ? String(body.channelOrCustomer).trim() : undefined,
        monthlyMarketingSpend:
          body.monthlyMarketingSpend !== undefined
            ? parseFiniteNumber(body.monthlyMarketingSpend, existing.monthlyMarketingSpend)
            : undefined,
        marketingCostPerUnit:
          body.marketingCostPerUnit !== undefined
            ? parseFiniteNumber(body.marketingCostPerUnit, existing.marketingCostPerUnit)
            : undefined,
        customerAcquisitionCostPerUnit:
          body.customerAcquisitionCostPerUnit !== undefined
            ? parseFiniteNumber(body.customerAcquisitionCostPerUnit, existing.customerAcquisitionCostPerUnit)
            : undefined,
        monthlyVolumeEstimate: Array.isArray(body.monthlyVolumeEstimate) ? body.monthlyVolumeEstimate : undefined,
      },
      include: {
        contributor: true,
      },
    })

    return NextResponse.json(serializeForecast(forecast))
  } catch (error) {
    return jsonError(error)
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params
    await ensureIdeaExists(id)
    const body = await request.json()
    const forecastId = body.forecastId

    if (!forecastId) {
      throw badRequest('forecastId is required')
    }

    const existing = await prisma.salesForecast.findUnique({
      where: { id: String(forecastId) },
    })

    if (!existing || existing.ideaId !== id) {
      throw notFound('Forecast not found')
    }

    ensureCanManageRecord(user, existing.contributorId)
    await prisma.salesForecast.delete({
      where: { id: existing.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return jsonError(error)
  }
}
