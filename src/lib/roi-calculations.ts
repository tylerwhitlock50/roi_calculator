import type { CostEstimateRecord, ForecastRecord } from '@/lib/api'

type CashFlow = {
  month: string
  total: number
  sales: number
  marketing: number
  cac: number
  costOfSales: number
  labor: number
  overhead: number
  support: number
  tooling: number
}

type CashFlowTotals = Omit<CashFlow, 'month'>

type RoiCalculations = {
  cashFlows: CashFlow[]
  totals: CashFlowTotals
  roiPct: number
  npv: number
  irr: number
  breakEvenMonth: number
  paybackPeriod: number
  contributionMarginPerUnit: number
  profitPerUnit: number
  assumptions: Record<string, unknown>
}

type ForecastSalesSummary = {
  salesByMonth: Record<string, { units: number; sales: number }>
  months: string[]
  totalUnits: number
  totalRevenue: number
  averagePrice: number
}

export type UnitEconomicsSegment = {
  label: string
  value: number
  color: string
  pctOfRevenue: number
}

export type UnitEconomicsBomPart = UnitEconomicsSegment & {
  unitCost: number
  quantity: number
}

export type ProfitInvestmentQuadrant = 'scale' | 'premium' | 'concept-halo' | 'accessory'

export type ProfitInvestmentProfile = {
  toolingCost: number
  projectedRevenue: number
  projectedNetIncome: number
  investmentRatio: number
  profitCoverageRatio: number
  xPosition: number
  yPosition: number
  highInvestment: boolean
  highProfit: boolean
  quadrant: ProfitInvestmentQuadrant
}

export type UnitEconomicsNode = {
  name: string
  color: string
  kind: 'source' | 'aggregate' | 'cost' | 'profit'
}

export type UnitEconomicsLink = {
  source: number
  target: number
  value: number
  color: string
}

export type UnitEconomicsBreakdown = {
  totalUnits: number
  totalRevenue: number
  monthsCount: number
  averageSellingPrice: number
  bomCostPerUnit: number
  allocatedMarketingPerUnit: number
  customerAcquisitionPerUnit: number
  overheadPerUnit: number
  supportPerUnit: number
  laborPerUnit: number
  toolingPerUnit: number
  upfrontCostPerUnit: number
  contributionMarginPerUnit: number
  profitPerUnit: number
  profitMarginPct: number
  recurringCostPerUnit: number
  bomParts: UnitEconomicsBomPart[]
  costStack: UnitEconomicsSegment[]
  profitInvestmentProfile: ProfitInvestmentProfile
  sankeyData: {
    nodes: UnitEconomicsNode[]
    links: UnitEconomicsLink[]
  }
  usesOtherBomBucket: boolean
  canRenderSankey: boolean
  note: string
}

const BOM_PART_COLORS = ['#f59e0b', '#fb923c', '#f97316', '#facc15', '#fbbf24', '#fdba74']
const COST_COLORS = {
  bom: '#f59e0b',
  marketing: '#0ea5e9',
  acquisition: '#06b6d4',
  overhead: '#6366f1',
  support: '#8b5cf6',
  labor: '#64748b',
  tooling: '#94a3b8',
  profit: '#16a34a',
  loss: '#dc2626',
} as const

const NEGATIVE_MARGIN_LABEL = 'Funding needed'
const INVESTMENT_THRESHOLD_RATIO = 0.1
const INVESTMENT_AXIS_MAX_RATIO = 0.2
const PROFIT_COVERAGE_THRESHOLD = 1
const PROFIT_COVERAGE_AXIS_MAX = 2

export function calculateLaborHours(laborEntries: CostEstimateRecord['laborEntries']): number {
  return laborEntries.reduce((sum, entry) => sum + entry.hours + entry.minutes / 60 + entry.seconds / 3600, 0)
}

export function calculateLaborCost(laborEntries: CostEstimateRecord['laborEntries']): number {
  return laborEntries.reduce((sum, entry) => {
    const hours = entry.hours + entry.minutes / 60 + entry.seconds / 3600
    return sum + hours * entry.activity.ratePerHour
  }, 0)
}

