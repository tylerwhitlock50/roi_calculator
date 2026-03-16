import type { CostEstimateRecord, ForecastRecord, IdeaDetailRecord } from '@/lib/api'
import {
  calculateEngineeringLaunchCost,
  calculateLaborCost,
  calculateLaborHours,
  calculateTotalEstimateCost,
  type RoiCalculations,
} from '@/lib/roi-calculations'

type RoiExportProject = Pick<
  IdeaDetailRecord,
  | 'title'
  | 'description'
  | 'category'
  | 'status'
  | 'positioningStatement'
  | 'requiredAttributes'
  | 'competitorOverview'
  | 'createdAt'
  | 'owner'
>

type RoiExportInput = {
  project: RoiExportProject
  forecasts: ForecastRecord[]
  costEstimates: CostEstimateRecord[]
  calculations: RoiCalculations
  exportedAt?: Date
}

const BASE_TABLE_HEADERS = ['Month', 'Total', 'Sales', 'Marketing', 'CAC', 'Materials', 'Labor', 'Overhead', 'Support', 'Tooling']

export function buildRoiExportFilename(title: string, exportedAt = new Date()) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)

  const year = exportedAt.getFullYear()
  const month = String(exportedAt.getMonth() + 1).padStart(2, '0')
  const day = String(exportedAt.getDate()).padStart(2, '0')

  return `roi-${slug || 'report'}-${year}-${month}-${day}.html`
}

