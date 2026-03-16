import { describe, expect, it } from 'vitest'

import type { CostEstimateRecord, ForecastRecord } from '@/lib/api'
import {
  calculateEngineeringLaunchCost,
  calculateLaborCost,
  calculateProfitInvestmentProfile,
  calculateRoiMetrics,
  calculateUnitEconomics,
} from '@/lib/roi-calculations'

function buildForecast(
  month: string,
  units: number,
  price: number,
  channelEconomics: Partial<
    Pick<ForecastRecord, 'monthlyMarketingSpend' | 'marketingCostPerUnit' | 'customerAcquisitionCostPerUnit'>
  > = {}
): ForecastRecord {
  return {
    id: `forecast-${month}`,
    ideaId: 'idea-1',
    contributorId: 'user-1',
    contributorRole: 'Sales',
    channelOrCustomer: 'Direct',
    monthlyMarketingSpend: channelEconomics.monthlyMarketingSpend ?? 500,
    marketingCostPerUnit: channelEconomics.marketingCostPerUnit ?? 30,
    customerAcquisitionCostPerUnit: channelEconomics.customerAcquisitionCostPerUnit ?? 5,
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
    engineeringRatePerHour: 0,
    overheadRate: 60,
    supportTimePct: 0.2,
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

function buildMonthlyForecasts(
  count: number,
  units: number,
  price: number,
  channelEconomics: Partial<
    Pick<ForecastRecord, 'monthlyMarketingSpend' | 'marketingCostPerUnit' | 'customerAcquisitionCostPerUnit'>
  > = {}
): ForecastRecord[] {
  return Array.from({ length: count }, (_, index) => {
    const year = 2026 + Math.floor(index / 12)
    const month = String((index % 12) + 1).padStart(2, '0')
    return buildForecast(`${year}-${month}`, units, price, channelEconomics)
  })
}

describe('roi calculations', () => {
  it('calculates saved labor cost from the modeled time and rate', () => {
    const estimate = buildEstimate()

    expect(calculateLaborCost(estimate.laborEntries)).toBe(75)
  })

  it('treats modeled labor as recurring direct labor in monthly cash flow', () => {
    const estimate = buildEstimate()
    const forecasts = buildMonthlyForecasts(36, 200, 250)

    const calculations = calculateRoiMetrics(forecasts, [estimate])

    expect(calculations.assumptions.upfrontEngineeringCost).toBe(0)
    expect(calculations.cashFlows[0].labor).toBe(0)
    expect(calculations.cashFlows[0].tooling).toBe(-50000)
    expect(calculations.cashFlows[1].labor).toBe(-15000)
    expect(calculations.cashFlows[1].marketing).toBe(-6500)
    expect(calculations.cashFlows[1].cac).toBe(-1000)
  })

  it('rolls launch engineering cost into upfront tooling investment', () => {
    const estimate = buildEstimate()
    estimate.toolingCost = 1000
    estimate.engineeringHours = 10.5
    estimate.engineeringRatePerHour = 120
    estimate.overheadRate = 0
    estimate.supportTimePct = 0
    estimate.laborEntries = []

    const forecasts = [
      buildForecast('2026-01', 100, 50, {
        monthlyMarketingSpend: 0,
        marketingCostPerUnit: 0,
        customerAcquisitionCostPerUnit: 0,
      }),
    ]
    const calculations = calculateRoiMetrics(forecasts, [estimate])
    const unitEconomics = calculateUnitEconomics(forecasts, [estimate])

    expect(calculateEngineeringLaunchCost(estimate)).toBe(1260)
    expect(calculations.assumptions.upfrontToolingCost).toBe(1000)
    expect(calculations.assumptions.upfrontEngineeringCost).toBe(1260)
    expect(calculations.cashFlows[0].tooling).toBe(-2260)
    expect(unitEconomics.toolingPerUnit).toBeCloseTo(22.6)
  })

  it('aggregates cash flow totals and overall roi from the modeled cash flows', () => {
    const estimate = buildEstimate()
    estimate.toolingCost = 1000
    estimate.overheadRate = 20
    estimate.supportTimePct = 0.5
    estimate.laborEntries[0].hours = 1
    estimate.laborEntries[0].activity.ratePerHour = 10
    estimate.bomParts = [
      {
        id: 'bom-1',
        item: 'Housing',
        unitCost: 3,
        quantity: 2,
        cashEffect: true,
      },
    ]

    const forecasts = [
      buildForecast('2026-01', 10, 50, {
        monthlyMarketingSpend: 100,
        marketingCostPerUnit: 5,
        customerAcquisitionCostPerUnit: 2,
      }),
      buildForecast('2026-02', 10, 50, {
        monthlyMarketingSpend: 100,
        marketingCostPerUnit: 5,
        customerAcquisitionCostPerUnit: 2,
      }),
    ]
    const calculations = calculateRoiMetrics(forecasts, [estimate])

    expect(calculations.totals.total).toBe(-1360)
    expect(calculations.totals.sales).toBe(1000)
    expect(calculations.totals.marketing).toBe(-300)
    expect(calculations.totals.cac).toBe(-40)
    expect(calculations.totals.costOfSales).toBe(-120)
    expect(calculations.totals.labor).toBe(-200)
    expect(calculations.totals.overhead).toBe(-400)
    expect(calculations.totals.support).toBe(-300)
    expect(calculations.totals.tooling).toBe(-1000)
    expect(calculations.roiPct).toBeCloseTo(-1360 / 2360)
  })

  it('builds a fully-loaded unit economics view from the blended price and latest cost model', () => {
    const estimate = buildEstimate()
    estimate.toolingCost = 1000
    estimate.overheadRate = 10
    estimate.supportTimePct = 0.2
    estimate.laborEntries[0].hours = 0
    estimate.laborEntries[0].minutes = 15
    estimate.bomParts = [
      {
        id: 'bom-1',
        item: 'Main housing',
        unitCost: 20,
        quantity: 2,
        cashEffect: true,
      },
    ]

    const forecasts = [
      buildForecast('2026-01', 100, 100, {
        monthlyMarketingSpend: 500,
        marketingCostPerUnit: 3,
        customerAcquisitionCostPerUnit: 5,
      }),
      buildForecast('2026-02', 100, 100, {
        monthlyMarketingSpend: 500,
        marketingCostPerUnit: 3,
        customerAcquisitionCostPerUnit: 5,
      }),
    ]
    const unitEconomics = calculateUnitEconomics(forecasts, [estimate])

    expect(unitEconomics.averageSellingPrice).toBe(100)
    expect(unitEconomics.bomCostPerUnit).toBe(40)
    expect(unitEconomics.allocatedMarketingPerUnit).toBe(8)
    expect(unitEconomics.customerAcquisitionPerUnit).toBe(5)
    expect(unitEconomics.laborPerUnit).toBeCloseTo(6.25)
    expect(unitEconomics.overheadPerUnit).toBeCloseTo(2.5)
    expect(unitEconomics.supportPerUnit).toBeCloseTo(1.75)
    expect(unitEconomics.toolingPerUnit).toBe(5)
    expect(unitEconomics.profitPerUnit).toBeCloseTo(31.5)
    expect(unitEconomics.bomParts[0]).toMatchObject({
      label: 'Main housing',
      unitCost: 20,
      quantity: 2,
      value: 40,
    })
    expect(unitEconomics.canRenderSankey).toBe(true)
  })

  it('keeps the sankey available when the unit model is underwater', () => {
    const estimate = buildEstimate()
    estimate.toolingCost = 1000
    estimate.overheadRate = 25
    estimate.supportTimePct = 0.4
    estimate.laborEntries[0].hours = 1
    estimate.bomParts = [
      {
        id: 'bom-1',
        item: 'Receiver',
        unitCost: 30,
        quantity: 2,
        cashEffect: true,
      },
    ]

    const forecasts = [
      buildForecast('2026-01', 100, 80, {
        monthlyMarketingSpend: 500,
        marketingCostPerUnit: 12,
        customerAcquisitionCostPerUnit: 8,
      }),
      buildForecast('2026-02', 100, 80, {
        monthlyMarketingSpend: 500,
        marketingCostPerUnit: 12,
        customerAcquisitionCostPerUnit: 8,
      }),
    ]
    const unitEconomics = calculateUnitEconomics(forecasts, [estimate])

    expect(unitEconomics.profitPerUnit).toBeLessThan(0)
    expect(unitEconomics.canRenderSankey).toBe(true)
    expect(unitEconomics.costStack.at(-1)?.label).toBe('Funding needed')
    expect(unitEconomics.sankeyData.nodes.some((node) => node.name === 'Funding needed / unit')).toBe(true)
  })

  it('classifies the profit-vs-investment matrix from tooling burden and projected payback', () => {
    expect(
      calculateProfitInvestmentProfile({
        toolingCost: 5000,
        projectedRevenue: 120000,
        projectedNetIncome: 20000,
      }).quadrant
    ).toBe('scale')

    expect(
      calculateProfitInvestmentProfile({
        toolingCost: 18000,
        projectedRevenue: 120000,
        projectedNetIncome: 25000,
      }).quadrant
    ).toBe('premium')

    expect(
      calculateProfitInvestmentProfile({
        toolingCost: 18000,
        projectedRevenue: 120000,
        projectedNetIncome: 6000,
      }).quadrant
    ).toBe('concept-halo')

    expect(
      calculateProfitInvestmentProfile({
        toolingCost: 5000,
        projectedRevenue: 120000,
        projectedNetIncome: 3000,
      }).quadrant
    ).toBe('accessory')
  })
})
