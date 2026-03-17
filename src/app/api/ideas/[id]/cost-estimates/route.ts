import { NextResponse } from 'next/server'

import { badRequest, jsonError, notFound } from '@/lib/http'
import { prisma } from '@/lib/prisma'
import { ensureCanManageRecord, requireUser } from '@/lib/server-auth'
import { serializeCostEstimate } from '@/lib/serializers'

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

function sanitizeBomParts(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((part): part is Record<string, unknown> => typeof part === 'object' && part !== null)
    .map((part) => ({
      item: String(part.item ?? '').trim(),
      unitCost: Number(part.unitCost ?? 0),
      quantity: Number(part.quantity ?? 1),
      cashEffect: part.cashEffect !== false,
    }))
    .filter((part) => part.item)
}

function sanitizeLaborEntries(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
    .map((entry) => ({
      activityId: String(entry.activityId ?? '').trim(),
      hours: Number(entry.hours ?? 0),
      minutes: Number(entry.minutes ?? 0),
      seconds: Number(entry.seconds ?? 0),
    }))
    .filter((entry) => entry.activityId)
}

function parseFiniteNumber(value: unknown, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function parseNullableNumber(value: unknown, fallback: number | null = null) {
  if (value === undefined) {
    return fallback
  }

  if (value === null || value === '') {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export async function GET(_request: Request, { params }: Params) {
  try {
    await requireUser()
    const { id } = await params
    await ensureIdeaExists(id)

    const estimates = await prisma.costEstimate.findMany({
      where: { ideaId: id },
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
    })

    return NextResponse.json(estimates.map(serializeCostEstimate))
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

    const payload = {
      toolingCost: parseFiniteNumber(body.toolingCost, 0),
      engineeringHours: parseFiniteNumber(body.engineeringHours, 0),
      engineeringRatePerHour: parseFiniteNumber(body.engineeringRatePerHour, 125),
      launchCashRequirement: parseNullableNumber(body.launchCashRequirement),
      complianceCost: parseNullableNumber(body.complianceCost),
      fulfillmentCostPerUnit: parseNullableNumber(body.fulfillmentCostPerUnit),
      warrantyReservePct: parseNullableNumber(body.warrantyReservePct),
      scrapRate: parseFiniteNumber(body.scrapRate, 0),
      overheadRate: parseFiniteNumber(body.overheadRate, 60),
      supportTimePct: parseFiniteNumber(body.supportTimePct, 0.2),
      bomParts: sanitizeBomParts(body.bomParts),
      laborEntries: sanitizeLaborEntries(body.laborEntries),
    }

    const estimate = await prisma.costEstimate.create({
      data: {
        ideaId: id,
        createdById: user.id,
        toolingCost: payload.toolingCost,
        engineeringHours: payload.engineeringHours,
        engineeringRatePerHour: payload.engineeringRatePerHour,
        launchCashRequirement: payload.launchCashRequirement,
        complianceCost: payload.complianceCost,
        fulfillmentCostPerUnit: payload.fulfillmentCostPerUnit,
        warrantyReservePct: payload.warrantyReservePct,
        scrapRate: payload.scrapRate,
        overheadRate: payload.overheadRate,
        supportTimePct: payload.supportTimePct,
        bomParts: {
          create: payload.bomParts,
        },
        laborEntries: {
          create: payload.laborEntries,
        },
      },
      include: {
        createdBy: true,
        bomParts: true,
        laborEntries: {
          include: {
            activity: true,
          },
        },
      },
    })

    return NextResponse.json(serializeCostEstimate(estimate), { status: 201 })
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
    const costEstimateId = body.costEstimateId

    if (!costEstimateId) {
      throw badRequest('costEstimateId is required')
    }

    const existing = await prisma.costEstimate.findUnique({
      where: { id: String(costEstimateId) },
    })

    if (!existing || existing.ideaId !== id) {
      throw notFound('Cost estimate not found')
    }

    ensureCanManageRecord(user, existing.createdById)

    await prisma.$transaction(async (tx) => {
      await tx.costEstimate.update({
        where: { id: existing.id },
        data: {
          toolingCost: parseFiniteNumber(body.toolingCost, existing.toolingCost),
          engineeringHours: parseFiniteNumber(body.engineeringHours, existing.engineeringHours),
          engineeringRatePerHour: parseFiniteNumber(body.engineeringRatePerHour, existing.engineeringRatePerHour ?? 125),
          launchCashRequirement: parseNullableNumber(body.launchCashRequirement, existing.launchCashRequirement),
          complianceCost: parseNullableNumber(body.complianceCost, existing.complianceCost),
          fulfillmentCostPerUnit: parseNullableNumber(body.fulfillmentCostPerUnit, existing.fulfillmentCostPerUnit),
          warrantyReservePct: parseNullableNumber(body.warrantyReservePct, existing.warrantyReservePct),
          scrapRate: parseFiniteNumber(body.scrapRate, existing.scrapRate),
          overheadRate: parseFiniteNumber(body.overheadRate, existing.overheadRate),
          supportTimePct: parseFiniteNumber(body.supportTimePct, existing.supportTimePct),
        },
      })

      await tx.bomPart.deleteMany({
        where: { costEstimateId: existing.id },
      })

      await tx.laborEntry.deleteMany({
        where: { costEstimateId: existing.id },
      })

      const bomParts = sanitizeBomParts(body.bomParts)
      const laborEntries = sanitizeLaborEntries(body.laborEntries)

      if (bomParts.length) {
        await tx.bomPart.createMany({
          data: bomParts.map((part) => ({
            ...part,
            costEstimateId: existing.id,
          })),
        })
      }

      if (laborEntries.length) {
        await tx.laborEntry.createMany({
          data: laborEntries.map((entry) => ({
            ...entry,
            costEstimateId: existing.id,
          })),
        })
      }
    })

    const estimate = await prisma.costEstimate.findUnique({
      where: { id: existing.id },
      include: {
        createdBy: true,
        bomParts: true,
        laborEntries: {
          include: {
            activity: true,
          },
        },
      },
    })

    if (!estimate) {
      throw notFound('Cost estimate not found')
    }

    return NextResponse.json(serializeCostEstimate(estimate))
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
    const costEstimateId = body.costEstimateId

    if (!costEstimateId) {
      throw badRequest('costEstimateId is required')
    }

    const existing = await prisma.costEstimate.findUnique({
      where: { id: String(costEstimateId) },
    })

    if (!existing || existing.ideaId !== id) {
      throw notFound('Cost estimate not found')
    }

    ensureCanManageRecord(user, existing.createdById)
    await prisma.costEstimate.delete({
      where: { id: existing.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return jsonError(error)
  }
}
