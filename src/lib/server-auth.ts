import type { Role, User } from '@prisma/client'

import { getSession, type SessionUser } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { forbidden, unauthorized } from '@/lib/http'

export type AuthenticatedUser = User & {
  role: Role
}

function toSessionUser(user: User): SessionUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role === 'ADMIN' ? 'admin' : 'member',
  }
}

export async function getCurrentUser() {
  const session = await getSession()
  const sessionUser = session.user

  if (!sessionUser?.id) {
    return null
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
  })

  if (!user || !user.isActive) {
    await session.destroy()
    return null
  }

  if (
    sessionUser.email !== user.email ||
    sessionUser.fullName !== user.fullName ||
    sessionUser.role !== (user.role === 'ADMIN' ? 'admin' : 'member')
  ) {
    session.user = toSessionUser(user)
    await session.save()
  }

  return user
}

export async function requireUser() {
  const user = await getCurrentUser()

  if (!user) {
    throw unauthorized()
  }

  return user
}

export async function requireAdmin() {
  const user = await requireUser()

  if (user.role !== 'ADMIN') {
    throw forbidden()
  }

  return user
}

export function ensureCanManageRecord(currentUser: User, ownerId: string) {
  if (currentUser.role !== 'ADMIN' && currentUser.id !== ownerId) {
    throw forbidden()
  }
}
