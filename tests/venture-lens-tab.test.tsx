// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import VentureLensTab from '@/components/VentureLensTab'
import type { CostEstimateRecord, ForecastRecord, VentureSummaryRecord } from '@/lib/api'
import { buildVentureSummary } from '@/lib/venture-summary'

function buildForecasts(): ForecastRecord[] {
  return [
    {
      id: 'forecast-1',
      ideaId: 'idea-1',
      contributorId: 'user-1',
      contributorRole: 'Sales',
      channelOrCustomer: 'Direct',
      priceBasisConfirmed: true,
      monthlyMarketingSpend: 0,
      marketingCostPerUnit: 0,
      customerAcquisitionCostPerUnit: 0,
      monthlyVolumeEstimate: Array.from({ length: 24 }, (_, index) => {
        const year = 2026 + Math.floor(index / 12)
        const month = String((index % 12) + 1).padStart(2, '0')

        return {
          month_date: `${year}-${month}`,
          units: 10,
          price: 100,
        }
      }),
      createdAt: '2026-03-17T00:00:00.000Z',
      contributor: {
        id: 'user-1',
        fullName: 'User One',
        email: 'user@example.com',
      },
    },
  ]
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

function buildSavedSummary(): VentureSummaryRecord {
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
    buildForecasts(),
    buildEstimate()
  )

  return {
    id: 'venture-1',
    ...summary,
    createdAt: '2026-03-17T00:00:00.000Z',
  }
}

describe('VentureLensTab', () => {
  it('renders the saved venture inputs and computed recommendation', () => {
    render(
      <VentureLensTab
        forecasts={buildForecasts()}
        costEstimates={buildEstimate()}
        ventureSummary={buildSavedSummary()}
        onSave={vi.fn()}
        saving={false}
        saveError={null}
      />
    )

    expect(screen.getByText('Venture lens')).toBeInTheDocument()
    expect(screen.getAllByText('Fund aggressively').length).toBeGreaterThan(0)
    expect(screen.getByText('Next stage:')).toBeInTheDocument()
    expect(screen.getByText('Stage 3 scale')).toBeInTheDocument()
    expect(screen.getByText(/out of 100/i)).toBeInTheDocument()
    expect(screen.getByText(/0-39/i)).toBeInTheDocument()
    expect(screen.getByText(/40-59/i)).toBeInTheDocument()
    expect(screen.getByText(/60-79/i)).toBeInTheDocument()
    expect(screen.getByText(/80-100/i)).toBeInTheDocument()
    expect(screen.getByDisplayValue(4000000)).toBeInTheDocument()
    expect(screen.getByDisplayValue(50)).toBeInTheDocument()
    expect(screen.getByText('$100,000')).toBeInTheDocument()
    expect(screen.getByDisplayValue('2')).toBeInTheDocument()
    expect(screen.getByText(/\$2,000,000 expected opportunity \/ 1 attention/i)).toBeInTheDocument()
    expect(screen.getByText(/\$20,000 validation \+ \$80,000 focused build/i)).toBeInTheDocument()
    expect(screen.getByText(/\$4,000,000 ceiling \/ \$100,000 access capital/i)).toBeInTheDocument()
    expect(screen.getByText(/\$24,000 forecast \/ 20 hr/i)).toBeInTheDocument()
  })

  it('treats the venture scorecard as stale when forecast or cost assumptions have changed', () => {
    const updatedEstimate = buildEstimate()
    updatedEstimate[0] = {
      ...updatedEstimate[0],
      fulfillmentCostPerUnit: 35,
    }

    render(
      <VentureLensTab
        forecasts={buildForecasts()}
        costEstimates={updatedEstimate}
        ventureSummary={buildSavedSummary()}
        onSave={vi.fn()}
        saving={false}
        saveError={null}
      />
    )

    expect(screen.getByRole('button', { name: 'Update venture scorecard' })).toBeInTheDocument()
    expect(
      screen.getByText(/Forecast or cost changes have shifted the venture score/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/This venture view has been recalculated from the current forecasts and latest cost estimate/i)
    ).toBeInTheDocument()
  })
})
