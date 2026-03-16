import path from 'node:path'

import bcrypt from 'bcryptjs'
import type { PrismaClient, User } from '@prisma/client'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const databasePath = path.join(process.cwd(), 'data', 'roi-tool.db')
process.env.DATABASE_URL = `file:${databasePath}`
process.env.SESSION_SECRET = 'test-session-secret-change-me-32-chars'

let prisma: PrismaClient
let adminUser: User
let memberUser: User

async function loadRoute<T>(
  routePath: string,
  options?: {
    user?: User
    adminError?: unknown
    userError?: unknown
  }
): Promise<T> {
  vi.resetModules()

  if (options) {
    vi.doMock('@/lib/server-auth', async () => {
      const actual = await vi.importActual<typeof import('@/lib/server-auth')>('@/lib/server-auth')
      return {
        ...actual,
        requireUser: vi.fn(async () => {
          if (options.userError) {
            throw options.userError
          }
          return options.user ?? adminUser
        }),
        requireAdmin: vi.fn(async () => {
          if (options.adminError) {
            throw options.adminError
          }
          return options.user ?? adminUser
        }),
      }
    })
  }

  return import(routePath) as Promise<T>
}

beforeAll(async () => {
  const prismaModule = await import('@/lib/prisma')
  prisma = prismaModule.prisma
})