export function calculateEngineeringLaunchCost(
  estimate?: Pick<CostEstimateRecord, 'engineeringHours' | 'engineeringRatePerHour'>
): number {
  if (!estimate) {
    return 0
  }

  const engineeringHours = Number.isFinite(estimate.engineeringHours) ? estimate.engineeringHours : 0
  const engineeringRatePerHour = Number.isFinite(estimate.engineeringRatePerHour) ? estimate.engineeringRatePerHour : 125

  return engineeringHours * engineeringRatePerHour
}

function summarizeForecastSales(forecasts: ForecastRecord[]): ForecastSalesSummary {
  const salesByMonth: Record<string, { units: number; sales: number }> = {}

  for (const forecast of forecasts) {
    for (const month of forecast.monthlyVolumeEstimate) {
      if (!month.month_date || month.units <= 0 || month.price <= 0) {
        continue
      }

      if (!salesByMonth[month.month_date]) {
        salesByMonth[month.month_date] = { units: 0, sales: 0 }
      }

      salesByMonth[month.month_date].units += month.units
      salesByMonth[month.month_date].sales += month.units * month.price
    }
  }

  const months = Object.keys(salesByMonth).sort()
  const totals = Object.values(salesByMonth).reduce(
    (summary, month) => {
      summary.totalUnits += month.units
      summary.totalRevenue += month.sales
      return summary
    },
    { totalUnits: 0, totalRevenue: 0 }
  )

  return {
    salesByMonth,
    months,
    totalUnits: totals.totalUnits,
    totalRevenue: totals.totalRevenue,
    averagePrice: totals.totalUnits > 0 ? totals.totalRevenue / totals.totalUnits : 0,
  }
}

function buildSankeyData({
  bomParts,
  bomCostPerUnit,
  allocatedMarketingPerUnit,
  customerAcquisitionPerUnit,
  overheadPerUnit,
  supportPerUnit,
  laborPerUnit,
  toolingPerUnit,
  profitPerUnit,
}: {
  bomParts: UnitEconomicsSegment[]
  bomCostPerUnit: number
  allocatedMarketingPerUnit: number
  customerAcquisitionPerUnit: number
  overheadPerUnit: number
  supportPerUnit: number
  laborPerUnit: number
  toolingPerUnit: number
  profitPerUnit: number
}): UnitEconomicsBreakdown['sankeyData'] {
  const nodes: UnitEconomicsNode[] = [{ name: 'Revenue / unit', color: '#0f172a', kind: 'source' }]
  const links: UnitEconomicsLink[] = []

  const addNode = (name: string, color: string, kind: UnitEconomicsNode['kind']) => {
    nodes.push({ name, color, kind })
    return nodes.length - 1
  }

  const revenueIndex = 0
  const expenseTotal =
    bomCostPerUnit +
    allocatedMarketingPerUnit +
    customerAcquisitionPerUnit +
    overheadPerUnit +
    supportPerUnit +
    laborPerUnit +
    toolingPerUnit
  const lossPerUnit = profitPerUnit < 0 ? Math.abs(profitPerUnit) : 0
  const coverageBase = lossPerUnit > 0 ? expenseTotal : expenseTotal + Math.max(profitPerUnit, 0)
  const revenueCoverageRatio = coverageBase > 0 ? Math.min(1, Math.max(0, (coverageBase - lossPerUnit) / coverageBase)) : 0
  const lossIndex = lossPerUnit > 0 ? addNode('Funding needed / unit', COST_COLORS.loss, 'source') : null
  const addCoveredLink = (target: number, totalValue: number, color: string) => {
    if (totalValue <= 0) {
      return
    }

    if (lossIndex === null) {
      links.push({ source: revenueIndex, target, value: totalValue, color })
      return
    }

    const revenueCoveredValue = totalValue * revenueCoverageRatio
    const lossCoveredValue = totalValue - revenueCoveredValue

    if (revenueCoveredValue > 0) {
      links.push({ source: revenueIndex, target, value: revenueCoveredValue, color })
    }

    if (lossCoveredValue > 0) {
      links.push({ source: lossIndex, target, value: lossCoveredValue, color: COST_COLORS.loss })
    }
  }

  if (bomCostPerUnit > 0) {
    const bomIndex = addNode('Cash BOM', COST_COLORS.bom, 'aggregate')
    addCoveredLink(bomIndex, bomCostPerUnit, COST_COLORS.bom)

    for (const part of bomParts) {
      const partIndex = addNode(part.label, part.color, 'cost')
      links.push({ source: bomIndex, target: partIndex, value: part.value, color: part.color })
    }
  }

  const directBranches = [
    { label: 'Marketing', value: allocatedMarketingPerUnit, color: COST_COLORS.marketing, kind: 'cost' as const },
    { label: 'CAC', value: customerAcquisitionPerUnit, color: COST_COLORS.acquisition, kind: 'cost' as const },
    { label: 'Overhead', value: overheadPerUnit, color: COST_COLORS.overhead, kind: 'cost' as const },
    { label: 'Support', value: supportPerUnit, color: COST_COLORS.support, kind: 'cost' as const },
    { label: 'Direct labor', value: laborPerUnit, color: COST_COLORS.labor, kind: 'cost' as const },
    { label: 'Tooling + launch', value: toolingPerUnit, color: COST_COLORS.tooling, kind: 'cost' as const },
    { label: 'Profit', value: profitPerUnit, color: COST_COLORS.profit, kind: 'profit' as const },
  ]

  for (const branch of directBranches) {
    if (branch.value <= 0) {
      continue
    }

    const branchIndex = addNode(branch.label, branch.color, branch.kind)
    addCoveredLink(branchIndex, branch.value, branch.color)
  }

  return { nodes, links }
}

