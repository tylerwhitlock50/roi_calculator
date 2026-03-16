'use client'

import React, { useMemo } from 'react'
import { ResponsiveContainer, Sankey } from 'recharts'

import type { CostEstimateRecord, ForecastRecord } from '@/lib/api'
import { calculateUnitEconomics, type UnitEconomicsBreakdown } from '@/lib/roi-calculations'

type UnitEconomicsTabProps = {
  forecasts: ForecastRecord[]
  costEstimates: CostEstimateRecord[]
}

type SankeyNodeShapeProps = {
  x?: number
  y?: number
  width?: number
  height?: number
  payload?: {
    name?: string
    color?: string
    sourceLinks?: unknown[]
    targetLinks?: unknown[]
    value?: number
  }
}

type SankeyLinkShapeProps = {
  sourceX?: number
  sourceY?: number
  sourceControlX?: number
  targetX?: number
  targetY?: number
  targetControlX?: number
  linkWidth?: number
  payload?: {
    color?: string
    target?: {
      name?: string
    }
  }
}

export default function UnitEconomicsTab({ forecasts, costEstimates }: UnitEconomicsTabProps) {
  const unitEconomics = useMemo(() => calculateUnitEconomics(forecasts, costEstimates), [costEstimates, forecasts])

  if (!forecasts.length || !costEstimates.length) {
    return (
      <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-8 py-12 text-center">
        <h3 className="text-xl font-semibold text-slate-900">Unit economics need both forecasts and costs</h3>
        <p className="mt-2 text-sm text-slate-500">
          Add at least one sales forecast and one cost estimate, then this tab will visualize how price turns into cost buckets and profit.
        </p>
      </div>
    )
  }

  if (unitEconomics.totalUnits === 0 || unitEconomics.averageSellingPrice <= 0) {
    return (
      <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-8 py-12 text-center">
        <h3 className="text-xl font-semibold text-slate-900">No usable forecast rows yet</h3>
        <p className="mt-2 text-sm text-slate-500">
          Enter forecast months with positive units and selling price so the blended unit economics can be calculated.
        </p>
      </div>
    )
  }

  const marginTone =
    unitEconomics.profitPerUnit >= 0
      ? 'border-success-200 bg-success-50 text-success-700'
      : 'border-danger-200 bg-danger-50 text-danger-700'

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-950">Unit economics story</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">
            This view blends the saved forecast price and latest cost model into a per-unit picture of where each dollar goes.
          </p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-600">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Model basis</div>
          <div className="mt-2 font-semibold text-slate-900">{unitEconomics.totalUnits.toLocaleString()} units</div>
          <div>{unitEconomics.monthsCount} active forecast months</div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Blended price / unit" value={formatCurrency(unitEconomics.averageSellingPrice)} />
        <MetricCard label="Recurring contribution" value={formatCurrency(unitEconomics.contributionMarginPerUnit)} />
        <MetricCard label="Upfront cost / unit" value={formatCurrency(unitEconomics.upfrontCostPerUnit)} />
        <MetricCard label="Profit / unit" value={formatCurrency(unitEconomics.profitPerUnit)} highlight={unitEconomics.profitPerUnit >= 0} />
        <MetricCard
          label="Profit margin"
          value={`${(unitEconomics.profitMarginPct * 100).toFixed(1)}%`}
          highlight={unitEconomics.profitMarginPct >= 0}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.95fr)]">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Revenue flow</h3>
              <p className="mt-1 text-sm text-slate-500">
                {unitEconomics.canRenderSankey
                  ? 'Each branch shows how the blended selling price per unit is consumed by the current ROI model.'
                  : 'The fully-loaded unit model is currently underwater, so the breakdown is shown in list form instead of a Sankey.'}
              </p>
            </div>
            {unitEconomics.usesOtherBomBucket && (
              <div className="text-xs text-slate-500">The chart groups smaller BOM items into “Other BOM items”.</div>
            )}
          </div>

          {unitEconomics.canRenderSankey ? (
            <div className="mt-4 h-[430px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <Sankey
                  data={unitEconomics.sankeyData}
                  node={SankeyNodeShape}
                  link={SankeyLinkShape}
                  nodePadding={24}
                  nodeWidth={18}
                  sort={false}
                  margin={{ top: 24, right: 160, bottom: 24, left: 24 }}
                />
              </ResponsiveContainer>
            </div>
          ) : (
            <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${marginTone}`}>
              Fully-loaded profit is {formatCurrency(unitEconomics.profitPerUnit)} per unit. The right-hand breakdown still shows what is driving the shortfall.
            </div>
          )}
        </div>

        <div className="space-y-6">
          <BreakdownCard
            title="Revenue allocation"
            subtitle="Percent of blended selling price per unit."
            items={unitEconomics.costStack}
          />

          <div className={`rounded-[24px] border px-5 py-5 text-sm ${marginTone}`}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em]">Margin callout</div>
            <div className="mt-2 text-3xl font-semibold">{formatCurrency(unitEconomics.profitPerUnit)}</div>
            <p className="mt-2">
              {unitEconomics.profitPerUnit >= 0
                ? `That is ${(unitEconomics.profitMarginPct * 100).toFixed(1)}% of the blended price per unit.`
                : `That is a ${(Math.abs(unitEconomics.profitMarginPct) * 100).toFixed(1)}% loss versus the blended price per unit.`}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <BreakdownCard
          title="Cash-affecting BOM detail"
          subtitle="Per-unit BOM cost included in the ROI model."
          items={unitEconomics.bomParts}
          emptyMessage="No BOM parts are currently marked as cash-affecting."
        />

        <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Model notes</div>
          <p className="mt-3 leading-6">{unitEconomics.note}</p>
          <p className="mt-3 leading-6">
            Dealer or channel margin is not modeled as a separate input today. If you already net that out in the forecast price, this chart reflects it implicitly.
          </p>
          <p className="mt-3 leading-6">
            Overhead and support are derived from the modeled labor time and the saved support allocation percentage.
          </p>
        </div>
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded-2xl border px-4 py-4 ${
        highlight ? 'border-success-200 bg-success-50' : 'border-slate-200 bg-slate-50'
      }`}
    >
      <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">{label}</div>
      <div className="mt-2 text-lg font-semibold text-slate-900">{value}</div>
    </div>
  )
}

