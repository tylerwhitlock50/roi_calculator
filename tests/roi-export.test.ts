import { describe, expect, it } from 'vitest'

import type { CostEstimateRecord, ForecastRecord, IdeaDetailRecord } from '@/lib/api'
import { buildRoiExportFilename, buildRoiExportHtml } from '@/lib/roi-export'
import { calculateRoiMetrics } from '@/lib/roi-calculations'
import { buildVentureSummary } from '@/lib/venture-summary'
import { buildWorkspaceReadiness } from '@/lib/workspace-readiness'

function buildProject(): IdeaDetailRecord {
  const ventureSummary = buildVentureSummary(
    {
      marketCeiling24Month: 2_000_000,
      marketCeiling36Month: 3_000_000,
      probabilitySuccessPct: 0.4,
      adjacencyScore: 3,
      asymmetricUpsideScore: 8,
      attentionDemandScore: 3,
      speedToSignalDays: 60,
      validationCapital: 25_000,
      buildCapital: 75_000,
      scaleCapital: 150_000,
    },
    buildForecasts(),
    buildEstimates()
  )
  const forecasts = buildForecasts()
  const costEstimates = buildEstimates()

  return {
    id: 'idea-1',
    title: 'Portable <ROI> & Report',
    description: 'Built so Jason can open it anywhere.',
    category: 'Accessories',
    status: 'in_review',
    isHidden: false,
    positioningStatement: 'A lightweight accessory for range sessions.',
    requiredAttributes: 'Compact, durable, low-cost',
    competitorOverview: 'Most competitors are heavier and more expensive.',
    createdAt: '2026-03-16T00:00:00.000Z',
    createdById: 'user-1',
    forecastCount: forecasts.length,
    costEstimateCount: costEstimates.length,
    owner: {
      id: 'user-1',
      fullName: 'Tyler Whitlock',
      email: 'tyler@example.com',
    },
    roiSummary: null,
    ventureSummary: {
      id: 'venture-1',
      ...ventureSummary,
      createdAt: '2026-03-16T00:00:00.000Z',
    },
    workspaceReadiness: buildWorkspaceReadiness({
      forecasts,
      costEstimates,
      roiSummary: null,
      ventureSummary: {
        id: 'venture-1',
        ...ventureSummary,
        createdAt: '2026-03-16T00:00:00.000Z',
      },
    }),
    forecasts,
    costEstimates,
  }
}

function buildForecasts(): ForecastRecord[] {
  return [
    {
      id: 'forecast-1',
      ideaId: 'idea-1',
      contributorId: 'user-1',
      contributorRole: 'Sales',
      channelOrCustomer: 'Direct',
      priceBasisConfirmed: true,
      monthlyMarketingSpend: 100,
      marketingCostPerUnit: 5,
      customerAcquisitionCostPerUnit: 2,
      monthlyVolumeEstimate: [
        { month_date: '2026-01', units: 10, price: 80 },
        { month_date: '2026-02', units: 12, price: 80 },
      ],
      createdAt: '2026-03-16T00:00:00.000Z',
      contributor: {
        id: 'user-1',
        fullName: 'Tyler Whitlock',
        email: 'tyler@example.com',
      },
    },
  ]
}

function buildEstimates(): CostEstimateRecord[] {
  return [
    {
      id: 'estimate-1',
      ideaId: 'idea-1',
      toolingCost: 400,
      engineeringHours: 2,
      engineeringRatePerHour: 125,
      launchCashRequirement: 150,
      complianceCost: 75,
      fulfillmentCostPerUnit: 6,
      warrantyReservePct: 0.03,
      scrapRate: 0,
      overheadRate: 10,
      supportTimePct: 0.1,
      createdAt: '2026-03-16T00:00:00.000Z',
      createdById: 'user-1',
      contributor: {
        id: 'user-1',
        fullName: 'Tyler Whitlock',
        email: 'tyler@example.com',
      },
      bomParts: [
        {
          id: 'bom-1',
          item: 'Chassis',
          unitCost: 12,
          quantity: 2,
          cashEffect: true,
        },
      ],
      laborEntries: [
        {
          id: 'labor-1',
          activityId: 'activity-1',
          hours: 0,
          minutes: 30,
          seconds: 0,
          activity: {
            id: 'activity-1',
            activityName: 'Assembly',
            ratePerHour: 20,
            createdAt: '2026-03-16T00:00:00.000Z',
          },
        },
      ],
    },
  ]
}

describe('roi export', () => {
  it('builds a portable html report with escaped text and calculation sections', () => {
    const project = buildProject()
    const calculations = calculateRoiMetrics(project.forecasts, project.costEstimates)

    const html = buildRoiExportHtml({
      project,
      forecasts: project.forecasts,
      costEstimates: project.costEstimates,
      calculations,
      exportedAt: new Date('2026-03-16T12:00:00.000Z'),
    })

    expect(html).toContain('Portable &lt;ROI&gt; &amp; Report')
    expect(html).toContain('ROI summary')
    expect(html).toContain('Decision summary')
    expect(html).toContain('Revenue flow')
    expect(html).toContain('Stress test')
    expect(html).toContain('Cash flow detail')
    expect(html).toContain('Forecast 1: Direct')
    expect(html).toContain('Cost estimate 1')
    expect(html).toContain('Base case')
    expect(html).toContain('Standard downside')
    expect(html).toContain('Do not proceed')
    expect(html).toContain('Revenue / unit')
    expect(html).toContain('Scrap rate')
    expect(html).toContain('Launch cash requirement')
    expect(html).toContain('Chassis')
    expect(html).toContain('Assembly')
    expect(html).toContain('Net price confirmed')
    expect(html).toContain('Break-even')
    expect(html).toContain('Venture lens')
    expect(html).toContain('Stage 1 validation')
    expect(html).toContain('Focused build capital')
  })

  it('builds a filesystem-safe export filename', () => {
    expect(buildRoiExportFilename('Portable <ROI> & Report', new Date('2026-03-16T12:00:00.000Z'))).toBe(
      'roi-portable-roi-report-2026-03-16.html'
    )
  })
})
