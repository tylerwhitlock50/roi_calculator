import { NextResponse } from 'next/server'

import { badRequest, jsonError } from '@/lib/http'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/server-auth'
import { ideaSummaryInclude } from '@/lib/server-data'
import { serializeIdea } from '@/lib/serializers'

export async function GET() {
  try {
    await requireUser()

    const ideas = await prisma.idea.findMany({
      include: ideaSummaryInclude,
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(ideas.map(serializeIdea))
  } catch (error) {
    return jsonError(error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser()
    const body = await request.json()

    const {
      title,
      description,
      category,
      positioningStatement,
      requiredAttributes,
      competitorOverview,
    } = body

    if (
      !title ||
      !description ||
      !category ||
      !positioningStatement ||
      !requiredAttributes ||
      !competitorOverview
    ) {
      throw badRequest('Missing required idea fields')
    }

    const idea = await prisma.idea.create({
      data: {
        title: String(title).trim(),
        description: String(description).trim(),
        category: String(category).trim(),
        positioningStatement: String(positioningStatement).trim(),
        requiredAttributes: String(requiredAttributes).trim(),
        competitorOverview: String(competitorOverview).trim(),
        createdById: user.id,
      },
      include: ideaSummaryInclude,
    })

    return NextResponse.json(serializeIdea(idea), { status: 201 })
  } catch (error) {
    return jsonError(error)
  }
}
