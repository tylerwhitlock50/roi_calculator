import type { CostEstimateRecord, ForecastRecord, IdeaDetailRecord } from '@/lib/api'
import { buildRoiDecisionSummary, formatBreakEvenSummary } from '@/lib/roi-decision'
import {
  calculateEngineeringLaunchCost,
  calculateLaborCost,
  calculateLaborHours,
  calculateRoiMetrics,
  calculateTotalEstimateCost,
  calculateUnitEconomics,
  type RoiCalculations,
  type UnitEconomicsBreakdown,
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

const BASE_TABLE_HEADERS = [
  'Month',
  'Total',
  'Sales',
  'Marketing',
  'CAC',
  'Materials',
  'Labor',
  'Overhead',
  'Support',
  'Fulfillment',
  'Warranty',
  'Tooling',
  'Launch cash',
  'Compliance',
]

type StressScenario = {
  label: string
  description: string
  calculations: RoiCalculations | null
}

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
  const unitEconomics = calculateUnitEconomics(forecasts, costEstimates)
  const decisionSummary = buildRoiDecisionSummary({ forecasts, costEstimates, calculations })
  const stressScenarios = buildStressScenarios({ forecasts, costEstimates, baseCalculations: calculations })
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
          <td>${formatCurrencyOrDash(flow.fulfillment)}</td>
          <td>${formatCurrencyOrDash(flow.warranty)}</td>
          <td>${formatCurrencyOrDash(flow.tooling)}</td>
          <td>${formatCurrencyOrDash(flow.launchCash)}</td>
          <td>${formatCurrencyOrDash(flow.compliance)}</td>
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
                  <div class="detail-label">Net price confirmed</div>
                  <div class="detail-value">${escapeHtml(forecast.priceBasisConfirmed ? 'Yes' : 'Needs review')}</div>
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
                  <div class="detail-label">Launch cash requirement</div>
                  <div class="detail-value">${formatNullableCurrency(estimate.launchCashRequirement)}</div>
                </div>
                <div class="detail-card">
                  <div class="detail-label">Compliance cost</div>
                  <div class="detail-value">${formatNullableCurrency(estimate.complianceCost)}</div>
                </div>
                <div class="detail-card">
                  <div class="detail-label">Fulfillment / unit</div>
                  <div class="detail-value">${formatNullableUnitCurrency(estimate.fulfillmentCostPerUnit)}</div>
                </div>
                <div class="detail-card">
                  <div class="detail-label">Warranty reserve</div>
                  <div class="detail-value">${formatNullablePercent(estimate.warrantyReservePct)}</div>
                </div>
                <div class="detail-card">
                  <div class="detail-label">Scrap rate</div>
                  <div class="detail-value">${formatPercent(estimate.scrapRate)}</div>
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
                  <div class="detail-label">Scrap rate</div>
                  <div class="detail-value">${formatPercent(estimate.scrapRate)}</div>
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

      .section-intro {
        margin-top: 10px;
        line-height: 1.5;
      }

      .sankey-shell {
        margin-top: 18px;
        overflow-x: auto;
        border: 1px solid var(--border);
        border-radius: 20px;
        background: linear-gradient(180deg, #ffffff, #f8fafc);
        padding: 16px;
      }

      .sankey-shell svg {
        display: block;
        width: 100%;
        min-width: 920px;
        height: auto;
      }

      .stress-table td:first-child {
        min-width: 180px;
      }

      .stress-table td:nth-child(2) {
        min-width: 220px;
      }

      .delta {
        display: inline-block;
        margin-left: 6px;
        font-size: 12px;
        font-weight: 700;
      }

      .delta-positive {
        color: #166534;
      }

      .delta-negative {
        color: #b91c1c;
      }

      .delta-neutral {
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
          <div class="metric"><div class="label">Break-even</div><div class="value">${escapeHtml(formatBreakEvenSummary(calculations))}</div></div>
          <div class="metric"><div class="label">Payback period</div><div class="value">${escapeHtml(`${calculations.paybackPeriod.toFixed(2)} years`)}</div></div>
          <div class="metric"><div class="label">ROI</div><div class="value">${formatPercent(calculations.roiPct)}</div></div>
          <div class="metric"><div class="label">Contribution / unit</div><div class="value">${formatUnitCurrency(calculations.contributionMarginPerUnit)}</div></div>
          <div class="metric"><div class="label">Profit / unit</div><div class="value">${formatUnitCurrency(calculations.profitPerUnit)}</div></div>
          <div class="metric"><div class="label">Units forecasted</div><div class="value">${escapeHtml(formatWholeNumber(Number(assumptions.totalUnits ?? 0)))}</div></div>
        </div>
      </section>

      <section class="section">
        <h2>Decision summary</h2>
        <div class="metric-grid">
          <div class="metric"><div class="label">Verdict</div><div class="value">${escapeHtml(decisionSummary.verdict)}</div></div>
          <div class="metric"><div class="label">Downside result</div><div class="value">${escapeHtml(decisionSummary.downside.survives ? 'Survives downside' : 'Fails downside')}</div></div>
          <div class="metric"><div class="label">Downside NPV</div><div class="value">${formatCurrency(decisionSummary.downside.calculations.npv)}</div></div>
          <div class="metric"><div class="label">Downside IRR</div><div class="value">${formatPercent(decisionSummary.downside.calculations.irr)}</div></div>
        </div>
        <div class="detail-grid">
          <div class="detail-card">
            <div class="detail-label">Why</div>
            <div class="note">${decisionSummary.why.map((item) => `<p>${escapeHtml(item)}</p>`).join('')}</div>
          </div>
          <div class="detail-card">
            <div class="detail-label">Missing review items</div>
            <div class="note">${
              decisionSummary.missingReviewItems.length
                ? decisionSummary.missingReviewItems.map((item) => `<p>${escapeHtml(item)}</p>`).join('')
                : '<p>All required review items are marked as reviewed.</p>'
            }</div>
          </div>
          <div class="detail-card">
            <div class="detail-label">Next action</div>
            <div class="note">${escapeHtml(decisionSummary.nextAction)}</div>
          </div>
        </div>
      </section>

      <section class="section">
        <h2>Revenue flow</h2>
        <p class="section-intro">
          Static Sankey view of the blended unit economics so the portable export still shows where each revenue dollar goes.
        </p>
        ${renderSankeySection(unitEconomics)}
        <p class="note">${escapeHtml(unitEconomics.note)}</p>
      </section>

      <section class="section">
        <h2>Stress test</h2>
        <p class="section-intro">
          Downside checks use the saved forecast and latest cost model. Fixed monthly marketing spend stays fixed when units move.
        </p>
        ${renderStressTable(stressScenarios, calculations)}
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
              <td>${formatCurrency(calculations.totals.fulfillment)}</td>
              <td>${formatCurrency(calculations.totals.warranty)}</td>
              <td>${formatCurrency(calculations.totals.tooling)}</td>
              <td>${formatCurrency(calculations.totals.launchCash)}</td>
              <td>${formatCurrency(calculations.totals.compliance)}</td>
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

function renderSankeySection(unitEconomics: UnitEconomicsBreakdown) {
  if (!unitEconomics.canRenderSankey || unitEconomics.sankeyData.links.length === 0) {
    return '<p class="empty-state">There is not enough modeled cost or margin data yet to render the revenue flow.</p>'
  }

  const svg = buildSankeySvg(unitEconomics)
  return `<div class="sankey-shell">${svg}</div>`
}

function renderStressTable(scenarios: StressScenario[], baseCalculations: RoiCalculations) {
  const rows = scenarios
    .map((scenario) => {
      if (!scenario.calculations) {
        return `
        <tr>
          <td><strong>${escapeHtml(scenario.label)}</strong></td>
          <td>${escapeHtml(scenario.description)}</td>
          <td>–</td>
          <td>–</td>
          <td>–</td>
          <td>–</td>
          <td>–</td>
        </tr>
      `
      }

      const roiDelta = scenario.calculations.roiPct - baseCalculations.roiPct
      const npvDelta = scenario.calculations.npv - baseCalculations.npv
      const profitDelta = scenario.calculations.profitPerUnit - baseCalculations.profitPerUnit

      return `
        <tr>
          <td><strong>${escapeHtml(scenario.label)}</strong></td>
          <td>${escapeHtml(scenario.description)}</td>
          <td>${formatPercent(scenario.calculations.roiPct)}${renderDelta(roiDelta, 'pct')}</td>
          <td>${formatCurrency(scenario.calculations.npv)}${renderDelta(npvDelta, 'currency')}</td>
          <td>${formatUnitCurrency(scenario.calculations.profitPerUnit)}${renderDelta(profitDelta, 'unit-currency')}</td>
          <td>${escapeHtml(formatBreakEvenValue(scenario.calculations))}</td>
          <td>${escapeHtml(formatPaybackValue(scenario.calculations))}</td>
        </tr>
      `
    })
    .join('')

  return `
    <table class="stress-table">
      <thead>
        <tr>
          <th>Scenario</th>
          <th>Assumption</th>
          <th>ROI</th>
          <th>NPV</th>
          <th>Profit / unit</th>
          <th>Break-even</th>
          <th>Payback</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `
}

function renderDelta(value: number, kind: 'pct' | 'currency' | 'unit-currency') {
  const rounded = Math.abs(value) < 0.0001 ? 0 : value
  const tone = rounded > 0 ? 'positive' : rounded < 0 ? 'negative' : 'neutral'
  const prefix = rounded > 0 ? '+' : ''
  const formattedValue =
    kind === 'pct'
      ? `${prefix}${(rounded * 100).toFixed(1)} pts`
      : kind === 'unit-currency'
        ? `${prefix}${formatSignedCurrency(rounded, 2)}`
        : `${prefix}${formatSignedCurrency(rounded, 0)}`

  return `<span class="delta delta-${tone}">${escapeHtml(formattedValue)}</span>`
}

function buildStressScenarios({
  forecasts,
  costEstimates,
  baseCalculations,
}: {
  forecasts: ForecastRecord[]
  costEstimates: CostEstimateRecord[]
  baseCalculations: RoiCalculations
}): StressScenario[] {
  const decisionSummary = buildRoiDecisionSummary({
    forecasts,
    costEstimates,
    calculations: baseCalculations,
  })

  return [
    {
      label: 'Base case',
      description: 'Current saved forecasts and latest cost estimate.',
      calculations: baseCalculations,
    },
    {
      label: 'Standard downside',
      description: decisionSummary.downside.description,
      calculations: decisionSummary.downside.calculations,
    },
  ]
}

function buildSankeySvg(unitEconomics: UnitEconomicsBreakdown) {
  const nodes = unitEconomics.sankeyData.nodes
  const links = unitEconomics.sankeyData.links
  const width = 1100
  const height = 520
  const padding = { top: 28, right: 220, bottom: 28, left: 170 }
  const nodeWidth = 22
  const nodeGap = 18
  const minNodeHeight = 12
  const incomingTotals = nodes.map((_, index) => links.filter((link) => link.target === index).reduce((sum, link) => sum + link.value, 0))
  const outgoingTotals = nodes.map((_, index) => links.filter((link) => link.source === index).reduce((sum, link) => sum + link.value, 0))
  const nodeValues = nodes.map((_, index) => Math.max(incomingTotals[index], outgoingTotals[index], 0))
  const depths = nodes.map(() => 0)

  for (let index = 0; index < links.length; index += 1) {
    for (const link of links) {
      depths[link.target] = Math.max(depths[link.target], depths[link.source] + 1)
    }
  }

  const maxDepth = Math.max(...depths, 0)
  const columns = Array.from({ length: maxDepth + 1 }, () => [] as number[])
  depths.forEach((depth, index) => columns[depth].push(index))

  const availableHeight = height - padding.top - padding.bottom
  const scaleCandidates = columns
    .filter((column) => column.length > 0)
    .map((column) => {
      const totalValue = column.reduce((sum, nodeIndex) => sum + nodeValues[nodeIndex], 0)
      const totalGaps = Math.max(column.length - 1, 0) * nodeGap
      return totalValue > 0 ? (availableHeight - totalGaps) / totalValue : Infinity
    })
  const finiteScaleCandidates = scaleCandidates.filter(Number.isFinite)
  const scale = finiteScaleCandidates.length ? Math.min(...finiteScaleCandidates) : 1
  const columnWidth = maxDepth > 0 ? (width - padding.left - padding.right - nodeWidth) / maxDepth : 0

  const layoutNodes = nodes.map((node, index) => {
    const depth = depths[index]
    const heightPx = Math.max(nodeValues[index] * scale, minNodeHeight)
    const isTerminal = outgoingTotals[index] === 0

    return {
      ...node,
      index,
      depth,
      x: padding.left + depth * columnWidth,
      y: 0,
      width: nodeWidth,
      height: heightPx,
      value: nodeValues[index],
      isTerminal,
    }
  })

  for (const column of columns) {
    const totalHeight = column.reduce((sum, nodeIndex) => sum + layoutNodes[nodeIndex].height, 0) + Math.max(column.length - 1, 0) * nodeGap
    let currentY = padding.top + Math.max((availableHeight - totalHeight) / 2, 0)

    for (const nodeIndex of column) {
      layoutNodes[nodeIndex].y = currentY
      currentY += layoutNodes[nodeIndex].height + nodeGap
    }
  }

  const sourceOffsets = nodes.map(() => 0)
  const targetOffsets = nodes.map(() => 0)
  const renderedLinks = links
    .map((link) => {
      const source = layoutNodes[link.source]
      const target = layoutNodes[link.target]
      if (!source || !target) {
        return ''
      }

      const sourceScale = source.value > 0 ? source.height / source.value : scale
      const targetScale = target.value > 0 ? target.height / target.value : scale
      const thickness = Math.max(link.value * Math.min(sourceScale, targetScale), 3)
      const sourceY = source.y + sourceOffsets[link.source] + thickness / 2
      const targetY = target.y + targetOffsets[link.target] + thickness / 2
      const sourceX = source.x + source.width
      const targetX = target.x
      const curve = Math.max((targetX - sourceX) * 0.42, 40)

      sourceOffsets[link.source] += thickness
      targetOffsets[link.target] += thickness

      return `<path d="M ${sourceX} ${sourceY} C ${sourceX + curve} ${sourceY}, ${targetX - curve} ${targetY}, ${targetX} ${targetY}" fill="none" stroke="${escapeHtml(link.color)}" stroke-opacity="${target.name === 'Profit' ? '0.72' : '0.34'}" stroke-width="${thickness}" />`
    })
    .join('')

  const renderedNodes = layoutNodes
    .map((node) => {
      const labelX = node.isTerminal ? node.x - 12 : node.x + node.width + 12
      const textAnchor = node.isTerminal ? 'end' : 'start'

      return `
        <g>
          <rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="6" fill="${escapeHtml(node.color)}" fill-opacity="0.92" />
          <text x="${labelX}" y="${node.y + node.height / 2 - 4}" text-anchor="${textAnchor}" font-size="12" font-weight="700" fill="#0f172a">
            ${escapeHtml(node.name)}
          </text>
          <text x="${labelX}" y="${node.y + node.height / 2 + 13}" text-anchor="${textAnchor}" font-size="12" fill="#64748b">
            ${escapeHtml(formatUnitCurrency(node.value))}
          </text>
        </g>
      `
    })
    .join('')

  return `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Revenue flow Sankey diagram">
      <rect x="0" y="0" width="${width}" height="${height}" rx="24" fill="#ffffff" />
      ${renderedLinks}
      ${renderedNodes}
    </svg>
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

function formatSignedCurrency(value: number, precision: number) {
  const absolute = Math.abs(value)
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  }).format(absolute)

  return value < 0 ? `-${formatted}` : formatted
}

function formatCurrencyOrDash(value: number) {
  return value ? formatCurrency(value) : '–'
}

function formatNullableCurrency(value: number | null) {
  return value === null ? 'Needs review' : formatCurrency(value)
}

function formatNullableUnitCurrency(value: number | null) {
  return value === null ? 'Needs review' : formatUnitCurrency(value)
}

function formatNullablePercent(value: number | null) {
  return value === null ? 'Needs review' : formatPercent(value)
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

function hasBreakEven(calculations: RoiCalculations) {
  let cumulative = 0

  for (const flow of calculations.cashFlows) {
    cumulative += flow.total
    if (cumulative >= 0) {
      return true
    }
  }

  return false
}

function formatBreakEvenValue(calculations: RoiCalculations) {
  return hasBreakEven(calculations) ? `Month ${calculations.breakEvenMonth}` : 'No payback in saved horizon'
}

function formatPaybackValue(calculations: RoiCalculations) {
  return hasBreakEven(calculations) ? `${calculations.paybackPeriod.toFixed(2)} years` : 'Not reached'
}
