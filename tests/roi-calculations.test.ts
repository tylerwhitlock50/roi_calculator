import { describe, expect, it } from 'vitest'

import type { CostEstimateRecord, ForecastRecord } from '@/lib/api'
import { calculateLaborCost, calculateRoiMetrics, calculateUnitEconomics } from '@/lib/roi-calculations'

function buildForecast(month: string, units: number, price: number): ForecastRecord {
  return {
    id: `forecast-${month}`,
    ideaId: 'idea-1',
    contributorId: 'user-1',
    contributorRole: 'Sales',
    channelOrCustomer: 'Direct',
    monthlyVolumeEstimate: [{ month_date: month, units, price }],
    createdAt: '2026-03-16T00:00:00.000Z',
    contributor: {
      id: 'user-1',
      fullName: 'User One',
      email: 'user@example.com',
    },
  }
}

function buildEstimate(): CostEstimateRecord {
  return {
    id: 'estimate-1',
    ideaId: 'idea-1',
    toolingCost: 50000,
    engineeringHours: 85,
    marketingBudget: 500,
    marketingCostPerUnit: 30,
    overheadRate: 60,
    supportTimePct: 0.2,
    ppcBudget: 5,
    createdAt: '2026-03-16T00:00:00.000Z',
    createdById: 'user-1',
    contributor: {
      id: 'user-1',
      fullName: 'User One',
      email: 'user@example.com',
    },
    bomParts: [],
    laborEntries: [
      {
        id: 'labor-1',
        activityId: 'activity-1',
        hours: 3,
        minutes: 0,
        seconds: 0,
        activity: {
          id: 'activity-1',
          activityName: 'Manual labor',
          ratePerHour: 25,
          createdAt: '2026-03-16T00:00:00.000Z',
        },
      },
    ],
  }
}

function buildMonthlyForecasts(count: number, units: number, price: number): ForecastRecord[] {
  return Array.from({ length: count }, (_, index) => {
    const year = 2026 + Math.floor(index / 12)
    const month = String((index % 12) + 1).padStart(2, '0')
    return buildForecast(`${year}-${month}`, units, price)
  })
}

describe('roi calculations', () => {
  it('calculates saved labor cost from the modeled time and rate', () => {
    const estimate = buildEstimate()

    expect(calculateLaborCost(estimate.laborEntries)).toBe(75)
  })

  it('keeps fixed launch labor as an upfront cost instead of diluting it across forecast units', () => {
    const estimate = buildEstimate()
    const forecasts = buildMonthlyForecasts(36, 200, 250)

    const calculations = calculateRoiMetrics(forecasts, [estimate])

    expect(calculations.assumptions.upfrontLaborCost).toBe(75)
    expect(calculations.cashFlows[0].labor).toBe(-75)
    expect(calculations.cashFlows[1].labor).toBe(0)
  })

  it('builds a fully-loaded unit economics view from the blended price and latest cost model', () => {
    const estimate = buildEstimate()
    estimate.toolingCost = 1000
    estimate.marketingCostPerUnit = 3
    estimate.overheadRate = 10
    estimate.supportTimePct = 0.2
    estimate.bomParts = [
      {
        id: 'bom-1',
        item: 'Main housing',
        unitCost: 20,
        quantity: 2,
        cashEffect: true,
      },
    ]

    const forecasts = [buildForecast('2026-01', 100, 100), buildForecast('2026-02', 100, 100)]
    const unitEconomics = calculateUnitEconomics(forecasts, [estimate])

    expect(unitEconomics.averageSellingPrice).toBe(100)
    expect(unitEconomics.bomCostPerUnit).toBe(40)
    expect(unitEconomics.allocatedMarketingPerUnit).toBe(5)
    expect(unitEconomics.customerAcquisitionPerUnit).toBe(8)
    expect(unitEconomics.launchLaborPerUnit).toBeCloseTo(0.375)
    expect(unitEconomics.toolingPerUnit).toBe(5)
    expect(unitEconomics.profitPerUnit).toBeCloseTo(29.625)
    expect(unitEconomics.canRenderSankey).toBe(true)
  })
})
