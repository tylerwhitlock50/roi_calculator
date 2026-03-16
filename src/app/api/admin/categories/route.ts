import { NextResponse } from 'next/server'

import { DEFAULT_CATEGORIES } from '@/lib/constants'
import { badRequest, jsonError, notFound } from '@/lib/http'
import { prisma } from '@/lib/prisma'
import { requireAdmin, requireUser } from '@/lib/server-auth'

function serializeCategory(category: {
  id: string
  name: string
  displayOrder: number
  createdAt: Date
}) {
  return {
    id: category.id,
    name: category.name,
    displayOrder: category.displayOrder,
    createdAt: category.createdAt.toISOString(),
  }
}

async function ensureSeededCategories() {
  const existing = await prisma.category.findMany({
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
  })

  if (existing.length > 0) {
    return existing
  }

  await prisma.$transaction(
    DEFAULT_CATEGORIES.map((name, index) =>
      prisma.category.create({
        data: {
          name,
          displayOrder: index,
        },
      })
    )
  )

  return prisma.category.findMany({
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
  })
}

export async function GET() {
  try {
    await requireUser()
    const categories = await ensureSeededCategories()
    return NextResponse.json(categories.map(serializeCategory))
  } catch (error) {
    return jsonError(error)
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin()
    const { name } = await request.json()
    const trimmedName = String(name ?? '').trim()

    if (!trimmedName) {
      throw badRequest('name is required')
    }

    const existing = await prisma.category.findUnique({
      where: { name: trimmedName },
    })

    if (existing) {
      throw badRequest('Category already exists')
    }

    const lastCategory = await prisma.category.findFirst({
      orderBy: [{ displayOrder: 'desc' }, { createdAt: 'desc' }],
    })

    const category = await prisma.category.create({
      data: {
        name: trimmedName,
        displayOrder: (lastCategory?.displayOrder ?? -1) + 1,
      },
    })

    return NextResponse.json(serializeCategory(category), { status: 201 })
  } catch (error) {
    return jsonError(error)
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin()
    const { id, name } = await request.json()
    const trimmedId = String(id ?? '').trim()
    const trimmedName = String(name ?? '').trim()

    if (!trimmedId) {
      throw badRequest('id is required')
    }

    if (!trimmedName) {
      throw badRequest('name is required')
    }

    const existing = await prisma.category.findUnique({
      where: { id: trimmedId },
    })

    if (!existing) {
      throw notFound('Category not found')
    }

    const duplicate = await prisma.category.findUnique({
      where: { name: trimmedName },
    })

    if (duplicate && duplicate.id !== trimmedId) {
      throw badRequest('Category already exists')
    }

    const category = await prisma.category.update({
      where: { id: trimmedId },
      data: {
        name: trimmedName,
      },
    })

    return NextResponse.json(serializeCategory(category))
  } catch (error) {
    return jsonError(error)
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin()
    const { id } = await request.json()
    const trimmedId = String(id ?? '').trim()

    if (!trimmedId) {
      throw badRequest('id is required')
    }

    const existing = await prisma.category.findUnique({
      where: { id: trimmedId },
    })

    if (!existing) {
      throw notFound('Category not found')
    }

    await prisma.category.delete({
      where: { id: trimmedId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return jsonError(error)
  }
}
