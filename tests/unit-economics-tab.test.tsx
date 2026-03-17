// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import UnitEconomicsTab from '@/components/UnitEconomicsTab'
import type { CostEstimateRecord, ForecastRecord } from '@/lib/api'

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Sankey: () => <div data-testid="mock-sankey" />,
}))

function buildForecast(): ForecastRecord[] {
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
      monthlyVolumeEstimate: [{ month_date: '2026-01', units: 100, price: 100 }],
      createdAt: '2026-03-16T00:00:00.000Z',
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
      toolingCost: 0,
      engineeringHours: 0,
      engineeringRatePerHour: 125,
      launchCashRequirement: null,
      complianceCost: null,
      fulfillmentCostPerUnit: null,
      warrantyReservePct: null,
      scrapRate: 0,
      overheadRate: 0,
      supportTimePct: 0,
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
          item: 'Main housing',
          unitCost: 20,
          quantity: 2,
          cashEffect: true,
        },
      ],
      laborEntries: [],
    },
  ]
}

describe('UnitEconomicsTab', () => {
  it('shows unit cost and quantity in the BOM breakdown', () => {
    render(<UnitEconomicsTab forecasts={buildForecast()} costEstimates={buildEstimate()} />)

    expect(screen.getByText('Cash-affecting BOM detail')).toBeInTheDocument()
    expect(screen.getByText('$20.00 each x 2 = $40.00 / unit')).toBeInTheDocument()
    expect(screen.getAllByText('$40.00').length).toBeGreaterThan(0)
  })
})
