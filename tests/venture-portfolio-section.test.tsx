// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import VenturePortfolioSection from '@/components/VenturePortfolioSection'
import type { IdeaRecord, VentureSummaryRecord } from '@/lib/api'

function buildVentureSummary(
  overrides: Partial<VentureSummaryRecord>
): VentureSummaryRecord {
  return {
    id: `venture-${overrides.recommendationBucket ?? 'kill'}`,
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
    ventureScore: 72,
    recommendationBucket: 'Stage build',
    recommendedStage: 'Stage 2',
    forecastRevenue24Month: 300_000,
    forecastRevenue36Month: 450_000,
    expectedOpportunityValue: 800_000,
    returnOnFocus: 266_666.67,
    accessCapital: 100_000,
    capitalEfficiencyRatio: 20,
    salesPerEngineeringHour: 1_500,
    contributionMarginPct: 0.35,
    assumptions: {},
    createdAt: '2026-03-17T00:00:00.000Z',
    ...overrides,
  }
}

function buildIdea(id: string, title: string, ventureSummary: VentureSummaryRecord): IdeaRecord {
  return {
    id,
    title,
    description: `${title} description`,
    category: 'Industrial Equipment',
    status: 'draft',
    isHidden: false,
    positioningStatement: 'Positioning',
    requiredAttributes: 'Attributes',
    competitorOverview: 'Competition',
    createdAt: '2026-03-17T00:00:00.000Z',
    createdById: 'user-1',
    owner: {
      id: 'user-1',
      fullName: 'User One',
      email: 'user@example.com',
    },
    roiSummary: {
      id: `roi-${id}`,
      npv: 45_000,
      irr: 0.42,
      breakEvenMonth: 8,
      paybackPeriod: 0.67,
      contributionMarginPerUnit: 210,
      profitPerUnit: 150,
      assumptions: {},
      createdAt: '2026-03-17T00:00:00.000Z',
    },
    ventureSummary,
  }
}

describe('VenturePortfolioSection', () => {
  it('aggregates ranked venture ideas into a portfolio view', () => {
    render(
      <VenturePortfolioSection
        ideas={[
          buildIdea(
            'idea-1',
            'Prosthetic Foot',
            buildVentureSummary({
              ventureScore: 88,
              recommendationBucket: 'Fund aggressively',
              recommendedStage: 'Stage 3',
              scaleCapital: 300_000,
              returnOnFocus: 500_000,
            })
          ),
          buildIdea(
            'idea-2',
            'Carbon Helmet',
            buildVentureSummary({
              ventureScore: 55,
              recommendationBucket: 'Validate cheaply',
              recommendedStage: 'Stage 1',
              validationCapital: 20_000,
              returnOnFocus: 25_000,
            })
          ),
        ]}
      />
    )

    expect(screen.getByText('Venture portfolio')).toBeInTheDocument()
    expect(screen.getByText('$320,000')).toBeInTheDocument()
    expect(screen.getByText('Prosthetic Foot')).toBeInTheDocument()
    expect(screen.getByText('Carbon Helmet')).toBeInTheDocument()
    expect(screen.getByText('Fund aggressively')).toBeInTheDocument()
    expect(screen.getByText('Validate cheaply')).toBeInTheDocument()
    expect(screen.getAllByText('Stage 3 scale').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Stage 1 validation').length).toBeGreaterThan(0)
  })
})