export function calculateProfitInvestmentProfile({
  toolingCost,
  projectedRevenue,
  projectedNetIncome,
}: {
  toolingCost: number
  projectedRevenue: number
  projectedNetIncome: number
}): ProfitInvestmentProfile {
  const investmentRatio = projectedRevenue > 0 ? toolingCost / projectedRevenue : toolingCost > 0 ? 1 : 0
  const profitCoverageRatio = toolingCost > 0 ? projectedNetIncome / toolingCost : projectedNetIncome > 0 ? PROFIT_COVERAGE_AXIS_MAX : 0
  const highInvestment = investmentRatio >= INVESTMENT_THRESHOLD_RATIO
  const highProfit = toolingCost > 0 ? profitCoverageRatio >= PROFIT_COVERAGE_THRESHOLD : projectedNetIncome > 0
  const quadrant: ProfitInvestmentQuadrant = highInvestment
    ? highProfit
      ? 'premium'
      : 'concept-halo'
    : highProfit
      ? 'scale'
      : 'accessory'

  return {
    toolingCost,
    projectedRevenue,
    projectedNetIncome,
    investmentRatio,
    profitCoverageRatio,
    xPosition: Math.max(0, Math.min(1, investmentRatio / INVESTMENT_AXIS_MAX_RATIO)),
    yPosition: Math.max(0, Math.min(1, profitCoverageRatio / PROFIT_COVERAGE_AXIS_MAX)),
    highInvestment,
    highProfit,
    quadrant,
  }
}

