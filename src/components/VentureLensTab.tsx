'use client'

import React, { useEffect, useMemo, useState } from 'react'

import BlankNumberInput, {
  blankableNumberToNumber,
  type BlankableNumber,
} from '@/components/BlankNumberInput'
import type {
  CostEstimateRecord,
  ForecastRecord,
  VentureSummaryRecord,
} from '@/lib/api'
import {
  buildVentureSummary,
  getVentureRecommendationTone,
  type VentureManualInputs,
} from '@/lib/venture-summary'

type VentureFormState = {
  marketCeiling24Month: BlankableNumber
  marketCeiling36Month: BlankableNumber
  probabilitySuccessPct: BlankableNumber
  adjacencyScore: number
  asymmetricUpsideScore: number
  attentionDemandScore: number
  speedToSignalDays: number
  validationCapital: BlankableNumber
  buildCapital: BlankableNumber
  scaleCapital: BlankableNumber
}

type VentureLensTabProps = {
  forecasts: ForecastRecord[]
  costEstimates: CostEstimateRecord[]
  ventureSummary: VentureSummaryRecord | null
  onSave: (payload: VentureManualInputs) => void
  saving: boolean
  saveError: string | null
}

function createInitialForm(ventureSummary: VentureSummaryRecord | null): VentureFormState {
  if (!ventureSummary) {
    return {
      marketCeiling24Month: '',
      marketCeiling36Month: '',
      probabilitySuccessPct: '',
      adjacencyScore: 5,
      asymmetricUpsideScore: 5,
      attentionDemandScore: 5,
      speedToSignalDays: 60,
      validationCapital: '',
      buildCapital: '',
      scaleCapital: '',
    }
  }

  return {
    marketCeiling24Month: ventureSummary.marketCeiling24Month,
    marketCeiling36Month: ventureSummary.marketCeiling36Month,
    probabilitySuccessPct: ventureSummary.probabilitySuccessPct * 100,
    adjacencyScore: ventureSummary.adjacencyScore,
    asymmetricUpsideScore: ventureSummary.asymmetricUpsideScore,
    attentionDemandScore: ventureSummary.attentionDemandScore,
    speedToSignalDays: ventureSummary.speedToSignalDays,
    validationCapital: ventureSummary.validationCapital,
    buildCapital: ventureSummary.buildCapital,
    scaleCapital: ventureSummary.scaleCapital,
  }
}

function toManualInputs(form: VentureFormState): VentureManualInputs {
  return {
    marketCeiling24Month: blankableNumberToNumber(form.marketCeiling24Month),
    marketCeiling36Month: blankableNumberToNumber(form.marketCeiling36Month),
    probabilitySuccessPct: blankableNumberToNumber(form.probabilitySuccessPct) / 100,
    adjacencyScore: form.adjacencyScore,
    asymmetricUpsideScore: form.asymmetricUpsideScore,
    attentionDemandScore: form.attentionDemandScore,
    speedToSignalDays: form.speedToSignalDays,
    validationCapital: blankableNumberToNumber(form.validationCapital),
    buildCapital: blankableNumberToNumber(form.buildCapital),
    scaleCapital: blankableNumberToNumber(form.scaleCapital),
  }
}

