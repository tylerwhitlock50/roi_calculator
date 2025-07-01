// ROI Calculation Utilities

export interface CashFlow {
  month: number;
  revenue: number;
  costs: number;
  netCashFlow: number;
}

export interface ROIMetrics {
  npv: number;
  irr: number;
  breakEvenMonth: number;
  paybackPeriod: number;
  totalRevenue: number;
  totalCosts: number;
}

export interface SalesForecast {
  channelOrCustomer: string;
  monthlyVolume: Record<string, number>;
  contributorRole: string;
}

export interface CostEstimate {
  bomLines: Array<{
    item: string;
    cost: number;
    quantity: number;
  }>;
  toolingCost: number;
  engineeringHours: number;
  marketingBudget: number;
  ppcBudget: number;
}

/**
 * Calculate Net Present Value
 * @param cashFlows Array of monthly cash flows
 * @param discountRate Annual discount rate (e.g., 0.10 for 10%)
 * @returns NPV value
 */
export function calculateNPV(cashFlows: CashFlow[], discountRate: number = 0.10): number {
  const monthlyRate = discountRate / 12;
  
  return cashFlows.reduce((npv, flow, month) => {
    const discountFactor = Math.pow(1 + monthlyRate, month);
    return npv + (flow.netCashFlow / discountFactor);
  }, 0);
}

/**
 * Calculate Internal Rate of Return using Newton-Raphson method
 * @param cashFlows Array of monthly cash flows
 * @param maxIterations Maximum iterations for convergence
 * @param tolerance Tolerance for convergence
 * @returns IRR as decimal (e.g., 0.15 for 15%)
 */
export function calculateIRR(
  cashFlows: CashFlow[],
  maxIterations: number = 100,
  tolerance: number = 0.0001
): number {
  if (cashFlows.length === 0) return 0

  // Work with monthly rate
  let rate = 0.01

  for (let i = 0; i < maxIterations; i++) {
    const npv = cashFlows.reduce((sum, flow, idx) => {
      return sum + flow.netCashFlow / Math.pow(1 + rate, idx)
    }, 0)

    if (Math.abs(npv) < tolerance) {
      return Math.pow(1 + rate, 12) - 1
    }

    const derivative = cashFlows.reduce((sum, flow, idx) => {
      return sum - (idx * flow.netCashFlow) / Math.pow(1 + rate, idx + 1)
    }, 0)

    if (Math.abs(derivative) < tolerance) break

    rate = rate - npv / derivative
  }

  return Math.pow(1 + rate, 12) - 1
}

/**
 * Calculate break-even month
 * @param cashFlows Array of monthly cash flows
 * @returns Month number when cumulative cash flow becomes positive
 */
export function calculateBreakEvenMonth(cashFlows: CashFlow[]): number {
  let cumulativeCashFlow = 0;
  
  for (let i = 0; i < cashFlows.length; i++) {
    cumulativeCashFlow += cashFlows[i].netCashFlow;
    if (cumulativeCashFlow >= 0) {
      return i + 1; // Return 1-based month number
    }
  }
  
  return -1; // No break-even point found
}

/**
 * Calculate payback period
 * @param initialInvestment Initial investment amount
 * @param cashFlows Array of monthly cash flows
 * @returns Payback period in months
 */
export function calculatePaybackPeriod(initialInvestment: number, cashFlows: CashFlow[]): number {
  let cumulativeCashFlow = -initialInvestment;
  
  for (let i = 0; i < cashFlows.length; i++) {
    cumulativeCashFlow += cashFlows[i].netCashFlow;
    if (cumulativeCashFlow >= 0) {
      return i + 1; // Return 1-based month number
    }
  }
  
  return -1; // No payback period found
}

/**
 * Generate cash flows from sales forecasts and cost estimates
 * @param salesForecasts Array of sales forecasts
 * @param costEstimate Cost estimate object
 * @param months Number of months to project
 * @returns Array of monthly cash flows
 */
export function generateCashFlows(
  salesForecasts: SalesForecast[],
  costEstimate: CostEstimate,
  months: number = 36
): CashFlow[] {
  const cashFlows: CashFlow[] = [];
  
  // Calculate initial investment (month 0)
  const initialInvestment = costEstimate.toolingCost + 
    (costEstimate.engineeringHours * 100) + // Assume $100/hour
    costEstimate.marketingBudget + 
    costEstimate.ppcBudget;
  
  // Add initial investment as negative cash flow in month 0
  cashFlows.push({
    month: 0,
    revenue: 0,
    costs: initialInvestment,
    netCashFlow: -initialInvestment
  });
  
  // Calculate monthly cash flows
  for (let month = 1; month <= months; month++) {
    let monthlyRevenue = 0;
    let monthlyCosts = 0;
    
    // Calculate revenue from sales forecasts
    salesForecasts.forEach(forecast => {
      const monthKey = month.toString();
      if (forecast.monthlyVolume[monthKey]) {
        monthlyRevenue += forecast.monthlyVolume[monthKey] * 100; // Assume $100 average price
      }
    });
    
    // Calculate ongoing costs (simplified)
    // In a real implementation, you'd want more sophisticated cost modeling
    monthlyCosts = costEstimate.bomLines.reduce((total, line) => {
      return total + (line.cost * line.quantity);
    }, 0);
    
    cashFlows.push({
      month,
      revenue: monthlyRevenue,
      costs: monthlyCosts,
      netCashFlow: monthlyRevenue - monthlyCosts
    });
  }
  
  return cashFlows;
}

/**
 * Calculate comprehensive ROI metrics
 * @param salesForecasts Array of sales forecasts
 * @param costEstimate Cost estimate object
 * @param discountRate Annual discount rate
 * @param months Number of months to project
 * @returns Complete ROI metrics
 */
export function calculateROIMetrics(
  salesForecasts: SalesForecast[],
  costEstimate: CostEstimate,
  discountRate: number = 0.10,
  months: number = 36
): ROIMetrics {
  const cashFlows = generateCashFlows(salesForecasts, costEstimate, months);
  
  // Calculate total revenue and costs
  const totalRevenue = cashFlows.reduce((sum, flow) => sum + flow.revenue, 0);
  const totalCosts = cashFlows.reduce((sum, flow) => sum + flow.costs, 0);
  
  // Calculate metrics
  const npv = calculateNPV(cashFlows, discountRate);
  const irr = calculateIRR(cashFlows);
  const breakEvenMonth = calculateBreakEvenMonth(cashFlows);
  
  // Calculate payback period (excluding month 0)
  const paybackPeriod = calculatePaybackPeriod(
    Math.abs(cashFlows[0].netCashFlow), 
    cashFlows.slice(1)
  );
  
  return {
    npv,
    irr,
    breakEvenMonth,
    paybackPeriod,
    totalRevenue,
    totalCosts
  };
}

/**
 * Format currency values
 * @param value Number to format
 * @returns Formatted currency string
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

/**
 * Format percentage values
 * @param value Decimal value (e.g., 0.15 for 15%)
 * @returns Formatted percentage string
 */
export function formatPercentage(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(value);
}

/**
 * Get ROI status based on metrics
 * @param metrics ROI metrics
 * @returns Status string
 */
export function getROIStatus(metrics: ROIMetrics): 'excellent' | 'good' | 'fair' | 'poor' {
  if (metrics.irr >= 0.25 && metrics.npv > 0) return 'excellent';
  if (metrics.irr >= 0.15 && metrics.npv > 0) return 'good';
  if (metrics.irr >= 0.10 && metrics.npv > 0) return 'fair';
  return 'poor';
} 