beforeEach(async () => {
  vi.resetModules()
  vi.unmock('@/lib/server-auth')
  vi.unmock('@/lib/auth/session')

  await prisma.roiSummary.deleteMany()
  await prisma.laborEntry.deleteMany()
  await prisma.bomPart.deleteMany()
  await prisma.costEstimate.deleteMany()
  await prisma.salesForecast.deleteMany()
  await prisma.idea.deleteMany()
  await prisma.activityRate.deleteMany()
  await prisma.user.deleteMany()

  const adminHash = await bcrypt.hash('admin123', 10)
  const memberHash = await bcrypt.hash('member123', 10)

  adminUser = await prisma.user.create({
    data: {
      email: 'admin@local.test',
      fullName: 'Admin User',
      passwordHash: adminHash,
      role: 'ADMIN',
      isActive: true,
    },
  })

  memberUser = await prisma.user.create({
    data: {
      email: 'member@local.test',
      fullName: 'Member User',
      passwordHash: memberHash,
      role: 'MEMBER',
      isActive: true,
    },
  })

  await prisma.activityRate.create({
    data: {
      activityName: 'Mechanical Engineering',
      ratePerHour: 125,
    },
  })
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('API smoke flow', () => {
  it('handles login, dashboard load, CRUD, ROI save, and detail reload', async () => {
    const saveSessionUser = vi.fn()
    vi.doMock('@/lib/auth/session', async () => {
      const actual = await vi.importActual<typeof import('@/lib/auth/session')>('@/lib/auth/session')
      return {
        ...actual,
        saveSessionUser,
      }
    })

    const authRoute = await import('@/app/api/auth/login/route')
    const loginResponse = await authRoute.POST(
      new Request('http://localhost/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'admin@local.test',
          password: 'admin123',
        }),
      })
    )
    expect(loginResponse.status).toBe(200)
    expect(saveSessionUser).toHaveBeenCalled()

    const ideasRoute = await loadRoute<typeof import('@/app/api/ideas/route')>(
      '@/app/api/ideas/route',
      { user: adminUser }
    )

    const createIdeaResponse = await ideasRoute.POST(
      new Request('http://localhost/api/ideas', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Portable Press',
          description: 'Compact benchtop press for short-run assembly.',
          category: 'Industrial Equipment',
          positioningStatement: 'A portable press for rapid low-volume builds.',
          requiredAttributes: 'Low footprint, low maintenance, and stable force output.',
          competitorOverview: 'Competes with larger floor units and slower outsourced workflows.',
        }),
      })
    )
    expect(createIdeaResponse.status).toBe(201)
    const createdIdea = await createIdeaResponse.json()

    const listResponse = await ideasRoute.GET()
    const listPayload = await listResponse.json()
    expect(listPayload).toHaveLength(1)

    const forecastRoute = await loadRoute<typeof import('@/app/api/ideas/[id]/forecasts/route')>(
      '@/app/api/ideas/[id]/forecasts/route',
      { user: adminUser }
    )

    const forecastCreate = await forecastRoute.POST(
      new Request('http://localhost/api/ideas/id/forecasts', {
        method: 'POST',
        body: JSON.stringify({
          contributorRole: 'Sales',
          channelOrCustomer: 'Direct',
          monthlyVolumeEstimate: [{ month_date: '2026-04', units: 20, price: 350 }],
        }),
      }),
      { params: Promise.resolve({ id: createdIdea.id }) }
    )
    expect(forecastCreate.status).toBe(201)
    const forecastPayload = await forecastCreate.json()

    const forecastUpdate = await forecastRoute.PATCH(
      new Request('http://localhost/api/ideas/id/forecasts', {
        method: 'PATCH',
        body: JSON.stringify({
          forecastId: forecastPayload.id,
          contributorRole: 'Sales Ops',
          channelOrCustomer: 'Distributor',
          monthlyVolumeEstimate: [{ month_date: '2026-05', units: 25, price: 375 }],
        }),
      }),
      { params: Promise.resolve({ id: createdIdea.id }) }
    )
    expect(forecastUpdate.status).toBe(200)

    const forecastDelete = await forecastRoute.DELETE(
      new Request('http://localhost/api/ideas/id/forecasts', {
        method: 'DELETE',
        body: JSON.stringify({ forecastId: forecastPayload.id }),
      }),
      { params: Promise.resolve({ id: createdIdea.id }) }
    )
    expect(forecastDelete.status).toBe(200)

    const persistentForecast = await forecastRoute.POST(
      new Request('http://localhost/api/ideas/id/forecasts', {
        method: 'POST',
        body: JSON.stringify({
          contributorRole: 'Sales',
          channelOrCustomer: 'OEM Partner',
          monthlyVolumeEstimate: [{ month_date: '2026-06', units: 30, price: 420 }],
        }),
      }),
      { params: Promise.resolve({ id: createdIdea.id }) }
    )
    expect(persistentForecast.status).toBe(201)

    const activityRate = await prisma.activityRate.findFirstOrThrow()
    const costRoute = await loadRoute<typeof import('@/app/api/ideas/[id]/cost-estimates/route')>(
      '@/app/api/ideas/[id]/cost-estimates/route',
      { user: adminUser }
    )

    const costCreate = await costRoute.POST(
      new Request('http://localhost/api/ideas/id/cost-estimates', {
        method: 'POST',
        body: JSON.stringify({
          toolingCost: 1000,
          engineeringHours: 12,
          engineeringRatePerHour: 125,
          marketingBudget: 300,
          marketingCostPerUnit: 15,
          overheadRate: 60,
          supportTimePct: 0.2,
          ppcBudget: 35,
          bomParts: [{ item: 'Frame', unitCost: 80, quantity: 1, cashEffect: true }],
          laborEntries: [{ activityId: activityRate.id, hours: 2, minutes: 0, seconds: 0 }],
        }),
      }),
      { params: Promise.resolve({ id: createdIdea.id }) }
    )
    expect(costCreate.status).toBe(201)
    const costPayload = await costCreate.json()

    const costUpdate = await costRoute.PATCH(
      new Request('http://localhost/api/ideas/id/cost-estimates', {
        method: 'PATCH',
        body: JSON.stringify({
          costEstimateId: costPayload.id,
          toolingCost: 1200,
          engineeringHours: 14,
          engineeringRatePerHour: 140,
          marketingBudget: 320,
          marketingCostPerUnit: 20,
          overheadRate: 65,
          supportTimePct: 0.25,
          ppcBudget: 40,
          bomParts: [{ item: 'Frame', unitCost: 95, quantity: 1, cashEffect: true }],
          laborEntries: [{ activityId: activityRate.id, hours: 3, minutes: 0, seconds: 0 }],
        }),
      }),
      { params: Promise.resolve({ id: createdIdea.id }) }
    )
    expect(costUpdate.status).toBe(200)

    const costDelete = await costRoute.DELETE(
      new Request('http://localhost/api/ideas/id/cost-estimates', {
        method: 'DELETE',
        body: JSON.stringify({ costEstimateId: costPayload.id }),
      }),
      { params: Promise.resolve({ id: createdIdea.id }) }
    )
    expect(costDelete.status).toBe(200)

    const persistentCost = await costRoute.POST(
      new Request('http://localhost/api/ideas/id/cost-estimates', {
        method: 'POST',
        body: JSON.stringify({
          toolingCost: 900,
          engineeringHours: 10,
          engineeringRatePerHour: 130,
          marketingBudget: 250,
          marketingCostPerUnit: 18,
          overheadRate: 60,
          supportTimePct: 0.2,
          ppcBudget: 30,
          bomParts: [{ item: 'Frame', unitCost: 90, quantity: 1, cashEffect: true }],
          laborEntries: [{ activityId: activityRate.id, hours: 2, minutes: 30, seconds: 0 }],
        }),
      }),
      { params: Promise.resolve({ id: createdIdea.id }) }
    )
    expect(persistentCost.status).toBe(201)

    const roiRoute = await loadRoute<typeof import('@/app/api/ideas/[id]/roi-summary/route')>(
      '@/app/api/ideas/[id]/roi-summary/route',
      { user: adminUser }
    )

    const roiSave = await roiRoute.POST(
      new Request('http://localhost/api/ideas/id/roi-summary', {
        method: 'POST',
        body: JSON.stringify({
          npv: 45000,
          irr: 0.42,
          breakEvenMonth: 8,
          paybackPeriod: 0.67,
          contributionMarginPerUnit: 210,
          profitPerUnit: 210,
          assumptions: { source: 'test' },
        }),
      }),
      { params: Promise.resolve({ id: createdIdea.id }) }
    )
    expect(roiSave.status).toBe(200)

    const detailRoute = await loadRoute<typeof import('@/app/api/ideas/[id]/route')>(
      '@/app/api/ideas/[id]/route',
      { user: adminUser }
    )
    const detailResponse = await detailRoute.GET(
      new Request(`http://localhost/api/ideas/${createdIdea.id}`, { method: 'GET' }),
      { params: Promise.resolve({ id: createdIdea.id }) }
    )
    expect(detailResponse.status).toBe(200)
    const detailPayload = await detailResponse.json()
    expect(detailPayload.forecasts).toHaveLength(1)
    expect(detailPayload.costEstimates).toHaveLength(1)
    expect(detailPayload.roiSummary.npv).toBe(45000)
    expect(detailPayload.isHidden).toBe(false)

    const hideResponse = await detailRoute.PATCH(
      new Request(`http://localhost/api/ideas/${createdIdea.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isHidden: true }),
      }),
      { params: Promise.resolve({ id: createdIdea.id }) }
    )
    expect(hideResponse.status).toBe(200)
    const hiddenPayload = await hideResponse.json()
    expect(hiddenPayload.isHidden).toBe(true)

    const persistentCostPayload = await persistentCost.json()
    expect(persistentCostPayload.bomParts).toHaveLength(1)
    expect(persistentCostPayload.engineeringRatePerHour).toBe(130)
  })

  it('rejects unauthenticated access to ideas', async () => {
    const { unauthorized } = await import('@/lib/http')
    const ideasRoute = await loadRoute<typeof import('@/app/api/ideas/route')>(
      '@/app/api/ideas/route',
      { userError: unauthorized() }
    )
    const response = await ideasRoute.GET()
    expect(response.status).toBe(401)
  })

  it('rejects non-admin writes to activity rates', async () => {
    const { forbidden } = await import('@/lib/http')
    const activityRoute = await loadRoute<typeof import('@/app/api/admin/activity-rates/route')>(
      '@/app/api/admin/activity-rates/route',
      { user: memberUser, adminError: forbidden() }
    )
    const response = await activityRoute.POST(
      new Request('http://localhost/api/admin/activity-rates', {
        method: 'POST',
        body: JSON.stringify({ activityName: 'QA', ratePerHour: 85 }),
      })
    )
    expect(response.status).toBe(403)
  })

  it('prevents members from editing forecasts they do not own', async () => {
    const idea = await prisma.idea.create({
      data: {
        title: 'Shared Project',
        description: 'Shared description',
        category: 'Industrial Equipment',
        positioningStatement: 'Positioning',
        requiredAttributes: 'Attributes',
        competitorOverview: 'Competition',
        createdById: adminUser.id,
      },
    })

    const forecast = await prisma.salesForecast.create({
      data: {
        ideaId: idea.id,
        contributorId: adminUser.id,
        contributorRole: 'Sales',
        channelOrCustomer: 'Dealer',
        monthlyVolumeEstimate: [{ month_date: '2026-04', units: 10, price: 250 }],
      },
    })

    const forecastRoute = await loadRoute<typeof import('@/app/api/ideas/[id]/forecasts/route')>(
      '@/app/api/ideas/[id]/forecasts/route',
      { user: memberUser }
    )

    const response = await forecastRoute.PATCH(
      new Request('http://localhost/api/ideas/id/forecasts', {
        method: 'PATCH',
        body: JSON.stringify({
          forecastId: forecast.id,
          contributorRole: 'Marketing',
          channelOrCustomer: 'Dealer',
          monthlyVolumeEstimate: [{ month_date: '2026-05', units: 12, price: 275 }],
        }),
      }),
      { params: Promise.resolve({ id: idea.id }) }
    )

    expect(response.status).toBe(403)
  })
})
