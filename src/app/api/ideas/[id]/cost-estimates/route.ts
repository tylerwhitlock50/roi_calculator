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
      toolingCost: Number(body.toolingCost ?? 0),
      engineeringHours: Number(body.engineeringHours ?? 0),
      marketingBudget: Number(body.marketingBudget ?? 0),
      marketingCostPerUnit: Number(body.marketingCostPerUnit ?? 0),
      overheadRate: Number(body.overheadRate ?? 60),
      supportTimePct: Number(body.supportTimePct ?? 0.2),
      ppcBudget: Number(body.ppcBudget ?? 0),
      bomParts: sanitizeBomParts(body.bomParts),
      laborEntries: sanitizeLaborEntries(body.laborEntries),
    }

    const estimate = await prisma.costEstimate.create({
      data: {
        ideaId: id,
        createdById: user.id,
        toolingCost: payload.toolingCost,
        engineeringHours: payload.engineeringHours,
        marketingBudget: payload.marketingBudget,
        marketingCostPerUnit: payload.marketingCostPerUnit,
        overheadRate: payload.overheadRate,
        supportTimePct: payload.supportTimePct,
        ppcBudget: payload.ppcBudget,
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
          toolingCost: Number(body.toolingCost ?? existing.toolingCost),
          engineeringHours: Number(body.engineeringHours ?? existing.engineeringHours),
          marketingBudget: Number(body.marketingBudget ?? existing.marketingBudget),
          marketingCostPerUnit: Number(body.marketingCostPerUnit ?? existing.marketingCostPerUnit),
          overheadRate: Number(body.overheadRate ?? existing.overheadRate),
          supportTimePct: Number(body.supportTimePct ?? existing.supportTimePct),
          ppcBudget: Number(body.ppcBudget ?? existing.ppcBudget),
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
