import { PrismaClient } from '@prisma/client'

declare global {
  var __prisma__: PrismaClient | undefined
}

const isVercelRuntime = Boolean(process.env.VERCEL)

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = isVercelRuntime
    ? 'file:/tmp/roi-tool.db'
    : 'file:../data/roi-tool.db'
}

if (
  isVercelRuntime &&
  process.env.DATABASE_URL?.startsWith('file:') &&
  !process.env.DATABASE_URL.startsWith('file:/tmp/')
) {
  console.warn(
    `[prisma] DATABASE_URL is set to "${process.env.DATABASE_URL}" on Vercel. ` +
      'Vercel functions have a read-only filesystem outside of /tmp, and SQLite data is not persistent across invocations. ' +
      'Use a managed database (recommended) or switch to file:/tmp/... for temporary demo data.',
  )
}

export const prisma =
  global.__prisma__ ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  global.__prisma__ = prisma
}