function BreakdownCard({
  title,
  subtitle,
  items,
  emptyMessage = 'No items to show.',
}: {
  title: string
  subtitle: string
  items: UnitEconomicsBreakdown['costStack'] | UnitEconomicsBreakdown['bomParts']
  emptyMessage?: string
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>

      {items.length === 0 ? (
        <p className="mt-5 text-sm text-slate-500">{emptyMessage}</p>
      ) : (
        <div className="mt-5 space-y-4">
          {items.map((item) => {
            const width = Math.max(Math.min(item.pctOfRevenue * 100, 100), item.value > 0 ? 4 : 0)

            return (
              <div key={item.label}>
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-900">{item.label}</div>
                    <div className="text-xs text-slate-500">{(item.pctOfRevenue * 100).toFixed(1)}% of price</div>
                  </div>
                  <div className="shrink-0 text-sm font-semibold text-slate-900">{formatCurrency(item.value)}</div>
                </div>
                <div className="mt-2 h-2.5 rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${width}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SankeyNodeShape({ x = 0, y = 0, width = 0, height = 0, payload }: SankeyNodeShapeProps) {
  const label = payload?.name ?? ''
  const value = typeof payload?.value === 'number' ? payload.value : 0
  const isTerminal = (payload?.sourceLinks?.length ?? 0) === 0
  const labelX = isTerminal ? x - 10 : x + width + 10
  const textAnchor = isTerminal ? 'end' : 'start'
  const fill = payload?.color ?? '#94a3b8'

  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={6} fill={fill} fillOpacity={0.92} />
      <text x={labelX} y={y + height / 2 - 4} textAnchor={textAnchor} fontSize={12} fontWeight={600} fill="#0f172a">
        {label}
      </text>
      <text x={labelX} y={y + height / 2 + 12} textAnchor={textAnchor} fontSize={12} fill="#64748b">
        {formatCurrency(value)}
      </text>
    </g>
  )
}

function SankeyLinkShape({
  sourceX = 0,
  sourceY = 0,
  sourceControlX = 0,
  targetX = 0,
  targetY = 0,
  targetControlX = 0,
  linkWidth = 0,
  payload,
}: SankeyLinkShapeProps) {
  const stroke = payload?.color ?? '#94a3b8'
  const isProfit = payload?.target?.name === 'Profit'

  return (
    <path
      d={`M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
      fill="none"
      stroke={stroke}
      strokeOpacity={isProfit ? 0.72 : 0.34}
      strokeWidth={Math.max(linkWidth, 1)}
    />
  )
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}
