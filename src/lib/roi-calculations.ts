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

type RoiCalculations = {
  cashFlows: CashFlow[]
  npv: number
  irr: number
  breakEvenMonth: number
  paybackPeriod: number
  contributionMarginPerUnit: number
  profitPerUnit: number
  assumptions: Record<string, unknown>
}

export function calculateLaborHours(laborEntries: CostEstimateRecord['laborEntries']): number {
  return laborEntries.reduce((sum, entry) => sum + entry.hours + entry.minutes / 60 + entry.seconds / 3600, 0)
}

export function calculateLaborCost(laborEntries: CostEstimateRecord['laborEntries']): number {
  return laborEntries.reduce((sum, entry) => {
    const hours = entry.hours + entry.minutes / 60 + entry.seconds / 3600
    return sum + hours * entry.activity.ratePerHour
  }, 0)
}

export function calculateTotalEstimateCost(estimate: CostEstimateRecord): number {
  const bom = estimate.bomParts.reduce((sum, part) => sum + part.unitCost * part.quantity, 0)
  const labor = calculateLaborCost(estimate.laborEntries)
  return estimate.toolingCost + estimate.marketingBudget + estimate.ppcBudget + bom + labor
}

export function calculateRoiMetrics(forecasts: ForecastRecord[], costEstimates: CostEstimateRecord[]): RoiCalculations {
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
  const estimate = costEstimates[0]
  const bomUnitCost = estimate
    ? estimate.bomParts.filter((part) => part.cashEffect).reduce((sum, part) => sum + part.unitCost * part.quantity, 0)
    : 0
  const totalLaborCost = estimate ? calculateLaborCost(estimate.laborEntries) : 0
  const upfrontToolingCost = estimate?.toolingCost ?? 0
  const upfrontLaborCost = totalLaborCost
  const upfrontCost = upfrontToolingCost + upfrontLaborCost
  const overheadRate = estimate?.overheadRate ?? 60
  const supportPct = estimate?.supportTimePct ?? 0.2
  const marketingPerMonth = estimate?.marketingBudget ?? 0
  const acquisitionCostPerUnit = estimate?.ppcBudget ?? 0
  const marketingCostPerUnit = estimate?.marketingCostPerUnit ?? 0

  const cashFlows: CashFlow[] = [
    {
      month: 'Month 0 (Upfront)',
      total: -upfrontCost,
      sales: 0,
      marketing: 0,
      cac: 0,
      costOfSales: 0,
      labor: -upfrontLaborCost,
      overhead: 0,
      support: 0,
      tooling: -upfrontToolingCost,
    },
  ]

  for (const month of months) {
    const sales = salesByMonth[month].sales
    const units = salesByMonth[month].units
    const costOfSales = bomUnitCost * units
    const marketing = marketingPerMonth
    const cac = acquisitionCostPerUnit * units + marketingCostPerUnit * units
    const overhead = overheadRate * units
    const support = supportPct * overheadRate * units
    const total = sales - marketing - cac - costOfSales - overhead - support

    cashFlows.push({
      month,
      total,
      sales,
      marketing,
      cac,
      costOfSales,
      labor: 0,
      overhead,
      support,
      tooling: 0,
    })
  }

  const discountRate = 0.1 / 12
  const npv = cashFlows.reduce((sum, flow, index) => sum + flow.total / Math.pow(1 + discountRate, index), 0)

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

  const totalUnits = Object.values(salesByMonth).reduce((sum, month) => sum + month.units, 0)
  const averagePrice =
    totalUnits > 0
      ? Object.values(salesByMonth).reduce((sum, month) => sum + month.sales, 0) / totalUnits
      : 0
  const contributionMarginPerUnit = averagePrice - bomUnitCost
  const profitPerUnit = contributionMarginPerUnit
  const assumptions = {
    upfrontCost,
    upfrontToolingCost,
    upfrontLaborCost,
    discountRateAnnual: 0.1,
    note: 'Tooling and modeled labor are treated as upfront outflows. Monthly cash flow subtracts marketing, CAC, BOM, overhead, and support from sales.',
    months,
  }

  return {
    cashFlows,
    npv,
    irr,
    breakEvenMonth,
    paybackPeriod,
    contributionMarginPerUnit,
    profitPerUnit,
    assumptions,
  }
}
