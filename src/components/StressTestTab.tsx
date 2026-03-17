'use client'

import React, { useMemo, useState } from 'react'

import BlankNumberInput, { type BlankableNumber, blankableNumberToNumber } from '@/components/BlankNumberInput'
import type { CostEstimateRecord, ForecastRecord } from '@/lib/api'
import { calculateRoiMetrics, calculateUnitEconomics } from '@/lib/roi-calculations'
import { findRequiredForecastChangeForTargetIrr } from '@/lib/stress-test'

type StressTestTabProps = {
  forecasts: ForecastRecord[]
  costEstimates: CostEstimateRecord[]
}

type StressControls = {
  cogsPctChange: BlankableNumber
  cacDeltaPerUnit: BlankableNumber
  shippingDeltaPerUnit: BlankableNumber
  scrapRateDeltaPctPoints: BlankableNumber
  averagePricePctChange: BlankableNumber
  volumePctChange: BlankableNumber
}

const INITIAL_CONTROLS: StressControls = {
  cogsPctChange: 0,
  cacDeltaPerUnit: 0,
  shippingDeltaPerUnit: 0,
  scrapRateDeltaPctPoints: 0,
  averagePricePctChange: 0,
  volumePctChange: 0,
}

export default function StressTestTab({ forecasts, costEstimates }: StressTestTabProps) {
  const [controls, setControls] = useState<StressControls>(INITIAL_CONTROLS)
  const targetIrr = 0.1

  const baselineRoi = useMemo(() => calculateRoiMetrics(forecasts, costEstimates), [costEstimates, forecasts])
  const baselineUnitEconomics = useMemo(() => calculateUnitEconomics(forecasts, costEstimates), [costEstimates, forecasts])
  const priceTarget = useMemo(
    () =>
      findRequiredForecastChangeForTargetIrr({
        forecasts,
        costEstimates,
        mode: 'price',
        targetIrr,
        baseCalculations: baselineRoi,
      }),
    [baselineRoi, costEstimates, forecasts]
  )
  const volumeTarget = useMemo(
    () =>
      findRequiredForecastChangeForTargetIrr({
        forecasts,
        costEstimates,
        mode: 'volume',
        targetIrr,
        baseCalculations: baselineRoi,
      }),
    [baselineRoi, costEstimates, forecasts]
  )

  const stressedInputs = useMemo(() => {
    const cogsMultiplier = 1 + blankableNumberToNumber(controls.cogsPctChange) / 100
    const priceMultiplier = 1 + blankableNumberToNumber(controls.averagePricePctChange) / 100
    const volumeMultiplier = 1 + blankableNumberToNumber(controls.volumePctChange) / 100
    const cacDeltaPerUnit = blankableNumberToNumber(controls.cacDeltaPerUnit)
    const shippingDeltaPerUnit = blankableNumberToNumber(controls.shippingDeltaPerUnit)
    const scrapRateDelta = blankableNumberToNumber(controls.scrapRateDeltaPctPoints) / 100

    const nextForecasts = forecasts.map((forecast) => ({
      ...forecast,
      customerAcquisitionCostPerUnit: Math.max(0, forecast.customerAcquisitionCostPerUnit + cacDeltaPerUnit),
      monthlyVolumeEstimate: forecast.monthlyVolumeEstimate.map((month) => ({
        ...month,
        units: Math.max(0, month.units * volumeMultiplier),
        price: Math.max(0, month.price * priceMultiplier),
      })),
    }))

    const nextCostEstimates = costEstimates.map((estimate) => ({
      ...estimate,
      fulfillmentCostPerUnit:
        estimate.fulfillmentCostPerUnit === null
          ? Math.max(0, shippingDeltaPerUnit)
          : Math.max(0, estimate.fulfillmentCostPerUnit + shippingDeltaPerUnit),
      scrapRate: Math.min(0.99, Math.max(0, estimate.scrapRate + scrapRateDelta)),
      bomParts: estimate.bomParts.map((part) => ({
        ...part,
        unitCost: Math.max(0, part.unitCost * cogsMultiplier),
      })),
    }))

    return {
      forecasts: nextForecasts,
      costEstimates: nextCostEstimates,
    }
  }, [controls, costEstimates, forecasts])

  const stressedRoi = useMemo(
    () => calculateRoiMetrics(stressedInputs.forecasts, stressedInputs.costEstimates),
    [stressedInputs]
  )
  const stressedUnitEconomics = useMemo(
    () => calculateUnitEconomics(stressedInputs.forecasts, stressedInputs.costEstimates),
    [stressedInputs]
  )

  if (!forecasts.length || !costEstimates.length) {
    return (
      <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-8 py-12 text-center">
        <h3 className="text-xl font-semibold text-slate-900">Stress testing needs both forecasts and costs</h3>
        <p className="mt-2 text-sm text-slate-500">
          Add at least one forecast and one cost estimate, then use this tab to pressure-test assumptions without changing saved data.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-950">Assumption stress test</h2>
        <p className="mt-2 text-sm text-slate-500">
          Run what-if scenarios by adjusting key unit economics inputs. These controls do not overwrite the underlying forecast or cost assumptions.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <Field label="COGS change (%)" hint="Example: 20 increases BOM unit costs by 20%.">
          <BlankNumberInput
            className="input-field"
            value={controls.cogsPctChange}
            step={0.1}
            onChange={(value) => setControls((current) => ({ ...current, cogsPctChange: value }))}
          />
        </Field>
        <Field label="CAC change ($/unit)" hint="Adds to customer acquisition cost per unit.">
          <BlankNumberInput
            className="input-field"
            value={controls.cacDeltaPerUnit}
            step={0.01}
            onChange={(value) => setControls((current) => ({ ...current, cacDeltaPerUnit: value }))}
          />
        </Field>
        <Field label="Fulfillment change ($/unit)" hint="Adds to the modeled fulfillment cost per shipped unit.">
          <BlankNumberInput
            className="input-field"
            value={controls.shippingDeltaPerUnit}
            step={0.01}
            onChange={(value) => setControls((current) => ({ ...current, shippingDeltaPerUnit: value }))}
          />
        </Field>
        <Field label="Quality cost change (scrap pts)" hint="Adjusts scrap rate by percentage points.">
          <BlankNumberInput
            className="input-field"
            value={controls.scrapRateDeltaPctPoints}
            step={0.1}
            onChange={(value) => setControls((current) => ({ ...current, scrapRateDeltaPctPoints: value }))}
          />
        </Field>
        <Field label="Average price change (%)" hint="Applies to forecast unit price.">
          <BlankNumberInput
            className="input-field"
            value={controls.averagePricePctChange}
            step={0.1}
            onChange={(value) => setControls((current) => ({ ...current, averagePricePctChange: value }))}
          />
        </Field>
        <Field label="Volume change (%)" hint="Applies to forecast units. Fixed monthly spend stays fixed.">
          <BlankNumberInput
            className="input-field"
            value={controls.volumePctChange}
            step={0.1}
            onChange={(value) => setControls((current) => ({ ...current, volumePctChange: value }))}
          />
        </Field>
      </div>

      <div className="flex justify-end">
        <button className="btn-secondary" onClick={() => setControls(INITIAL_CONTROLS)}>
          Reset scenario
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <TargetIrrCard
          title="10% IRR price target"
          changeLabel={priceTarget ? formatPercentDelta(priceTarget.changePct) : 'Not reached'}
          summary={
            priceTarget
              ? priceTarget.changePct >= 0
                ? `Blended price would need to rise to ${formatCurrency(Number(priceTarget.calculations.assumptions.averageSellingPrice ?? 0))} per unit.`
                : `Blended price could fall to ${formatCurrency(Number(priceTarget.calculations.assumptions.averageSellingPrice ?? 0))} per unit and still hold 10% IRR.`
              : '10% IRR is not reachable through price alone within the modeled search range.'
          }
          detail={
            priceTarget
              ? `Modeled IRR at that level: ${(priceTarget.calculations.irr * 100).toFixed(1)}%`
              : `Current IRR: ${(baselineRoi.irr * 100).toFixed(1)}%`
          }
        />
        <TargetIrrCard
          title="10% IRR volume target"
          changeLabel={volumeTarget ? formatPercentDelta(volumeTarget.changePct) : 'Not reached'}
          summary={
            volumeTarget
              ? volumeTarget.changePct >= 0
                ? `Forecast volume would need to rise to ${formatWholeNumber(Number(volumeTarget.calculations.assumptions.totalUnits ?? 0))} total units.`
                : `Forecast volume could fall to ${formatWholeNumber(Number(volumeTarget.calculations.assumptions.totalUnits ?? 0))} total units and still hold 10% IRR.`
              : '10% IRR is not reachable through volume alone with the saved unit economics.'
          }
          detail={
            volumeTarget
              ? `Modeled IRR at that level: ${(volumeTarget.calculations.irr * 100).toFixed(1)}%`
              : `Current IRR: ${(baselineRoi.irr * 100).toFixed(1)}%`
          }
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ScenarioCard
          title="Baseline"
          subtitle="Current saved assumptions"
          metrics={[
            { label: 'NPV', value: formatCurrency(baselineRoi.npv) },
            { label: 'IRR', value: `${(baselineRoi.irr * 100).toFixed(1)}%` },
            { label: 'Units forecasted', value: formatWholeNumber(Number(baselineRoi.assumptions.totalUnits ?? 0)) },
            { label: 'Profit / unit', value: formatCurrency(baselineRoi.profitPerUnit) },
            { label: 'Contribution / unit', value: formatCurrency(baselineRoi.contributionMarginPerUnit) },
            { label: 'Blended price / unit', value: formatCurrency(baselineUnitEconomics.averageSellingPrice) },
            { label: 'Scrap rate', value: `${(baselineUnitEconomics.scrapRate * 100).toFixed(1)}%` },
          ]}
        />
        <ScenarioCard
          title="Stress test"
          subtitle="Temporary what-if scenario"
          metrics={[
            { label: 'NPV', value: formatCurrency(stressedRoi.npv), delta: stressedRoi.npv - baselineRoi.npv },
            { label: 'IRR', value: `${(stressedRoi.irr * 100).toFixed(1)}%`, delta: stressedRoi.irr - baselineRoi.irr, percent: true },
            {
              label: 'Units forecasted',
              value: formatWholeNumber(Number(stressedRoi.assumptions.totalUnits ?? 0)),
              delta: Number(stressedRoi.assumptions.totalUnits ?? 0) - Number(baselineRoi.assumptions.totalUnits ?? 0),
              wholeNumber: true,
            },
            { label: 'Profit / unit', value: formatCurrency(stressedRoi.profitPerUnit), delta: stressedRoi.profitPerUnit - baselineRoi.profitPerUnit },
            {
              label: 'Contribution / unit',
              value: formatCurrency(stressedRoi.contributionMarginPerUnit),
              delta: stressedRoi.contributionMarginPerUnit - baselineRoi.contributionMarginPerUnit,
            },
            {
              label: 'Blended price / unit',
              value: formatCurrency(stressedUnitEconomics.averageSellingPrice),
              delta: stressedUnitEconomics.averageSellingPrice - baselineUnitEconomics.averageSellingPrice,
            },
            {
              label: 'Scrap rate',
              value: `${(stressedUnitEconomics.scrapRate * 100).toFixed(1)}%`,
              delta: stressedUnitEconomics.scrapRate - baselineUnitEconomics.scrapRate,
              percent: true,
            },
          ]}
        />
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</div>
      <div className="mt-2">{children}</div>
      <p className="mt-2 text-xs text-slate-500">{hint}</p>
    </div>
  )
}

function TargetIrrCard({ title, changeLabel, summary, detail }: { title: string; changeLabel: string; summary: string; detail: string }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">{title}</div>
      <div className="mt-2 text-3xl font-semibold text-slate-950">{changeLabel}</div>
      <p className="mt-3 text-sm text-slate-600">{summary}</p>
      <p className="mt-2 text-xs text-slate-500">{detail}</p>
    </div>
  )
}

function ScenarioCard({
  title,
  subtitle,
  metrics,
}: {
  title: string
  subtitle: string
  metrics: Array<{ label: string; value: string; delta?: number; percent?: boolean; wholeNumber?: boolean }>
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">{metric.label}</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">{metric.value}</div>
            {typeof metric.delta === 'number' && (
              <div className={`text-xs ${metric.delta <= 0 ? 'text-danger-600' : 'text-success-700'}`}>
                {metric.delta >= 0 ? '▲' : '▼'}{' '}
                {metric.percent
                  ? `${Math.abs(metric.delta * 100).toFixed(1)} pts`
                  : metric.wholeNumber
                    ? formatWholeNumber(Math.abs(metric.delta))
                    : formatCurrency(Math.abs(metric.delta))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatWholeNumber(value: number): string {
  return value.toLocaleString('en-US', {
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  })
}

function formatPercentDelta(value: number): string {
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${value.toFixed(1)}%`
}
