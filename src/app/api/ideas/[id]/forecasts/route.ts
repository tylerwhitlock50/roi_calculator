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
      monthlyVolumeEstimate,
    } = body

    if (!contributorRole || !channelOrCustomer || !Array.isArray(monthlyVolumeEstimate)) {
      throw badRequest('Missing required forecast fields')
    }

    const forecast = await prisma.salesForecast.create({
      data: {
        ideaId: id,
        contributorId: user.id,
        contributorRole: String(contributorRole).trim(),
        channelOrCustomer: String(channelOrCustomer).trim(),
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
