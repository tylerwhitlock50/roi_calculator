import { NextResponse } from 'next/server'

import { verifyPassword } from '@/lib/auth/password'
import { saveSessionUser } from '@/lib/auth/session'
import { badRequest, jsonError, unauthorized } from '@/lib/http'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      throw badRequest('Email and password are required')
    }

    const user = await prisma.user.findUnique({
      where: { email: String(email).toLowerCase().trim() },
    })

    if (!user || !user.isActive) {
      throw unauthorized('Invalid email or password')
    }

    const isValid = await verifyPassword(String(password), user.passwordHash)

    if (!isValid) {
      throw unauthorized('Invalid email or password')
    }

    await saveSessionUser({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role === 'ADMIN' ? 'admin' : 'member',
    })

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role === 'ADMIN' ? 'admin' : 'member',
      },
    })
  } catch (error) {
    return jsonError(error)
  }
}
