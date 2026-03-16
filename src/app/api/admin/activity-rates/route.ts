import { NextResponse } from 'next/server'

import { badRequest, jsonError, notFound } from '@/lib/http'
import { prisma } from '@/lib/prisma'
import { requireAdmin, requireUser } from '@/lib/server-auth'
import { serializeActivityRate } from '@/lib/serializers'

export async function GET() {
  try {
    await requireUser()

    const rates = await prisma.activityRate.findMany({
      orderBy: {
        activityName: 'asc',
      },
    })

    return NextResponse.json(rates.map(serializeActivityRate))
  } catch (error) {
    return jsonError(error)
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin()
    const { activityName, ratePerHour } = await request.json()

    if (!activityName) {
      throw badRequest('activityName is required')
    }

    const rate = await prisma.activityRate.create({
      data: {
        activityName: String(activityName).trim(),
        ratePerHour: Number(ratePerHour ?? 0),
      },
    })

    return NextResponse.json(serializeActivityRate(rate), { status: 201 })
  } catch (error) {
    return jsonError(error)
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin()
    const { id, activityName, ratePerHour } = await request.json()

    if (!id) {
      throw badRequest('id is required')
    }

    const existing = await prisma.activityRate.findUnique({
      where: { id: String(id) },
    })

    if (!existing) {
      throw notFound('Activity rate not found')
    }

    const rate = await prisma.activityRate.update({
      where: { id: existing.id },
      data: {
        activityName: activityName !== undefined ? String(activityName).trim() : undefined,
        ratePerHour: ratePerHour !== undefined ? Number(ratePerHour) : undefined,
      },
    })

    return NextResponse.json(serializeActivityRate(rate))
  } catch (error) {
    return jsonError(error)
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin()
    const { id } = await request.json()

    if (!id) {
      throw badRequest('id is required')
    }

    const existing = await prisma.activityRate.findUnique({
      where: { id: String(id) },
    })

    if (!existing) {
      throw notFound('Activity rate not found')
    }

    await prisma.activityRate.delete({
      where: { id: existing.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return jsonError(error)
  }
}