export default function VentureLensTab({
  forecasts,
  costEstimates,
  ventureSummary,
  onSave,
  saving,
  saveError,
}: VentureLensTabProps) {
  const [form, setForm] = useState<VentureFormState>(() => createInitialForm(ventureSummary))

  useEffect(() => {
    setForm(createInitialForm(ventureSummary))
  }, [ventureSummary])

  const manualInputs = useMemo(() => toManualInputs(form), [form])
  const preview = useMemo(
    () => buildVentureSummary(manualInputs, forecasts, costEstimates),
    [costEstimates, forecasts, manualInputs]
  )
  const tone = getVentureRecommendationTone(preview.recommendationBucket)
  const bannerClasses =
    tone === 'positive'
      ? 'border-success-200 bg-success-50 text-success-900'
      : tone === 'caution'
        ? 'border-amber-200 bg-amber-50 text-amber-900'
        : 'border-danger-200 bg-danger-50 text-danger-900'
  const hasChanges =
    !ventureSummary ||
    JSON.stringify({
      marketCeiling24Month: ventureSummary.marketCeiling24Month,
      marketCeiling36Month: ventureSummary.marketCeiling36Month,
      probabilitySuccessPct: ventureSummary.probabilitySuccessPct,
      adjacencyScore: ventureSummary.adjacencyScore,
      asymmetricUpsideScore: ventureSummary.asymmetricUpsideScore,
      attentionDemandScore: ventureSummary.attentionDemandScore,
      speedToSignalDays: ventureSummary.speedToSignalDays,
      validationCapital: ventureSummary.validationCapital,
      buildCapital: ventureSummary.buildCapital,
      scaleCapital: ventureSummary.scaleCapital,
    }) !== JSON.stringify(manualInputs)
  const hardGates = Array.isArray((preview.assumptions as { hardGates?: unknown[] }).hardGates)
    ? ((preview.assumptions as { hardGates: string[] }).hardGates ?? [])
    : []
  const scoreBreakdown =
    ((preview.assumptions as { scoreBreakdown?: Record<string, number> }).scoreBreakdown ?? {}) as Record<
      string,
      number
    >

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-950">Venture lens</h2>
        <p className="mt-2 text-sm text-slate-500">
          Layer a venture-style gate on top of the existing ROI model so large-optionality bets do not get filtered out by financial discipline alone.
        </p>
      </div>

      <div className={`rounded-[24px] border px-5 py-5 ${bannerClasses}`}>
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em]">Venture recommendation</div>
        <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-3xl font-semibold">{preview.recommendationBucket}</div>
            <p className="mt-2 text-sm">
              Next stage: <span className="font-semibold">{preview.recommendedStage}</span>
            </p>
          </div>
          <div className="rounded-2xl border border-white/60 bg-white/70 px-4 py-4 text-right text-slate-900">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Venture score</div>
            <div className="mt-2 text-3xl font-semibold">{preview.ventureScore.toFixed(1)}</div>
          </div>
        </div>
        {hardGates.length > 0 && (
          <div className="mt-4 rounded-2xl border border-white/60 bg-white/70 px-4 py-4 text-sm text-slate-700">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Hard gates</div>
            <div className="mt-2 space-y-2">
              {hardGates.map((gate) => (
                <p key={gate}>{gate}</p>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Expected opportunity" value={formatCurrency(preview.expectedOpportunityValue)} />
        <Metric label="Return on focus" value={formatCurrency(preview.returnOnFocus)} />
        <Metric label="24-month forecast" value={formatCurrency(preview.forecastRevenue24Month)} />
        <Metric label="36-month forecast" value={formatCurrency(preview.forecastRevenue36Month)} />
        <Metric label="Access capital" value={formatCurrency(preview.accessCapital)} />
        <Metric label="Capital efficiency" value={`${preview.capitalEfficiencyRatio.toFixed(1)}x`} />
        <Metric label="Sales / engineering hr" value={formatCurrency(preview.salesPerEngineeringHour)} />
        <Metric label="Contribution margin" value={formatPercent(preview.contributionMarginPct)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Venture scorecard inputs</h3>
              <p className="mt-1 text-sm text-slate-500">
                Save the manual venture lens once the opportunity, fit, and staged capital assumptions are credible enough to compare against the rest of the portfolio.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <FieldNumber
              id="marketCeiling24Month"
              label="24-month market ceiling"
              hint="Primary opportunity ceiling used for the score."
              value={form.marketCeiling24Month}
              min={0}
              step={1000}
              onChange={(value) => setForm((current) => ({ ...current, marketCeiling24Month: value }))}
            />
            <FieldNumber
              id="marketCeiling36Month"
              label="36-month market ceiling"
              hint="Stored for context and export, not the primary v1 score driver."
              value={form.marketCeiling36Month}
              min={0}
              step={1000}
              onChange={(value) => setForm((current) => ({ ...current, marketCeiling36Month: value }))}
            />
            <FieldNumber
              id="probabilitySuccessPct"
              label="Probability of success (%)"
              hint="Enter the probability as a percentage."
              value={form.probabilitySuccessPct}
              min={0}
              max={100}
              step={1}
              onChange={(value) => setForm((current) => ({ ...current, probabilitySuccessPct: value }))}
            />
            <SelectField
              id="speedToSignalDays"
              label="Speed to signal"
              hint="Fast feedback is a hard gate in this lens."
              value={String(form.speedToSignalDays)}
              options={[
                { label: '30 days', value: '30' },
                { label: '60 days', value: '60' },
                { label: '90 days', value: '90' },
                { label: '120 days', value: '120' },
              ]}
              onChange={(value) =>
                setForm((current) => ({ ...current, speedToSignalDays: Number(value) }))
              }
            />
            <RangeField
              id="adjacencyScore"
              label="Capacity leverage / adjacency"
              hint="1 means a heavy operational lift; 10 means it rides existing processes cleanly."
              value={form.adjacencyScore}
              onChange={(value) => setForm((current) => ({ ...current, adjacencyScore: value }))}
            />
            <RangeField
              id="asymmetricUpsideScore"
              label="Asymmetric upside"
              hint="1 means capped upside; 10 means it expands the game board if it works."
              value={form.asymmetricUpsideScore}
              onChange={(value) => setForm((current) => ({ ...current, asymmetricUpsideScore: value }))}
            />
            <RangeField
              id="attentionDemandScore"
              label="Attention demand"
              hint="1 means low distraction; 10 means this would pull hard against the core workflow."
              value={form.attentionDemandScore}
              onChange={(value) => setForm((current) => ({ ...current, attentionDemandScore: value }))}
            />
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-600">
              <div className="font-semibold text-slate-900">Forecast-derived context</div>
              <p className="mt-2">
                The venture score pulls forecast revenue from saved forecast rows and contribution leverage from the latest saved cost estimate.
              </p>
              <p className="mt-2">
                Forecasts saved: <span className="font-semibold text-slate-900">{forecasts.length}</span>
              </p>
              <p className="mt-1">
                Cost estimates saved: <span className="font-semibold text-slate-900">{costEstimates.length}</span>
              </p>
            </div>
            <FieldNumber
              id="validationCapital"
              label="Stage 1 validation capital"
              hint="Cheap validation capital for proving the bet."
              value={form.validationCapital}
              min={0}
              step={1000}
              onChange={(value) => setForm((current) => ({ ...current, validationCapital: value }))}
            />
            <FieldNumber
              id="buildCapital"
              label="Stage 2 focused-build capital"
              hint="Engineering, tooling, and pilot-run capital to get the bet into market."
              value={form.buildCapital}
              min={0}
              step={1000}
              onChange={(value) => setForm((current) => ({ ...current, buildCapital: value }))}
            />
            <FieldNumber
              id="scaleCapital"
              label="Stage 3 scale capital"
              hint="Capital for full-scale rollout once the signal is proven."
              value={form.scaleCapital}
              min={0}
              step={1000}
              onChange={(value) => setForm((current) => ({ ...current, scaleCapital: value }))}
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <h3 className="text-lg font-semibold text-slate-900">Score breakdown</h3>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              {[
                ['Expected opportunity', scoreBreakdown.expectedOpportunity ?? 0],
                ['Capital efficiency', scoreBreakdown.capitalEfficiency ?? 0],
                ['Adjacency', scoreBreakdown.adjacency ?? 0],
                ['Asymmetric upside', scoreBreakdown.asymmetricUpside ?? 0],
                ['Speed to signal', scoreBreakdown.speedToSignal ?? 0],
                ['Contribution leverage', scoreBreakdown.contributionLeverage ?? 0],
                ['Attention penalty', -(scoreBreakdown.attentionPenalty ?? 0)],
              ].map(([label, score]) => (
                <div key={String(label)} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="font-medium text-slate-900">{label}</div>
                  <div className="font-semibold text-slate-900">{Number(score).toFixed(1)}</div>
                </div>
              ))}
            </div>
          </div>

          {saveError && (
            <div className="rounded-2xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
              {saveError}
            </div>
          )}

          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <div className="flex flex-wrap gap-3">
              {hasChanges && (
                <button className="btn-primary" onClick={() => onSave(manualInputs)} disabled={saving}>
                  {saving
                    ? 'Saving venture lens…'
                    : ventureSummary
                      ? 'Update venture scorecard'
                      : 'Save venture scorecard'}
                </button>
              )}
            </div>

            {!hasChanges && (
              <div className="rounded-2xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700">
                The saved venture summary already matches the current scorecard inputs.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
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

function FieldNumber({
  id,
  label,
  hint,
  value,
  min,
  max,
  step,
  onChange,
}: {
  id: string
  label: string
  hint?: string
  value: BlankableNumber
  min?: number
  max?: number
  step?: number
  onChange: (value: BlankableNumber) => void
}) {
  return (
    <div className="form-group mb-0">
      <label className="form-label" htmlFor={id}>
        {label}
      </label>
      {hint && <p className="mb-2 text-xs text-slate-500">{hint}</p>}
      <BlankNumberInput
        id={id}
        className="input-field"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
      />
    </div>
  )
}

function SelectField({
  id,
  label,
  hint,
  value,
  options,
  onChange,
}: {
  id: string
  label: string
  hint?: string
  value: string
  options: Array<{ label: string; value: string }>
  onChange: (value: string) => void
}) {
  return (
    <div className="form-group mb-0">
      <label className="form-label" htmlFor={id}>
        {label}
      </label>
      {hint && <p className="mb-2 text-xs text-slate-500">{hint}</p>}
      <select id={id} className="input-field" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function RangeField({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string
  label: string
  hint?: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="form-group mb-0">
      <label className="form-label" htmlFor={id}>
        {label}
      </label>
      {hint && <p className="mb-2 text-xs text-slate-500">{hint}</p>}
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>1</span>
          <span className="font-semibold text-slate-900">{value}</span>
          <span>10</span>
        </div>
        <input
          id={id}
          type="range"
          min={1}
          max={10}
          step={1}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="mt-3 w-full"
        />
      </div>
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

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`
}