function buildUnitEconomicsFromSummary(
  salesSummary: ForecastSalesSummary,
  estimate?: CostEstimateRecord
): UnitEconomicsBreakdown {
  const bomParts = estimate
    ? estimate.bomParts
        .filter((part) => part.cashEffect)
        .map((part, index) => ({
          label: part.item,
          value: part.unitCost * part.quantity,
          color: BOM_PART_COLORS[index % BOM_PART_COLORS.length],
          unitCost: part.unitCost,
          quantity: part.quantity,
        }))
        .sort((left, right) => right.value - left.value)
    : []
  const bomCostPerUnit = bomParts.reduce((sum, part) => sum + part.value, 0)
  const totalLaborHours = estimate ? calculateLaborHours(estimate.laborEntries) : 0
  const totalLaborCost = estimate ? calculateLaborCost(estimate.laborEntries) : 0
  const engineeringLaunchCost = calculateEngineeringLaunchCost(estimate)
  const upfrontToolingCost = (estimate?.toolingCost ?? 0) + engineeringLaunchCost
  const laborPerUnit = totalLaborCost
  const overheadPerUnit = totalLaborHours * (estimate?.overheadRate ?? 0)
  const supportPerUnit = (estimate?.supportTimePct ?? 0) * (laborPerUnit + overheadPerUnit)
  const customerAcquisitionPerUnit = estimate?.ppcBudget ?? 0
  const allocatedMarketingPerUnit =
    (salesSummary.totalUnits > 0 ? ((estimate?.marketingBudget ?? 0) * salesSummary.months.length) / salesSummary.totalUnits : 0) +
    (estimate?.marketingCostPerUnit ?? 0)
  const toolingPerUnit = salesSummary.totalUnits > 0 ? upfrontToolingCost / salesSummary.totalUnits : 0
  const upfrontCostPerUnit = toolingPerUnit
  const recurringCostPerUnit =
    bomCostPerUnit + allocatedMarketingPerUnit + customerAcquisitionPerUnit + laborPerUnit + overheadPerUnit + supportPerUnit
  const contributionMarginPerUnit = salesSummary.averagePrice - recurringCostPerUnit
  const profitPerUnit = contributionMarginPerUnit - upfrontCostPerUnit
  const profitMarginPct = salesSummary.averagePrice > 0 ? profitPerUnit / salesSummary.averagePrice : 0
  const projectedNetIncome = profitPerUnit * salesSummary.totalUnits
  const costStack: UnitEconomicsSegment[] = [
    { label: 'Cash BOM', value: bomCostPerUnit, color: COST_COLORS.bom, pctOfRevenue: 0 },
    { label: 'Marketing', value: allocatedMarketingPerUnit, color: COST_COLORS.marketing, pctOfRevenue: 0 },
    { label: 'CAC', value: customerAcquisitionPerUnit, color: COST_COLORS.acquisition, pctOfRevenue: 0 },
    { label: 'Direct labor / unit', value: laborPerUnit, color: COST_COLORS.labor, pctOfRevenue: 0 },
    { label: 'Overhead', value: overheadPerUnit, color: COST_COLORS.overhead, pctOfRevenue: 0 },
    { label: 'Support', value: supportPerUnit, color: COST_COLORS.support, pctOfRevenue: 0 },
    { label: 'Tooling + launch / unit', value: toolingPerUnit, color: COST_COLORS.tooling, pctOfRevenue: 0 },
    {
      label: profitPerUnit >= 0 ? 'Profit' : NEGATIVE_MARGIN_LABEL,
      value: Math.abs(profitPerUnit),
      color: profitPerUnit >= 0 ? COST_COLORS.profit : COST_COLORS.loss,
      pctOfRevenue: 0,
    },
  ]
    .filter((segment) => segment.value > 0)
    .map((segment) => ({
      ...segment,
      pctOfRevenue: salesSummary.averagePrice > 0 ? segment.value / salesSummary.averagePrice : 0,
    }))

  const sankeyBomParts =
    bomParts.length > 6
      ? [
          ...bomParts.slice(0, 5),
          {
            label: 'Other BOM items',
            value: bomParts.slice(5).reduce((sum, part) => sum + part.value, 0),
            color: BOM_PART_COLORS[5],
          },
        ]
      : bomParts

  const detailedBomParts = bomParts.map((part) => ({
    label: part.label,
    value: part.value,
    color: part.color,
    pctOfRevenue: salesSummary.averagePrice > 0 ? part.value / salesSummary.averagePrice : 0,
    unitCost: part.unitCost,
    quantity: part.quantity,
  }))

  return {
    totalUnits: salesSummary.totalUnits,
    totalRevenue: salesSummary.totalRevenue,
    monthsCount: salesSummary.months.length,
    averageSellingPrice: salesSummary.averagePrice,
    bomCostPerUnit,
    allocatedMarketingPerUnit,
    customerAcquisitionPerUnit,
    overheadPerUnit,
    supportPerUnit,
    laborPerUnit,
    toolingPerUnit,
    upfrontCostPerUnit,
    contributionMarginPerUnit,
    profitPerUnit,
    profitMarginPct,
    recurringCostPerUnit,
    bomParts: detailedBomParts,
    costStack,
    profitInvestmentProfile: calculateProfitInvestmentProfile({
      toolingCost: upfrontToolingCost,
      projectedRevenue: salesSummary.totalRevenue,
      projectedNetIncome,
    }),
    sankeyData: buildSankeyData({
      bomParts: sankeyBomParts.map((part) => ({
        ...part,
        pctOfRevenue: salesSummary.averagePrice > 0 ? part.value / salesSummary.averagePrice : 0,
      })),
      bomCostPerUnit,
      allocatedMarketingPerUnit,
      customerAcquisitionPerUnit,
      overheadPerUnit,
      supportPerUnit,
      laborPerUnit,
      toolingPerUnit,
      profitPerUnit,
    }),
    usesOtherBomBucket: bomParts.length > 6,
    canRenderSankey: salesSummary.averagePrice > 0 && (recurringCostPerUnit > 0 || upfrontCostPerUnit > 0 || profitPerUnit !== 0),
    note:
      'Selling price is the weighted average across saved forecast rows. Marketing blends fixed monthly spend plus any per-unit marketing cost. Labor entries are treated as direct labor per unit, while overhead and support scale from the modeled labor time. Engineering launch hours are monetized and rolled into upfront tooling. When the unit is underwater, the Sankey adds a funding-needed source so the shortfall still maps across the cost buckets.',
  }
}

