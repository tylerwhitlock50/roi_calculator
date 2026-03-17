import { describe, expect, it } from 'vitest'

import type { CostEstimateRecord, ForecastRecord } from '@/lib/api'
import {
  buildVentureSummary,
  doesSavedVentureSummaryMatchCurrentModel,
} from '@/lib/venture-summary'
import type { VentureSummaryRecord } from '@/lib/api'

function buildForecasts(
  count: number,
  units = 100,
  price = 100
): ForecastRecord[] {
  return Array.from({ length: count }, (_, index) => {
    const year = 2026 + Math.floor(index / 12)
    const month = String((index % 12) + 1).padStart(2, '0')

    return {
      id: `forecast-${index}`,
      ideaId: 'idea-1',
      contributorId: 'user-1',
      contributorRole: 'Sales',
      channelOrCustomer: 'Direct',
      priceBasisConfirmed: true,
      monthlyMarketingSpend: 0,
      marketingCostPerUnit: 0,
      customerAcquisitionCostPerUnit: 0,
      monthlyVolumeEstimate: [{ month_date: `${year}-${month}`, units, price }],
      createdAt: '2026-03-17T00:00:00.000Z',
      contributor: {
        id: 'user-1',
        fullName: 'User One',
        email: 'user@example.com',
      },
    }
  })
}

function buildEstimate(): CostEstimateRecord[] {
  return [
    {
      id: 'estimate-1',
      ideaId: 'idea-1',
      toolingCost: 5000,
      engineeringHours: 20,
      engineeringRatePerHour: 125,
      launchCashRequirement: 0,
      complianceCost: 0,
      fulfillmentCostPerUnit: 5,
      warrantyReservePct: 0.01,
      scrapRate: 0,
      overheadRate: 10,
      supportTimePct: 0.1,
      createdAt: '2026-03-17T00:00:00.000Z',
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
          unitCost: 25,
          quantity: 1,
          cashEffect: true,
        },
      ],
      laborEntries: [
        {
          id: 'labor-1',
          activityId: 'activity-1',
          hours: 0,
          minutes: 15,
          seconds: 0,
          activity: {
            id: 'activity-1',
            activityName: 'Assembly',
            ratePerHour: 20,
            createdAt: '2026-03-17T00:00:00.000Z',
          },
        },
      ],
    },
  ]
}

function toSavedSummary(summary: ReturnType<typeof buildVentureSummary>): VentureSummaryRecord {
  return {
    id: 'venture-1',
    ...summary,
    createdAt: '2026-03-17T00:00:00.000Z',
  }
}

describe('venture summary', () => {
  it('scores a high-upside low-attention idea as an aggressive venture bet', () => {
    const summary = buildVentureSummary(
      {
        marketCeiling24Month: 4_000_000,
        marketCeiling36Month: 5_000_000,
        probabilitySuccessPct: 0.5,
        adjacencyScore: 2,
        asymmetricUpsideScore: 10,
        attentionDemandScore: 1,
        speedToSignalDays: 30,
        validationCapital: 20_000,
        buildCapital: 80_000,
        scaleCapital: 250_000,
      },
      buildForecasts(24, 100, 100),
      buildEstimate()
    )

    expect(summary.ventureScore).toBeGreaterThanOrEqual(80)
    expect(summary.recommendationBucket).toBe('Fund aggressively')
    expect(summary.recommendedStage).toBe('Stage 3')
  })

  it('scores a low-ceiling high-attention idea as a kill', () => {
    const summary = buildVentureSummary(
      {
        marketCeiling24Month: 500_000,
        marketCeiling36Month: 650_000,
        probabilitySuccessPct: 0.2,
        adjacencyScore: 9,
        asymmetricUpsideScore: 2,
        attentionDemandScore: 10,
        speedToSignalDays: 90,
        validationCapital: 100_000,
        buildCapital: 150_000,
        scaleCapital: 250_000,
      },
      buildForecasts(24, 100, 100),
      buildEstimate()
    )

    expect(summary.ventureScore).toBeLessThan(40)
    expect(summary.recommendationBucket).toBe('Kill')
    expect(summary.recommendedStage).toBe('None')
  })

  it('hard-fails to kill when the speed to signal is slower than ninety days', () => {
    const summary = buildVentureSummary(
      {
        marketCeiling24Month: 4_000_000,
        marketCeiling36Month: 5_000_000,
        probabilitySuccessPct: 0.5,
        adjacencyScore: 3,
        asymmetricUpsideScore: 9,
        attentionDemandScore: 2,
        speedToSignalDays: 120,
        validationCapital: 20_000,
        buildCapital: 80_000,
        scaleCapital: 250_000,
      },
      buildForecasts(24, 100, 100),
      buildEstimate()
    )

    expect(summary.recommendationBucket).toBe('Kill')
    expect(summary.recommendedStage).toBe('None')
    expect(summary.ventureScore).toBeLessThan(40)
  })

  it('hard-fails to kill when access capital meets or exceeds the ceiling', () => {
    const summary = buildVentureSummary(
      {
        marketCeiling24Month: 100_000,
        marketCeiling36Month: 250_000,
        probabilitySuccessPct: 0.5,
        adjacencyScore: 3,
        asymmetricUpsideScore: 9,
        attentionDemandScore: 2,
        speedToSignalDays: 30,
        validationCapital: 50_000,
        buildCapital: 50_000,
        scaleCapital: 250_000,
      },
      buildForecasts(24, 100, 100),
      buildEstimate()
    )

    expect(summary.accessCapital).toBe(100_000)
    expect(summary.recommendationBucket).toBe('Kill')
    expect(summary.ventureScore).toBeLessThan(40)
  })

  it('derives sales per engineering hour and capital efficiency from saved data', () => {
    const summary = buildVentureSummary(
      {
        marketCeiling24Month: 2_000_000,
        marketCeiling36Month: 2_500_000,
        probabilitySuccessPct: 0.4,
        adjacencyScore: 3,
        asymmetricUpsideScore: 8,
        attentionDemandScore: 4,
        speedToSignalDays: 60,
        validationCapital: 25_000,
        buildCapital: 75_000,
        scaleCapital: 150_000,
      },
      buildForecasts(24, 10, 100),
      buildEstimate()
    )

    expect(summary.forecastRevenue24Month).toBe(24_000)
    expect(summary.salesPerEngineeringHour).toBe(1_200)
    expect(summary.accessCapital).toBe(100_000)
    expect(summary.capitalEfficiencyRatio).toBe(20)
  })

  it('detects when the saved venture summary is stale relative to current costs', () => {
    const forecasts = buildForecasts(24, 10, 100)
    const estimates = buildEstimate()
    const savedSummary = toSavedSummary(
      buildVentureSummary(
        {
          marketCeiling24Month: 2_000_000,
          marketCeiling36Month: 2_500_000,
          probabilitySuccessPct: 0.4,
          adjacencyScore: 3,
          asymmetricUpsideScore: 8,
          attentionDemandScore: 4,
          speedToSignalDays: 60,
          validationCapital: 25_000,
          buildCapital: 75_000,
          scaleCapital: 150_000,
        },
        forecasts,
        estimates
      )
    )

    expect(doesSavedVentureSummaryMatchCurrentModel(savedSummary, forecasts, estimates)).toBe(true)

    const updatedEstimates = [
      {
        ...estimates[0],
        fulfillmentCostPerUnit: 35,
      },
    ]

    expect(doesSavedVentureSummaryMatchCurrentModel(savedSummary, forecasts, updatedEstimates)).toBe(false)
  })
})
