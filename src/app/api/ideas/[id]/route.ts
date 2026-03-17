import { NextResponse } from 'next/server'

import { badRequest, jsonError, notFound } from '@/lib/http'
import { parseIdeaStatus } from '@/lib/idea-status'
import { prisma } from '@/lib/prisma'
import { ensureCanManageRecord, requireUser } from '@/lib/server-auth'
import { findIdeaForDetail, ideaDetailInclude } from '@/lib/server-data'
import { serializeIdeaDetail } from '@/lib/serializers'

type Params = {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, { params }: Params) {
  try {
    await requireUser()
    const { id } = await params
    const idea = await findIdeaForDetail(id)

    if (!idea) {
      throw notFound('Idea not found')
    }

    return NextResponse.json(serializeIdeaDetail(idea))
  } catch (error) {
    return jsonError(error)
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params
    const existing = await prisma.idea.findUnique({
      where: { id },
    })

    if (!existing) {
      throw notFound('Idea not found')
    }

    ensureCanManageRecord(user, existing.createdById)

    const body = await request.json()
    const updateData: {
      title?: string
      description?: string
      category?: string
      positioningStatement?: string
      requiredAttributes?: string
      competitorOverview?: string
      isHidden?: boolean
      status?: ReturnType<typeof parseIdeaStatus>
    } = {}

    if (body.title !== undefined) updateData.title = String(body.title).trim()
    if (body.description !== undefined) updateData.description = String(body.description).trim()
    if (body.category !== undefined) updateData.category = String(body.category).trim()
    if (body.positioningStatement !== undefined) {
      updateData.positioningStatement = String(body.positioningStatement).trim()
    }
    if (body.requiredAttributes !== undefined) {
      updateData.requiredAttributes = String(body.requiredAttributes).trim()
    }
    if (body.competitorOverview !== undefined) {
      updateData.competitorOverview = String(body.competitorOverview).trim()
    }
    if (body.isHidden !== undefined) {
      if (typeof body.isHidden !== 'boolean') {
        throw badRequest('Invalid hidden flag')
      }

      updateData.isHidden = body.isHidden
    }

    if (body.status !== undefined) {
      updateData.status = parseIdeaStatus(body.status)
    }

    if (!Object.keys(updateData).length) {
      throw badRequest('No fields to update')
    }

    const idea = await prisma.idea.update({
      where: { id },
      data: updateData,
      include: ideaDetailInclude,
    })

    return NextResponse.json(serializeIdeaDetail(idea))
  } catch (error) {
    return jsonError(error)
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const user = await requireUser()
    const { id } = await params
    const existing = await prisma.idea.findUnique({
      where: { id },
    })

    if (!existing) {
      throw notFound('Idea not found')
    }

    ensureCanManageRecord(user, existing.createdById)
    await prisma.idea.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    return jsonError(error)
  }
}