export function calculateTotalEstimateCost(estimate: CostEstimateRecord): number {
  const bom = estimate.bomParts.reduce((sum, part) => sum + part.unitCost * part.quantity, 0)
  const labor = calculateLaborCost(estimate.laborEntries)
  const engineeringLaunchCost = calculateEngineeringLaunchCost(estimate)
  return estimate.toolingCost + engineeringLaunchCost + estimate.marketingBudget + estimate.ppcBudget + bom + labor
}

export function calculateUnitEconomics(
  forecasts: ForecastRecord[],
  costEstimates: CostEstimateRecord[]
): UnitEconomicsBreakdown {
  const salesSummary = summarizeForecastSales(forecasts)
  const estimate = costEstimates[0]

  return buildUnitEconomicsFromSummary(salesSummary, estimate)
}

export function calculateRoiMetrics(forecasts: ForecastRecord[], costEstimates: CostEstimateRecord[]): RoiCalculations {
  const salesSummary = summarizeForecastSales(forecasts)
  const { salesByMonth, months } = salesSummary
  const estimate = costEstimates[0]
  const unitEconomics = buildUnitEconomicsFromSummary(salesSummary, estimate)
  const bomUnitCost = estimate
    ? estimate.bomParts.filter((part) => part.cashEffect).reduce((sum, part) => sum + part.unitCost * part.quantity, 0)
    : 0
  const laborHoursPerUnit = estimate ? calculateLaborHours(estimate.laborEntries) : 0
  const totalLaborCost = estimate ? calculateLaborCost(estimate.laborEntries) : 0
  const upfrontToolingCost = estimate?.toolingCost ?? 0
  const upfrontEngineeringCost = calculateEngineeringLaunchCost(estimate)
  const laborCostPerUnit = totalLaborCost
  const upfrontCost = upfrontToolingCost + upfrontEngineeringCost
  const overheadRate = estimate?.overheadRate ?? 60
  const supportPct = estimate?.supportTimePct ?? 0.2
  const marketingPerMonth = estimate?.marketingBudget ?? 0
  const acquisitionCostPerUnit = estimate?.ppcBudget ?? 0
  const marketingCostPerUnit = estimate?.marketingCostPerUnit ?? 0
  const overheadPerUnit = laborHoursPerUnit * overheadRate
  const supportPerUnit = supportPct * (laborCostPerUnit + overheadPerUnit)

  const cashFlows: CashFlow[] = [
    {
      month: 'Month 0 (Upfront)',
      total: -upfrontCost,
      sales: 0,
      marketing: 0,
      cac: 0,
      costOfSales: 0,
      labor: 0,
      overhead: 0,
      support: 0,
      tooling: -upfrontCost,
    },
  ]

  for (const month of months) {
    const sales = salesByMonth[month].sales
    const units = salesByMonth[month].units
    const costOfSales = -(bomUnitCost * units)
    const marketing = -(marketingPerMonth + marketingCostPerUnit * units)
    const cac = -(acquisitionCostPerUnit * units)
    const labor = -(laborCostPerUnit * units)
    const overhead = -(overheadPerUnit * units)
    const support = -(supportPerUnit * units)
    const total = sales + marketing + cac + costOfSales + labor + overhead + support

    cashFlows.push({
      month,
      total,
      sales,
      marketing,
      cac,
      costOfSales,
      labor,
      overhead,
      support,
      tooling: 0,
    })
  }

  const discountRate = 0.1 / 12
  const npv = cashFlows.reduce((sum, flow, index) => sum + flow.total / Math.pow(1 + discountRate, index), 0)
  const totals = cashFlows.reduce<CashFlowTotals>(
    (summary, flow) => ({
      total: summary.total + flow.total,
      sales: summary.sales + flow.sales,
      marketing: summary.marketing + flow.marketing,
      cac: summary.cac + flow.cac,
      costOfSales: summary.costOfSales + flow.costOfSales,
      labor: summary.labor + flow.labor,
      overhead: summary.overhead + flow.overhead,
      support: summary.support + flow.support,
      tooling: summary.tooling + flow.tooling,
    }),
    {
      total: 0,
      sales: 0,
      marketing: 0,
      cac: 0,
      costOfSales: 0,
      labor: 0,
      overhead: 0,
      support: 0,
      tooling: 0,
    }
  )
  const totalOutflows = Math.abs(
    totals.marketing +
      totals.cac +
      totals.costOfSales +
      totals.labor +
      totals.overhead +
      totals.support +
      totals.tooling
  )
  const roiPct = totalOutflows > 0 ? totals.total / totalOutflows : 0

  const calcIrr = (values: number[]) => {
    let guess = 0.1
    for (let iteration = 0; iteration < 100; iteration += 1) {
      let f = 0
      let derivative = 0
      for (let index = 0; index < values.length; index += 1) {
        f += values[index] / Math.pow(1 + guess, index)
        derivative += (-index * values[index]) / Math.pow(1 + guess, index + 1)
      }
      const nextGuess = guess - f / derivative
      if (Math.abs(nextGuess - guess) < 0.000001) {
        return nextGuess
      }
      guess = nextGuess
    }
    return guess
  }

  const irr = cashFlows.length > 1 ? Math.min(calcIrr(cashFlows.map((flow) => flow.total)), 3) : 0

  let cumulative = 0
  let breakEvenMonth = 0
  let paybackPeriod = 0

  for (let index = 0; index < cashFlows.length; index += 1) {
    cumulative += cashFlows[index].total
    if (cumulative >= 0) {
      breakEvenMonth = index
      paybackPeriod = index / 12
      break
    }
  }

  const assumptions = {
    upfrontCost,
    upfrontToolingCost,
    upfrontEngineeringCost,
    averageSellingPrice: Number(unitEconomics.averageSellingPrice.toFixed(2)),
    totalUnits: salesSummary.totalUnits,
    recurringCostPerUnit: Number(unitEconomics.recurringCostPerUnit.toFixed(2)),
    upfrontCostPerUnit: Number(unitEconomics.upfrontCostPerUnit.toFixed(2)),
    allocatedMarketingPerUnit: Number(unitEconomics.allocatedMarketingPerUnit.toFixed(2)),
    profitMarginPct: Number(unitEconomics.profitMarginPct.toFixed(4)),
    discountRateAnnual: 0.1,
    note: 'Tooling plus launch engineering are treated as the upfront outflow. Labor entries are modeled as direct labor per unit; overhead and support are derived from the modeled labor time.',
    months,
  }

  return {
    cashFlows,
    totals,
    roiPct,
    npv,
    irr,
    breakEvenMonth,
    paybackPeriod,
    contributionMarginPerUnit: unitEconomics.contributionMarginPerUnit,
    profitPerUnit: unitEconomics.profitPerUnit,
    assumptions,
  }
}
