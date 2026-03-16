import { NextResponse } from 'next/server'

import { jsonError } from '@/lib/http'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/server-auth'

export async function GET() {
  try {
    await requireAdmin()

    const users = await prisma.user.findMany({
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    })

    return NextResponse.json(
      users.map((user) => ({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role === 'ADMIN' ? 'admin' : 'member',
        isActive: user.isActive,
        createdAt: user.createdAt.toISOString(),
      }))
    )
  } catch (error) {
    return jsonError(error)
  }
}
