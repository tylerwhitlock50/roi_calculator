import { getIronSession, type SessionOptions } from 'iron-session'
import { cookies } from 'next/headers'

export type SessionUser = {
  id: string
  email: string
  fullName: string
  role: 'admin' | 'member'
}

export type AppSession = {
  user?: SessionUser
}

const defaultSecret = 'dev-session-password-change-me-32-characters'

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET ?? defaultSecret,
  cookieName: 'product-roi-session',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  },
}

export async function getSession() {
  return getIronSession<AppSession>(await cookies(), sessionOptions)
}

export async function saveSessionUser(user: SessionUser) {
  const session = await getSession()
  session.user = user
  await session.save()
}

export async function clearSession() {
  const session = await getSession()
  await session.destroy()
}
