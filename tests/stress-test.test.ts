import { describe, expect, it } from 'vitest'

import type { CostEstimateRecord, ForecastRecord } from '@/lib/api'
import { calculateRoiMetrics } from '@/lib/roi-calculations'
import { findRequiredForecastChangeForTargetIrr, scaleCostEstimates, scaleForecasts } from '@/lib/stress-test'

function buildForecast(month: string, units: number, price: number): ForecastRecord {
  return {
    id: `forecast-${month}`,
    ideaId: 'idea-1',
    contributorId: 'user-1',
    contributorRole: 'Sales',
    channelOrCustomer: 'Direct',
    priceBasisConfirmed: true,
    monthlyMarketingSpend: 250,
    marketingCostPerUnit: 8,
    customerAcquisitionCostPerUnit: 3,
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
    toolingCost: 5000,
    engineeringHours: 0,
    engineeringRatePerHour: 0,
    launchCashRequirement: null,
    complianceCost: null,
    fulfillmentCostPerUnit: null,
    warrantyReservePct: null,
    scrapRate: 0,
    overheadRate: 12,
    supportTimePct: 0.15,
    createdAt: '2026-03-16T00:00:00.000Z',
    createdById: 'user-1',
    contributor: {
      id: 'user-1',
      fullName: 'User One',
      email: 'user@example.com',
    },
    bomParts: [
      {
        id: 'bom-1',
        item: 'Housing',
        unitCost: 18,
        quantity: 1,
        cashEffect: true,
      },
    ],
    laborEntries: [
      {
        id: 'labor-1',
        activityId: 'activity-1',
        hours: 0,
        minutes: 20,
        seconds: 0,
        activity: {
          id: 'activity-1',
          activityName: 'Assembly',
          ratePerHour: 24,
          createdAt: '2026-03-16T00:00:00.000Z',
        },
      },
    ],
  }
}

describe('stress test helpers', () => {
  it('scales forecasts and cost estimates without mutating the source shape', () => {
    const forecasts = [buildForecast('2026-01', 100, 75)]
    const estimates = [buildEstimate()]

    const scaledForecasts = scaleForecasts(forecasts, { priceFactor: 1.1, unitFactor: 0.8 })
    const scaledEstimates = scaleCostEstimates(estimates, 1.2)

    expect(scaledForecasts[0].monthlyVolumeEstimate[0]).toMatchObject({
      units: 80,
      price: 82.5,
    })
    expect(scaledEstimates[0].toolingCost).toBe(6000)
    expect(scaledEstimates[0].overheadRate).toBeCloseTo(14.4)
    expect(forecasts[0].monthlyVolumeEstimate[0]).toMatchObject({
      units: 100,
      price: 75,
    })
    expect(estimates[0].toolingCost).toBe(5000)
  })

  it('finds the price increase required to land at a 10% irr', () => {
    const forecasts = Array.from({ length: 24 }, (_, index) => {
      const year = 2026 + Math.floor(index / 12)
      const month = String((index % 12) + 1).padStart(2, '0')
      return buildForecast(`${year}-${month}`, 120, 70)
    })
    const estimates = [buildEstimate()]
    const baseline = calculateRoiMetrics(forecasts, estimates)

    const target = findRequiredForecastChangeForTargetIrr({
      forecasts,
      costEstimates: estimates,
      mode: 'price',
      targetIrr: 0.1,
      baseCalculations: baseline,
    })

    expect(target).not.toBeNull()
    expect(Math.abs(target?.changePct ?? 0)).toBeGreaterThan(0.1)
    expect(target?.calculations.irr ?? 0).toBeCloseTo(0.1, 2)
  })

  it('returns null when volume alone cannot rescue underwater unit economics', () => {
    const forecasts = Array.from({ length: 12 }, (_, index) => {
      const month = String(index + 1).padStart(2, '0')
      return buildForecast(`2026-${month}`, 100, 25)
    })
    const estimates = [buildEstimate()]
    estimates[0].bomParts[0].unitCost = 30
    estimates[0].laborEntries[0].activity.ratePerHour = 80

    const target = findRequiredForecastChangeForTargetIrr({
      forecasts,
      costEstimates: estimates,
      mode: 'volume',
      targetIrr: 0.1,
    })

    expect(target).toBeNull()
  })
})
