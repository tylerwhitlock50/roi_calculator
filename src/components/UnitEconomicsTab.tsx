'use client'

import React, { useMemo } from 'react'
import { ResponsiveContainer, Sankey } from 'recharts'

import type { CostEstimateRecord, ForecastRecord } from '@/lib/api'
import { calculateUnitEconomics, type UnitEconomicsBomPart, type UnitEconomicsBreakdown } from '@/lib/roi-calculations'

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
                  ? unitEconomics.profitPerUnit >= 0
                    ? 'Each branch shows how the blended selling price per unit is consumed by the current ROI model.'
                    : 'The flow still renders while underwater. A red funding-needed source shows how much cash has to be added per unit to cover the fully-loaded cost.'
                  : 'There is not enough modeled cost or margin data yet to render the revenue flow.'}
              </p>
            </div>
            {unitEconomics.usesOtherBomBucket && (
              <div className="text-xs text-slate-500">The chart groups smaller BOM items into “Other BOM items”.</div>
            )}
          </div>

          {unitEconomics.canRenderSankey ? (
            <div className="mt-4 h-[430px] w-full overflow-visible">
              <ResponsiveContainer width="100%" height="100%">
                <Sankey
                  data={unitEconomics.sankeyData}
                  node={SankeyNodeShape}
                  link={SankeyLinkShape}
                  nodePadding={24}
                  nodeWidth={18}
                  sort={false}
                  margin={{ top: 24, right: 200, bottom: 24, left: 120 }}
                />
              </ResponsiveContainer>
            </div>
          ) : (
            <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${marginTone}`}>
              Add more modeled unit costs or a saved ROI margin so the flow can be drawn here.
            </div>
          )}
        </div>

        <div className="space-y-6">
          <BreakdownCard
            title="Revenue allocation"
            subtitle="Percent of blended selling price per unit."
            items={unitEconomics.costStack}
          />

          <ProfitInvestmentMatrixCard profile={unitEconomics.profitInvestmentProfile} />

          <div className={`rounded-[24px] border px-5 py-5 text-sm ${marginTone}`}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em]">Margin callout</div>
            <div className="mt-2 text-3xl font-semibold">{formatCurrency(unitEconomics.profitPerUnit)}</div>
            <p className="mt-2">
              {unitEconomics.profitPerUnit >= 0
                ? `That is ${(unitEconomics.profitMarginPct * 100).toFixed(1)}% of the blended price per unit.`
                : `That means the owner is funding ${formatCurrency(Math.abs(unitEconomics.profitPerUnit))} per unit, or ${(Math.abs(unitEconomics.profitMarginPct) * 100).toFixed(1)}% of the blended price.`}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <BreakdownCard
          title="Cash-affecting BOM detail"
          subtitle="Shows unit cost, quantity per finished unit, and rolled-up BOM cost in the ROI model."
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
                    <div className="text-xs text-slate-500">
                      {isBomPart(item)
                        ? `${formatCurrency(item.unitCost)} each x ${formatQuantity(item.quantity)} = ${formatCurrency(item.value)} / unit`
                        : `${(item.pctOfRevenue * 100).toFixed(1)}% of price`}
                    </div>
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

function isBomPart(
  item: UnitEconomicsBreakdown['costStack'][number] | UnitEconomicsBreakdown['bomParts'][number]
): item is UnitEconomicsBomPart {
  return 'unitCost' in item && 'quantity' in item
}

function ProfitInvestmentMatrixCard({
  profile,
}: {
  profile: UnitEconomicsBreakdown['profitInvestmentProfile']
}) {
  const quadrantCopy = getQuadrantCopy(profile.quadrant)
  const pointLeft = `${Math.min(Math.max(profile.xPosition * 100, 3), 97)}%`
  const pointTop = `${Math.min(Math.max((1 - profile.yPosition) * 100, 3), 97)}%`

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Profit vs. investment</h3>
          <p className="mt-1 text-sm text-slate-500">
            Upfront tooling plus launch engineering are mapped against projected net income across the saved forecast horizon.
          </p>
        </div>
        <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
          {quadrantCopy.badge}
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          High profit impact
        </div>

        <div className="relative aspect-square rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#eef2ff_100%)] p-4">
          <div className="absolute inset-x-1/2 top-4 bottom-4 w-px -translate-x-1/2 bg-slate-300" />
          <div className="absolute inset-y-1/2 left-4 right-4 h-px -translate-y-1/2 bg-slate-300" />

          <QuadrantTile title="Scale" subtitle="Lean in" className="left-4 top-4 border-emerald-200 bg-emerald-50/90 text-emerald-900" />
          <QuadrantTile title="Premium" subtitle="High impact" className="right-4 top-4 border-sky-200 bg-sky-50/90 text-sky-900" />
          <QuadrantTile title="Accessory" subtitle="Visors, mounts" className="left-4 bottom-4 border-slate-200 bg-white/90 text-slate-700" />
          <QuadrantTile
            title="Concept / halo"
            subtitle="Marketing piece"
            className="right-4 bottom-4 border-amber-200 bg-amber-50/90 text-amber-900"
          />

          <div
            className="absolute z-10 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white bg-slate-950 shadow-[0_12px_24px_-12px_rgba(15,23,42,0.8)]"
            style={{ left: pointLeft, top: pointTop }}
            aria-hidden="true"
          />
        </div>

        <div className="mt-3 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          Low profit impact
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          <span>Low investment</span>
          <span>High investment</span>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
        <div className="text-sm font-semibold text-slate-900">{quadrantCopy.title}</div>
        <p className="mt-1 text-sm leading-6 text-slate-600">{quadrantCopy.body}</p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <MiniStat
          label="Projected net income"
          value={formatCurrency(profile.projectedNetIncome)}
          detail={
            profile.toolingCost > 0
              ? `${formatMultiple(profile.profitCoverageRatio)} of upfront investment recovered`
              : 'No upfront investment modeled'
          }
        />
        <MiniStat
          label="Upfront investment"
          value={formatCurrency(profile.toolingCost)}
          detail={`${(profile.investmentRatio * 100).toFixed(1)}% of projected revenue`}
        />
      </div>

      <p className="mt-4 text-xs leading-5 text-slate-500">
        The center lines split at upfront investment equal to 10% of projected revenue and projected net income equal to 1.0x investment.
      </p>
    </div>
  )
}

function QuadrantTile({
  title,
  subtitle,
  className,
}: {
  title: string
  subtitle: string
  className: string
}) {
  return (
    <div className={`absolute w-[calc(50%-1.25rem)] rounded-2xl border px-3 py-2 ${className}`}>
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-xs">{subtitle}</div>
    </div>
  )
}

function MiniStat({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-2 text-lg font-semibold text-slate-900">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{detail}</div>
    </div>
  )
}

function getQuadrantCopy(quadrant: UnitEconomicsBreakdown['profitInvestmentProfile']['quadrant']) {
  switch (quadrant) {
    case 'scale':
      return {
        badge: 'Scale product',
        title: 'Scale product',
        body: 'Low upfront tooling burden with net income that clears the investment. This is the profile to push harder through the channel.',
      }
    case 'premium':
      return {
        badge: 'Premium product',
        title: 'Premium product',
        body: 'This needs real upfront investment, but the modeled net income still pays it back. It fits a higher-commitment, high-impact launch.',
      }
    case 'concept-halo':
      return {
        badge: 'Concept / halo',
        title: 'Concept / halo',
        body: 'The model carries a heavier tooling burden without enough net income to repay it inside the saved forecast. Treat it more like a halo or marketing-led bet.',
      }
    case 'accessory':
    default:
      return {
        badge: 'Accessory / add-on',
        title: 'Accessory / add-on',
        body: 'The tooling burden is light, but the current forecast still does not create enough net income to stand out. This is closer to a small add-on play.',
      }
  }
}

function formatQuantity(value: number) {
  if (Number.isInteger(value)) {
    return value.toLocaleString()
  }

  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
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

function formatMultiple(value: number) {
  return `${value.toFixed(1)}x`
}
