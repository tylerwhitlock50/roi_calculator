'use client'

import React, { useMemo, useState } from 'react'

import BlankNumberInput, { type BlankableNumber } from '@/components/BlankNumberInput'
import type { IdeaRecord } from '@/lib/api'
import {
  formatVentureRecommendedStage,
  getRecommendedStageCapital,
  getVentureRecommendationTone,
  VENTURE_STAGE_ORDER,
} from '@/lib/venture-summary'

type VenturePortfolioSectionProps = {
  ideas: IdeaRecord[]
}

export default function VenturePortfolioSection({ ideas }: VenturePortfolioSectionProps) {
  const [capitalBudget, setCapitalBudget] = useState<BlankableNumber>(1_000_000)

  const rankedIdeas = useMemo(
    () =>
      ideas
        .filter((idea) => idea.ventureSummary)
        .sort((left, right) => (right.ventureSummary?.ventureScore ?? 0) - (left.ventureSummary?.ventureScore ?? 0)),
    [ideas]
  )

  if (!rankedIdeas.length) {
    return (
      <section className="card space-y-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Venture portfolio</h2>
          <p className="mt-2 text-sm text-slate-500">
            Save a venture scorecard on an idea to rank staged bets against the rest of the pipeline.
          </p>
        </div>
      </section>
    )
  }

  const stageSummaries = VENTURE_STAGE_ORDER.map((stage) => {
    const stageIdeas = rankedIdeas.filter((idea) => idea.ventureSummary?.recommendedStage === stage)
    return {
      stage,
      count: stageIdeas.length,
      capital: stageIdeas.reduce(
        (sum, idea) => sum + getRecommendedStageCapital(idea.ventureSummary!),
        0
      ),
    }
  })
  const totalValidationCapital = rankedIdeas.reduce(
    (sum, idea) => sum + (idea.ventureSummary?.validationCapital ?? 0),
    0
  )
  const totalBuildCapital = rankedIdeas.reduce((sum, idea) => sum + (idea.ventureSummary?.buildCapital ?? 0), 0)
  const totalScaleCapital = rankedIdeas.reduce((sum, idea) => sum + (idea.ventureSummary?.scaleCapital ?? 0), 0)
  const recommendedCapital = rankedIdeas.reduce(
    (sum, idea) => sum + getRecommendedStageCapital(idea.ventureSummary!),
    0
  )
  const normalizedBudget = typeof capitalBudget === 'number' ? capitalBudget : 0
  const remainingBudget = normalizedBudget - recommendedCapital

  return (
    <section className="card space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Venture portfolio</h2>
          <p className="mt-2 text-sm text-slate-500">
            Compare venture-scored ideas across staged capital asks so the team can spread smaller asymmetric bets before committing to heavier builds.
          </p>
        </div>
        <div className="w-full max-w-xs">
          <label className="form-label" htmlFor="portfolio-capital-budget">
            Working capital budget
          </label>
          <BlankNumberInput
            id="portfolio-capital-budget"
            className="input-field"
            min={0}
            step={1000}
            value={capitalBudget}
            onChange={setCapitalBudget}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Ideas with venture scores" value={String(rankedIdeas.length)} />
        <Metric label="Recommended capital" value={formatCurrency(recommendedCapital)} />
        <Metric label="Remaining budget" value={formatCurrency(remainingBudget)} />
        <Metric label="Total 24-month ceiling" value={formatCurrency(rankedIdeas.reduce((sum, idea) => sum + (idea.ventureSummary?.marketCeiling24Month ?? 0), 0))} />
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        {stageSummaries.map((summary) => (
          <div key={summary.stage} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
              {formatVentureRecommendedStage(summary.stage)}
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{summary.count}</div>
            <p className="mt-2 text-sm text-slate-500">{formatCurrency(summary.capital)} staged capital</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Metric label="Validation capital" value={formatCurrency(totalValidationCapital)} />
        <Metric label="Build capital" value={formatCurrency(totalBuildCapital)} />
        <Metric label="Scale capital" value={formatCurrency(totalScaleCapital)} />
      </div>

      <div className="overflow-x-auto rounded-[24px] border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Idea</th>
              <th className="px-4 py-3 font-medium">Recommendation</th>
              <th className="px-4 py-3 font-medium">Venture score</th>
              <th className="px-4 py-3 font-medium">Return on focus</th>
              <th className="px-4 py-3 font-medium">24-month ceiling</th>
              <th className="px-4 py-3 font-medium">Access capital</th>
              <th className="px-4 py-3 font-medium">Capital efficiency</th>
              <th className="px-4 py-3 font-medium">NPV</th>
              <th className="px-4 py-3 font-medium">IRR</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rankedIdeas.map((idea) => {
              const summary = idea.ventureSummary!
              const tone = getVentureRecommendationTone(summary.recommendationBucket)

              return (
                <tr key={idea.id}>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{idea.title}</div>
                    <div className="text-xs text-slate-500">{idea.category}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                        tone === 'positive'
                          ? 'bg-success-50 text-success-700'
                          : tone === 'caution'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-danger-50 text-danger-700'
                      }`}
                    >
                      {summary.recommendationBucket}
                    </span>
                    <div className="mt-1 text-xs text-slate-500">
                      {formatVentureRecommendedStage(summary.recommendedStage)}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{summary.ventureScore.toFixed(1)}</td>
                  <td className="px-4 py-3">{formatCurrency(summary.returnOnFocus)}</td>
                  <td className="px-4 py-3">{formatCurrency(summary.marketCeiling24Month)}</td>
                  <td className="px-4 py-3">{formatCurrency(summary.accessCapital)}</td>
                  <td className="px-4 py-3">{summary.capitalEfficiencyRatio.toFixed(1)}x</td>
                  <td className="px-4 py-3">
                    {idea.roiSummary ? formatCurrency(idea.roiSummary.npv) : 'Pending'}
                  </td>
                  <td className="px-4 py-3">
                    {idea.roiSummary ? `${(idea.roiSummary.irr * 100).toFixed(1)}%` : 'Pending'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
      <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">{label}</div>
      <div className="mt-2 text-lg font-semibold text-slate-900">{value}</div>
    </div>
  )
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}
