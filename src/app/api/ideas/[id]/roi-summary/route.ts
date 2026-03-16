import { NextResponse } from 'next/server'

import { badRequest, jsonError, notFound } from '@/lib/http'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/server-auth'
import { serializeRoiSummary } from '@/lib/serializers'

type Params = {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, { params }: Params) {
  try {
    await requireUser()
    const { id } = await params
    const idea = await prisma.idea.findUnique({ where: { id } })

    if (!idea) {
      throw notFound('Idea not found')
    }

    const body = await request.json()

    if (
      body.npv === undefined ||
      body.irr === undefined ||
      body.breakEvenMonth === undefined ||
      body.paybackPeriod === undefined
    ) {
      throw badRequest('Missing ROI values')
    }

    const summary = await prisma.roiSummary.upsert({
      where: { ideaId: id },
      update: {
        npv: Number(body.npv),
        irr: Number(body.irr),
        breakEvenMonth: Number(body.breakEvenMonth),
        paybackPeriod: Number(body.paybackPeriod),
        contributionMarginPerUnit: Number(body.contributionMarginPerUnit ?? 0),
        profitPerUnit: Number(body.profitPerUnit ?? 0),
        assumptions: body.assumptions ?? {},
      },
      create: {
        ideaId: id,
        npv: Number(body.npv),
        irr: Number(body.irr),
        breakEvenMonth: Number(body.breakEvenMonth),
        paybackPeriod: Number(body.paybackPeriod),
        contributionMarginPerUnit: Number(body.contributionMarginPerUnit ?? 0),
        profitPerUnit: Number(body.profitPerUnit ?? 0),
        assumptions: body.assumptions ?? {},
      },
    })

    return NextResponse.json(serializeRoiSummary(summary))
  } catch (error) {
    return jsonError(error)
  }
}