export function buildRoiExportHtml({ project, forecasts, costEstimates, calculations, exportedAt = new Date() }: RoiExportInput) {
  const assumptions = calculations.assumptions
  const assumptionRows = Object.entries(assumptions)
    .map(([key, value]) => {
      if (key === 'note') {
        return ''
      }

      return `
        <tr>
          <th>${escapeHtml(formatLabel(key))}</th>
          <td>${escapeHtml(formatAssumptionValue(value))}</td>
        </tr>
      `
    })
    .join('')

  const cashFlowRows = calculations.cashFlows
    .map(
      (flow) => `
        <tr>
          <td>${escapeHtml(formatMonthLabel(flow.month))}</td>
          <td>${formatCurrency(flow.total)}</td>
          <td>${formatCurrencyOrDash(flow.sales)}</td>
          <td>${formatCurrencyOrDash(flow.marketing)}</td>
          <td>${formatCurrencyOrDash(flow.cac)}</td>
          <td>${formatCurrencyOrDash(flow.costOfSales)}</td>
          <td>${formatCurrencyOrDash(flow.labor)}</td>
          <td>${formatCurrencyOrDash(flow.overhead)}</td>
          <td>${formatCurrencyOrDash(flow.support)}</td>
          <td>${formatCurrencyOrDash(flow.tooling)}</td>
        </tr>
      `
    )
    .join('')

  const forecastSections = forecasts.length
    ? forecasts
        .map(
          (forecast, index) => `
            <article class="subsection">
              <div class="section-header">
                <h3>Forecast ${index + 1}: ${escapeHtml(forecast.channelOrCustomer)}</h3>
                <div class="muted">${escapeHtml(forecast.contributorRole)}${forecast.contributor?.fullName ? ` · ${escapeHtml(forecast.contributor.fullName)}` : ''}</div>
              </div>
              <div class="detail-grid">
                <div class="detail-card">
                  <div class="detail-label">Monthly marketing spend</div>
                  <div class="detail-value">${formatCurrency(forecast.monthlyMarketingSpend)}</div>
                </div>
                <div class="detail-card">
                  <div class="detail-label">Marketing / unit</div>
                  <div class="detail-value">${formatUnitCurrency(forecast.marketingCostPerUnit)}</div>
                </div>
                <div class="detail-card">
                  <div class="detail-label">CAC / unit</div>
                  <div class="detail-value">${formatUnitCurrency(forecast.customerAcquisitionCostPerUnit)}</div>
                </div>
              </div>
              ${renderTable(
                ['Month', 'Units', 'Price / unit', 'Revenue'],
                forecast.monthlyVolumeEstimate.map((month) => [
                  escapeHtml(formatMonthLabel(month.month_date)),
                  escapeHtml(formatWholeNumber(month.units)),
                  formatUnitCurrency(month.price),
                  formatCurrency(month.units * month.price),
                ]),
                'No monthly forecast rows saved.'
              )}
            </article>
          `
        )
        .join('')
    : '<p class="empty-state">No saved forecasts were available at export time.</p>'

  const costSections = costEstimates.length
    ? costEstimates
        .map((estimate, index) => {
          const launchEngineeringCost = calculateEngineeringLaunchCost(estimate)
          const laborHours = calculateLaborHours(estimate.laborEntries)
          const laborCost = calculateLaborCost(estimate.laborEntries)

          return `
            <article class="subsection">
              <div class="section-header">
                <h3>Cost estimate ${index + 1}</h3>
                <div class="muted">${estimate.contributor?.fullName ? escapeHtml(estimate.contributor.fullName) : 'Unknown contributor'}</div>
              </div>
              <div class="detail-grid">
                <div class="detail-card">
                  <div class="detail-label">Tooling cost</div>
                  <div class="detail-value">${formatCurrency(estimate.toolingCost)}</div>
                </div>
                <div class="detail-card">
                  <div class="detail-label">Engineering hours</div>
                  <div class="detail-value">${escapeHtml(formatHours(estimate.engineeringHours))}</div>
                </div>
                <div class="detail-card">
                  <div class="detail-label">Engineering rate / hour</div>
                  <div class="detail-value">${formatUnitCurrency(estimate.engineeringRatePerHour)}</div>
                </div>
                <div class="detail-card">
                  <div class="detail-label">Launch engineering cost</div>
                  <div class="detail-value">${formatCurrency(launchEngineeringCost)}</div>
                </div>
                <div class="detail-card">
                  <div class="detail-label">Modeled labor</div>
                  <div class="detail-value">${escapeHtml(formatHours(laborHours))} / ${formatCurrency(laborCost)}</div>
                </div>
                <div class="detail-card">
                  <div class="detail-label">Support allocation</div>
                  <div class="detail-value">${formatPercent(estimate.supportTimePct)}</div>
                </div>
                <div class="detail-card">
                  <div class="detail-label">Overhead rate</div>
                  <div class="detail-value">${formatUnitCurrency(estimate.overheadRate)}</div>
                </div>
                <div class="detail-card">
                  <div class="detail-label">Total estimated cost</div>
                  <div class="detail-value">${formatCurrency(calculateTotalEstimateCost(estimate))}</div>
                </div>
              </div>
              <h4>BOM parts</h4>
              ${renderTable(
                ['Item', 'Qty', 'Unit cost', 'Extended', 'Cash in ROI'],
                estimate.bomParts.map((part) => [
                  escapeHtml(part.item),
                  escapeHtml(formatWholeNumber(part.quantity)),
                  formatUnitCurrency(part.unitCost),
                  formatCurrency(part.unitCost * part.quantity),
                  escapeHtml(part.cashEffect ? 'Yes' : 'No'),
                ]),
                'No BOM parts saved.'
              )}
              <h4>Labor entries</h4>
              ${renderTable(
                ['Activity', 'Duration', 'Rate / hour', 'Labor cost'],
                estimate.laborEntries.map((entry) => {
                  const durationHours = entry.hours + entry.minutes / 60 + entry.seconds / 3600
                  return [
                    escapeHtml(entry.activity.activityName),
                    escapeHtml(formatDuration(entry.hours, entry.minutes, entry.seconds)),
                    formatUnitCurrency(entry.activity.ratePerHour),
                    formatCurrency(durationHours * entry.activity.ratePerHour),
                  ]
                }),
                'No labor entries saved.'
              )}
            </article>
          `
        })
        .join('')
    : '<p class="empty-state">No saved cost estimates were available at export time.</p>'

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(project.title)} ROI Report</title>
    <style>
      :root {
        color-scheme: light;
        --ink: #0f172a;
        --muted: #475569;
        --border: #cbd5e1;
        --panel: #f8fafc;
        --accent: #14532d;
        --accent-soft: #dcfce7;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        font-family: "Avenir Next", "Segoe UI", sans-serif;
        color: var(--ink);
        background: white;
      }

      .page {
        margin: 0 auto;
        max-width: 1200px;
        padding: 40px 32px 64px;
      }

      .hero {
        border: 1px solid var(--border);
        border-radius: 24px;
        background: linear-gradient(135deg, #f8fafc, #ecfccb);
        padding: 28px;
      }

      .eyebrow {
        color: var(--accent);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.18em;
        text-transform: uppercase;
      }

      h1, h2, h3, h4, p {
        margin: 0;
      }

      h1 {
        margin-top: 10px;
        font-size: 34px;
        line-height: 1.1;
      }

      h2 {
        font-size: 22px;
      }

      h3 {
        font-size: 18px;
      }

      h4 {
        margin: 20px 0 10px;
        font-size: 14px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--muted);
      }

      .hero-grid,
      .metric-grid,
      .detail-grid {
        display: grid;
        gap: 16px;
      }

      .hero-grid {
        margin-top: 18px;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      }

      .metric-grid {
        margin-top: 18px;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      }

      .detail-grid {
        margin-top: 16px;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      }

      .stat,
      .metric,
      .detail-card {
        border: 1px solid var(--border);
        border-radius: 18px;
        background: white;
        padding: 16px;
      }

      .metric {
        background: var(--panel);
      }

      .label,
      .detail-label {
        color: var(--muted);
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .value,
      .detail-value {
        margin-top: 8px;
        font-size: 22px;
        font-weight: 700;
      }

      .section {
        margin-top: 28px;
        border: 1px solid var(--border);
        border-radius: 24px;
        padding: 24px;
      }

      .section-header {
        display: flex;
        gap: 12px;
        justify-content: space-between;
        align-items: baseline;
      }

      .subsection + .subsection {
        margin-top: 24px;
        padding-top: 24px;
        border-top: 1px solid var(--border);
      }

      .muted,
      .note {
        color: var(--muted);
      }

      .note {
        margin-top: 12px;
        line-height: 1.5;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 14px;
        font-size: 13px;
      }

      th,
      td {
        border: 1px solid var(--border);
        padding: 10px 12px;
        text-align: left;
        vertical-align: top;
      }

      thead th,
      tfoot td,
      tbody th {
        background: var(--panel);
        font-weight: 700;
      }

      .empty-state {
        margin-top: 14px;
        color: var(--muted);
      }

      @media print {
        .page {
          padding: 0;
        }

        .hero,
        .section,
        .stat,
        .metric,
        .detail-card {
          break-inside: avoid;
        }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <section class="hero">
        <div class="eyebrow">Portable ROI Export</div>
        <h1>${escapeHtml(project.title)}</h1>
        <p class="note">${escapeHtml(project.description || 'No description provided.')}</p>
        <div class="hero-grid">
          <div class="stat">
            <div class="label">Category</div>
            <div class="value">${escapeHtml(project.category || 'Uncategorized')}</div>
          </div>
          <div class="stat">
            <div class="label">Status</div>
            <div class="value">${escapeHtml(formatStatus(project.status))}</div>
          </div>
          <div class="stat">
            <div class="label">Owner</div>
            <div class="value">${escapeHtml(project.owner?.fullName || 'Unknown')}</div>
          </div>
          <div class="stat">
            <div class="label">Exported</div>
            <div class="value">${escapeHtml(formatDateTime(exportedAt))}</div>
          </div>
        </div>
      </section>

      <section class="section">
        <h2>ROI summary</h2>
        <div class="metric-grid">
          <div class="metric"><div class="label">NPV</div><div class="value">${formatCurrency(calculations.npv)}</div></div>
          <div class="metric"><div class="label">IRR</div><div class="value">${formatPercent(calculations.irr)}</div></div>
          <div class="metric"><div class="label">Break-even month</div><div class="value">${escapeHtml(String(calculations.breakEvenMonth))}</div></div>
          <div class="metric"><div class="label">Payback period</div><div class="value">${escapeHtml(`${calculations.paybackPeriod.toFixed(2)} years`)}</div></div>
          <div class="metric"><div class="label">ROI</div><div class="value">${formatPercent(calculations.roiPct)}</div></div>
          <div class="metric"><div class="label">Contribution / unit</div><div class="value">${formatUnitCurrency(calculations.contributionMarginPerUnit)}</div></div>
          <div class="metric"><div class="label">Profit / unit</div><div class="value">${formatUnitCurrency(calculations.profitPerUnit)}</div></div>
          <div class="metric"><div class="label">Units forecasted</div><div class="value">${escapeHtml(formatWholeNumber(Number(assumptions.totalUnits ?? 0)))}</div></div>
        </div>
      </section>

      <section class="section">
        <h2>Business context</h2>
        <div class="detail-grid">
          <div class="detail-card">
            <div class="detail-label">Positioning</div>
            <div class="note">${escapeHtml(project.positioningStatement || 'Not provided.')}</div>
          </div>
          <div class="detail-card">
            <div class="detail-label">Required attributes</div>
            <div class="note">${escapeHtml(project.requiredAttributes || 'Not provided.')}</div>
          </div>
          <div class="detail-card">
            <div class="detail-label">Competitor overview</div>
            <div class="note">${escapeHtml(project.competitorOverview || 'Not provided.')}</div>
          </div>
        </div>
      </section>

      <section class="section">
        <h2>Assumptions</h2>
        <p class="note">${escapeHtml(String(assumptions.note ?? ''))}</p>
        ${assumptionRows ? `<table><tbody>${assumptionRows}</tbody></table>` : ''}
      </section>

      <section class="section">
        <h2>Cash flow detail</h2>
        <table>
          <thead>
            <tr>${BASE_TABLE_HEADERS.map((header) => `<th>${header}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${cashFlowRows}
          </tbody>
          <tfoot>
            <tr>
              <td>Totals</td>
              <td>${formatCurrency(calculations.totals.total)}</td>
              <td>${formatCurrency(calculations.totals.sales)}</td>
              <td>${formatCurrency(calculations.totals.marketing)}</td>
              <td>${formatCurrency(calculations.totals.cac)}</td>
              <td>${formatCurrency(calculations.totals.costOfSales)}</td>
              <td>${formatCurrency(calculations.totals.labor)}</td>
              <td>${formatCurrency(calculations.totals.overhead)}</td>
              <td>${formatCurrency(calculations.totals.support)}</td>
              <td>${formatCurrency(calculations.totals.tooling)}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      <section class="section">
        <h2>Forecast inputs</h2>
        ${forecastSections}
      </section>

      <section class="section">
        <h2>Cost inputs</h2>
        ${costSections}
      </section>
    </main>
  </body>
</html>`
}

function renderTable(headers: string[], rows: string[][], emptyMessage: string) {
  if (!rows.length) {
    return `<p class="empty-state">${escapeHtml(emptyMessage)}</p>`
  }

  return `
    <table>
      <thead>
        <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')}
      </tbody>
    </table>
  `
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatUnitCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

function formatCurrencyOrDash(value: number) {
  return value ? formatCurrency(value) : '–'
}

function formatWholeNumber(value: number) {
  return value.toLocaleString('en-US', {
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  })
}

function formatHours(value: number) {
  return `${value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} hr`
}

function formatDuration(hours: number, minutes: number, seconds: number) {
  const parts = []

  if (hours > 0) {
    parts.push(`${hours}h`)
  }

  if (minutes > 0) {
    parts.push(`${minutes}m`)
  }

  if (seconds > 0 || parts.length === 0) {
    parts.push(`${seconds}s`)
  }

  return parts.join(' ')
}

function formatMonthLabel(month: string) {
  if (month.startsWith('Month 0')) {
    return month
  }

  const parsedDate = new Date(`${month}-01T00:00:00`)
  if (Number.isNaN(parsedDate.getTime())) {
    return month
  }

  return parsedDate.toLocaleString('en-US', {
    month: 'short',
    year: 'numeric',
  })
}

function formatDateTime(value: Date) {
  return value.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function formatStatus(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatLabel(value: string) {
  return value
    .replace(/([A-Z])/g, ' $1')
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatAssumptionValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry)).join(', ')
  }

  if (typeof value === 'number') {
    return Number.isInteger(value) ? formatWholeNumber(value) : value.toFixed(2)
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }

  return String(value)
}
