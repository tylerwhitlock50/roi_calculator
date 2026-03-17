'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { addMonths, format, parse } from 'date-fns'
import { useParams, useRouter } from 'next/navigation'

import BlankNumberInput, { blankableNumberToNumber, type BlankableNumber } from '@/components/BlankNumberInput'
import ProductIdeaForm from '@/components/ProductIdeaForm'
import UnitEconomicsTab from '@/components/UnitEconomicsTab'
import {
  apiFetch,
  type ActivityRateRecord,
  type CostEstimateRecord,
  type ForecastRecord,
  type IdeaDetailRecord,
  type MonthlyForecast,
  type RoiSummaryRecord,
} from '@/lib/api'
import { IDEA_STATUS_OPTIONS } from '@/lib/constants'
import {
  calculateEngineeringLaunchCost,
  calculateLaborCost,
  calculateLaborHours,
  calculateRoiMetrics,
  calculateTotalEstimateCost,
} from '@/lib/roi-calculations'
import { buildRoiExportFilename, buildRoiExportHtml } from '@/lib/roi-export'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'forecast', label: 'Forecast' },
  { key: 'cost', label: 'Cost' },
  { key: 'unit-economics', label: 'Unit Economics' },
  { key: 'finalize', label: 'Finalize ROI' },
] as const

const DEFAULT_ENGINEERING_RATE_PER_HOUR = 125

type ForecastFormState = {
  channelOrCustomer: string
  contributorRole: string
  monthlyMarketingSpend: BlankableNumber
  marketingCostPerUnit: BlankableNumber
  customerAcquisitionCostPerUnit: BlankableNumber
  monthlyVolumeEstimate: ForecastRowDraft[]
}

type ForecastRowDraft = {
  month_date: string
  units: BlankableNumber
  price: BlankableNumber
}

type CostFormState = {
  toolingCost: BlankableNumber
  engineeringHours: BlankableNumber
  engineeringRatePerHour: BlankableNumber
  scrapRate: BlankableNumber
  overheadRate: BlankableNumber
  supportTimePct: BlankableNumber
}

type BomDraft = {
  item: string
  unitCost: BlankableNumber
  quantity: BlankableNumber
  cashEffect: boolean
}

type LaborDraft = {
  activityId: string
  hours: BlankableNumber
  minutes: BlankableNumber
  seconds: BlankableNumber
}

type LevelLoadedFormState = {
  startMonth: string
  unitsPerMonth: BlankableNumber
  pricePerUnit: BlankableNumber
  numberOfMonths: BlankableNumber
}

function createEmptyForecastRow(): ForecastRowDraft {
  return { month_date: '', units: '', price: '' }
}

function createInitialForecastForm(): ForecastFormState {
  return {
    channelOrCustomer: '',
    contributorRole: '',
    monthlyMarketingSpend: '',
    marketingCostPerUnit: '',
    customerAcquisitionCostPerUnit: '',
    monthlyVolumeEstimate: [createEmptyForecastRow()],
  }
}

function createInitialCostForm(): CostFormState {
  return {
    toolingCost: '',
    engineeringHours: '',
    engineeringRatePerHour: DEFAULT_ENGINEERING_RATE_PER_HOUR,
    scrapRate: '',
    overheadRate: '',
    supportTimePct: '',
  }
}

function createInitialBomParts(): BomDraft[] {
  return [{ item: '', unitCost: '', quantity: '', cashEffect: true }]
}

function createInitialLaborEntries(): LaborDraft[] {
  return [{ activityId: '', hours: '', minutes: '', seconds: '' }]
}

function createInitialLevelLoadedForm(): LevelLoadedFormState {
  return {
    startMonth: '',
    unitsPerMonth: '',
    pricePerUnit: '',
    numberOfMonths: '',
  }
}

export default function ProductDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params?.id

  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]['key']>('overview')
  const [product, setProduct] = useState<IdeaDetailRecord | null>(null)
  const [activityRates, setActivityRates] = useState<ActivityRateRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showForecastModal, setShowForecastModal] = useState(false)
  const [forecastForm, setForecastForm] = useState<ForecastFormState>(createInitialForecastForm)
  const [editingForecastId, setEditingForecastId] = useState<string | null>(null)
  const [forecastLoading, setForecastLoading] = useState(false)
  const [forecastError, setForecastError] = useState<string | null>(null)
  const [showLevelLoadedForm, setShowLevelLoadedForm] = useState(false)
  const [levelLoadedForm, setLevelLoadedForm] = useState<LevelLoadedFormState>(createInitialLevelLoadedForm)

  const [showCostModal, setShowCostModal] = useState(false)
  const [costForm, setCostForm] = useState<CostFormState>(createInitialCostForm)
  const [bomParts, setBomParts] = useState<BomDraft[]>(createInitialBomParts)
  const [laborEntries, setLaborEntries] = useState<LaborDraft[]>(createInitialLaborEntries)
  const [editingCostId, setEditingCostId] = useState<string | null>(null)
  const [costLoading, setCostLoading] = useState(false)
  const [costError, setCostError] = useState<string | null>(null)

  const [showEditOverview, setShowEditOverview] = useState(false)
  const [editOverviewStep, setEditOverviewStep] = useState<1 | 2 | 3>(1)
  const [editOverviewLoading, setEditOverviewLoading] = useState(false)
  const [editOverviewError, setEditOverviewError] = useState<string | null>(null)

  const [statusSaving, setStatusSaving] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [visibilitySaving, setVisibilitySaving] = useState(false)
  const [visibilityError, setVisibilityError] = useState<string | null>(null)
  const [savingROI, setSavingROI] = useState(false)
  const [saveROIError, setSaveROIError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      return
    }

    void loadPage(id)
  }, [id])

  const loadPage = async (ideaId: string) => {
    try {
      setLoading(true)
      setError(null)

      const [idea, rates] = await Promise.all([
        apiFetch<IdeaDetailRecord>(`/api/ideas/${ideaId}`),
        apiFetch<ActivityRateRecord[]>('/api/admin/activity-rates'),
      ])

      setProduct(idea)
      setActivityRates(rates)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load product')
    } finally {
      setLoading(false)
    }
  }

  const forecasts = product?.forecasts ?? []
  const costEstimates = product?.costEstimates ?? []
  const roiSummary = product?.roiSummary ?? null

  const closeForecastModal = () => {
    setShowForecastModal(false)
    setEditingForecastId(null)
    setForecastForm(createInitialForecastForm())
    setForecastError(null)
    setForecastLoading(false)
    setShowLevelLoadedForm(false)
    setLevelLoadedForm(createInitialLevelLoadedForm())
  }

  const openForecastModal = (forecast?: ForecastRecord) => {
    if (forecast) {
      setEditingForecastId(forecast.id)
      setForecastForm({
        channelOrCustomer: forecast.channelOrCustomer,
        contributorRole: forecast.contributorRole,
        monthlyMarketingSpend: forecast.monthlyMarketingSpend,
        marketingCostPerUnit: forecast.marketingCostPerUnit,
        customerAcquisitionCostPerUnit: forecast.customerAcquisitionCostPerUnit,
        monthlyVolumeEstimate: forecast.monthlyVolumeEstimate.length
          ? forecast.monthlyVolumeEstimate
          : createInitialForecastForm().monthlyVolumeEstimate,
      })
    } else {
      setEditingForecastId(null)
      setForecastForm(createInitialForecastForm())
    }

    setForecastError(null)
    setShowForecastModal(true)
  }

  const saveForecast = async () => {
    if (!product) {
      return
    }

    try {
      setForecastLoading(true)
      setForecastError(null)

      if (!forecastForm.channelOrCustomer || !forecastForm.contributorRole) {
        throw new Error('All forecast fields are required')
      }

      const normalizedMonthlyVolumeEstimate: MonthlyForecast[] = forecastForm.monthlyVolumeEstimate.map((row) => ({
        month_date: row.month_date,
        units: blankableNumberToNumber(row.units),
        price: blankableNumberToNumber(row.price),
      }))

      if (
        normalizedMonthlyVolumeEstimate.length === 0 ||
        normalizedMonthlyVolumeEstimate.some((row) => !row.month_date || row.units <= 0 || row.price <= 0)
      ) {
        throw new Error('Each monthly row needs a month, positive units, and positive price')
      }

      if (new Set(normalizedMonthlyVolumeEstimate.map((row) => row.month_date)).size !== normalizedMonthlyVolumeEstimate.length) {
        throw new Error('Each forecast can only include one row per month')
      }

      await apiFetch(`/api/ideas/${product.id}/forecasts`, {
        method: editingForecastId ? 'PATCH' : 'POST',
        body: JSON.stringify({
          forecastId: editingForecastId,
          contributorRole: forecastForm.contributorRole,
          channelOrCustomer: forecastForm.channelOrCustomer,
          monthlyMarketingSpend: blankableNumberToNumber(forecastForm.monthlyMarketingSpend),
          marketingCostPerUnit: blankableNumberToNumber(forecastForm.marketingCostPerUnit),
          customerAcquisitionCostPerUnit: blankableNumberToNumber(forecastForm.customerAcquisitionCostPerUnit),
          monthlyVolumeEstimate: normalizedMonthlyVolumeEstimate,
        }),
      })

      closeForecastModal()
      await loadPage(product.id)
    } catch (saveError) {
      setForecastError(saveError instanceof Error ? saveError.message : 'Failed to save forecast')
      setForecastLoading(false)
    }
  }

  const deleteForecast = async (forecastId: string) => {
    if (!product || !window.confirm('Delete this forecast?')) {
      return
    }

    try {
      await apiFetch(`/api/ideas/${product.id}/forecasts`, {
        method: 'DELETE',
        body: JSON.stringify({ forecastId }),
      })
      await loadPage(product.id)
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete forecast')
    }
  }

  const closeCostModal = () => {
    setShowCostModal(false)
    setEditingCostId(null)
    setCostForm(createInitialCostForm())
    setBomParts(createInitialBomParts())
    setLaborEntries(createInitialLaborEntries())
    setCostError(null)
    setCostLoading(false)
  }

  const openCostModal = (estimate?: CostEstimateRecord) => {
    if (estimate) {
      setEditingCostId(estimate.id)
      setCostForm({
        toolingCost: estimate.toolingCost,
        engineeringHours: estimate.engineeringHours,
        engineeringRatePerHour: estimate.engineeringRatePerHour ?? DEFAULT_ENGINEERING_RATE_PER_HOUR,
        scrapRate: estimate.scrapRate,
        overheadRate: estimate.overheadRate,
        supportTimePct: estimate.supportTimePct,
      })
      setBomParts(
        estimate.bomParts.length
          ? estimate.bomParts.map((part) => ({
              item: part.item,
              unitCost: part.unitCost,
              quantity: part.quantity,
              cashEffect: part.cashEffect,
            }))
          : createInitialBomParts()
      )
      setLaborEntries(
        estimate.laborEntries.length
          ? estimate.laborEntries.map((entry) => ({
              activityId: entry.activityId,
              hours: entry.hours,
              minutes: entry.minutes,
              seconds: entry.seconds,
            }))
          : createInitialLaborEntries()
      )
    } else {
      setEditingCostId(null)
      setCostForm(createInitialCostForm())
      setBomParts(createInitialBomParts())
      setLaborEntries(createInitialLaborEntries())
    }

    setCostError(null)
    setShowCostModal(true)
  }

  const saveCostEstimate = async () => {
    if (!product) {
      return
    }

    try {
      setCostLoading(true)
      setCostError(null)

      const normalizedCostForm = {
        toolingCost: blankableNumberToNumber(costForm.toolingCost),
        engineeringHours: blankableNumberToNumber(costForm.engineeringHours),
        engineeringRatePerHour: blankableNumberToNumber(costForm.engineeringRatePerHour),
        scrapRate: blankableNumberToNumber(costForm.scrapRate),
        overheadRate: blankableNumberToNumber(costForm.overheadRate),
        supportTimePct: blankableNumberToNumber(costForm.supportTimePct),
      }
      const normalizedBomParts = bomParts.map((part) => ({
        ...part,
        unitCost: blankableNumberToNumber(part.unitCost),
        quantity: blankableNumberToNumber(part.quantity),
      }))
      const normalizedLaborEntries = laborEntries.map((entry) => ({
        ...entry,
        hours: blankableNumberToNumber(entry.hours),
        minutes: blankableNumberToNumber(entry.minutes),
        seconds: blankableNumberToNumber(entry.seconds),
      }))

      if (!normalizedBomParts.every((part) => part.item && part.unitCost >= 0 && part.quantity > 0)) {
        throw new Error('Every BOM row needs an item, cost, and quantity')
      }

      if (
        !normalizedLaborEntries.every(
          (entry) =>
            entry.activityId &&
            (entry.hours > 0 || entry.minutes > 0 || entry.seconds > 0)
        )
      ) {
        throw new Error('Each labor entry needs an activity and non-zero time')
      }

      await apiFetch(`/api/ideas/${product.id}/cost-estimates`, {
        method: editingCostId ? 'PATCH' : 'POST',
        body: JSON.stringify({
          costEstimateId: editingCostId,
          ...normalizedCostForm,
          bomParts: normalizedBomParts,
          laborEntries: normalizedLaborEntries,
        }),
      })

      closeCostModal()
      await loadPage(product.id)
    } catch (saveError) {
      setCostError(saveError instanceof Error ? saveError.message : 'Failed to save cost estimate')
      setCostLoading(false)
    }
  }

  const deleteCostEstimate = async (costEstimateId: string) => {
    if (!product || !window.confirm('Delete this cost estimate?')) {
      return
    }

    try {
      await apiFetch(`/api/ideas/${product.id}/cost-estimates`, {
        method: 'DELETE',
        body: JSON.stringify({ costEstimateId }),
      })
      await loadPage(product.id)
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete cost estimate')
    }
  }

  const updateStatus = async (nextStatus: string) => {
    if (!product) {
      return
    }

    try {
      setStatusSaving(true)
      setStatusError(null)
      const updated = await apiFetch<IdeaDetailRecord>(`/api/ideas/${product.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      })
      setProduct(updated)
    } catch (updateError) {
      setStatusError(updateError instanceof Error ? updateError.message : 'Failed to save status')
    } finally {
      setStatusSaving(false)
    }
  }

  const saveOverview = async (data: {
    title: string
    description: string
    category: string
    positioning_statement: string
    required_attributes: string
    competitor_overview: string
  }) => {
    if (!product) {
      return
    }

    try {
      setEditOverviewLoading(true)
      setEditOverviewError(null)
      const updated = await apiFetch<IdeaDetailRecord>(`/api/ideas/${product.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: data.title,
          description: data.description,
          category: data.category,
          positioningStatement: data.positioning_statement,
          requiredAttributes: data.required_attributes,
          competitorOverview: data.competitor_overview,
        }),
      })
      setProduct(updated)
      setShowEditOverview(false)
    } catch (updateError) {
      setEditOverviewError(updateError instanceof Error ? updateError.message : 'Failed to update overview')
    } finally {
      setEditOverviewLoading(false)
    }
  }

  const openEditOverview = (step: 1 | 2 | 3 = 1) => {
    setEditOverviewStep(step)
    setEditOverviewError(null)
    setShowEditOverview(true)
  }

  const toggleVisibility = async () => {
    if (!product) {
      return
    }

    try {
      setVisibilitySaving(true)
      setVisibilityError(null)
      const updated = await apiFetch<IdeaDetailRecord>(`/api/ideas/${product.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isHidden: !product.isHidden }),
      })
      setProduct(updated)
    } catch (updateError) {
      setVisibilityError(updateError instanceof Error ? updateError.message : 'Failed to update visibility')
    } finally {
      setVisibilitySaving(false)
    }
  }

  const saveRoiSummary = async (payload: {
    npv: number
    irr: number
    breakEvenMonth: number
    paybackPeriod: number
    contributionMarginPerUnit: number
    profitPerUnit: number
    assumptions: Record<string, unknown>
  }) => {
    if (!product) {
      return
    }

    try {
      setSavingROI(true)
      setSaveROIError(null)
      await apiFetch(`/api/ideas/${product.id}/roi-summary`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      await apiFetch('/api/send-roi-email', {
        method: 'POST',
        body: JSON.stringify({
          project: product,
          roi: payload,
          cost: costEstimates[0] ?? null,
        }),
      })
      await loadPage(product.id)
    } catch (saveError) {
      setSaveROIError(saveError instanceof Error ? saveError.message : 'Failed to save ROI')
    } finally {
      setSavingROI(false)
    }
  }

  const generateLevelLoadedForecast = () => {
    const numberOfMonths = blankableNumberToNumber(levelLoadedForm.numberOfMonths)
    const unitsPerMonth = blankableNumberToNumber(levelLoadedForm.unitsPerMonth)
    const pricePerUnit = blankableNumberToNumber(levelLoadedForm.pricePerUnit)

    if (
      !levelLoadedForm.startMonth ||
      unitsPerMonth <= 0 ||
      pricePerUnit <= 0 ||
      numberOfMonths <= 0
    ) {
      setForecastError('All level-loaded fields are required')
      return
    }

    const monthlyForecasts: MonthlyForecast[] = []
    const startDate = parse(levelLoadedForm.startMonth, 'yyyy-MM', new Date())

    for (let index = 0; index < numberOfMonths; index += 1) {
      const currentDate = addMonths(startDate, index)
      monthlyForecasts.push({
        month_date: format(currentDate, 'yyyy-MM'),
        units: unitsPerMonth,
        price: pricePerUnit,
      })
    }

    setForecastForm((current) => ({
      ...current,
      monthlyVolumeEstimate: monthlyForecasts,
    }))
    setShowLevelLoadedForm(false)
    setForecastError(null)
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-12 px-4 text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-b-2 border-primary-600" />
        <p className="text-slate-500">Loading product workspace…</p>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="max-w-5xl mx-auto py-12 px-4 text-center">
        <div className="rounded-2xl border border-danger-200 bg-danger-50 px-6 py-5 text-danger-700">
          {error ?? 'Product not found'}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <button className="btn-secondary mb-6" onClick={() => router.push('/')}>
        Back to dashboard
      </button>

      <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-cyan-50 p-8 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <div className="inline-flex rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-white">
                {product.category}
              </div>
              {product.isHidden && (
                <div className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">
                  Hidden from dashboard
                </div>
              )}
            </div>
            <div>
              <h1 className="text-3xl font-semibold text-slate-950 sm:text-4xl">{product.title}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{product.description}</p>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-slate-500">
              <span>Owner: {product.owner.fullName}</span>
              <span>Created: {new Date(product.createdAt).toLocaleDateString()}</span>
              <span>Status: {product.status.replace('_', ' ')}</span>
            </div>
          </div>

          <div className="w-full max-w-sm rounded-[24px] border border-slate-200 bg-white/90 p-5 shadow-sm">
            <label className="form-label">Project status</label>
            <select
              className="input-field"
              value={product.status}
              disabled={statusSaving}
              onChange={(event) => void updateStatus(event.target.value)}
            >
              {IDEA_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {statusSaving && <div className="mt-2 text-xs text-slate-500">Saving status…</div>}
            {statusError && <div className="mt-2 text-xs text-danger-600">{statusError}</div>}
            <div className="mt-4 border-t border-slate-200 pt-4">
              <div className="text-sm font-medium text-slate-900">
                {product.isHidden ? 'This project is hidden from the default dashboard view.' : 'This project appears in the default dashboard view.'}
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Hidden projects are still saved and can be reopened with the dashboard visibility filter.
              </p>
              <button
                className="btn-secondary mt-3 w-full"
                onClick={() => void toggleVisibility()}
                disabled={visibilitySaving}
              >
                {visibilitySaving ? 'Saving...' : product.isHidden ? 'Unhide project' : 'Hide project'}
              </button>
              {visibilityError && <div className="mt-2 text-xs text-danger-600">{visibilityError}</div>}
            </div>
          </div>
        </div>
      </section>

      <div className="mt-8 flex flex-wrap gap-2 border-b border-slate-200">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`rounded-t-2xl px-5 py-3 text-sm font-medium transition ${
              activeTab === tab.key
                ? 'border border-b-white border-slate-200 bg-white text-primary-700'
                : 'text-slate-500 hover:text-slate-900'
            }`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {activeTab === 'overview' && (
          <section className="card space-y-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-slate-950">Product overview</h2>
                <p className="mt-2 text-sm text-slate-500">Keep the planning brief persistent so the narrative, requirements, and ROI model stay aligned.</p>
              </div>
              <button className="btn-secondary" onClick={() => openEditOverview(1)}>
                Edit overview
              </button>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <OverviewCard
                title="Core brief"
                body={`Category: ${product.category}\n\nDescription:\n${product.description}`}
                actionLabel="Edit brief"
                onAction={() => openEditOverview(1)}
              />
              <OverviewCard
                title="Positioning"
                body={product.positioningStatement}
                actionLabel="Edit positioning"
                onAction={() => openEditOverview(2)}
              />
              <OverviewCard
                title="Requirements"
                body={product.requiredAttributes}
                actionLabel="Edit requirements"
                onAction={() => openEditOverview(3)}
              />
              <OverviewCard
                title="Competitive context"
                body={product.competitorOverview}
                actionLabel="Edit requirements"
                onAction={() => openEditOverview(3)}
              />
              <OverviewCard
                title="Current ROI snapshot"
                body={
                  product.roiSummary
                    ? `NPV ${formatCurrency(product.roiSummary.npv)}, IRR ${(product.roiSummary.irr * 100).toFixed(1)}%, break-even month ${product.roiSummary.breakEvenMonth}.`
                    : 'No saved ROI summary yet.'
                }
              />
            </div>

            {showEditOverview && (
              <Modal
                onClose={() => setShowEditOverview(false)}
                title={editOverviewStep === 1 ? 'Edit product brief' : editOverviewStep === 2 ? 'Edit positioning' : 'Edit requirements'}
              >
                <ProductIdeaForm
                  initialData={{
                    title: product.title,
                    description: product.description,
                    category: product.category,
                    positioning_statement: product.positioningStatement,
                    required_attributes: product.requiredAttributes,
                    competitor_overview: product.competitorOverview,
                  }}
                  initialStep={editOverviewStep}
                  isLoading={editOverviewLoading}
                  submitLabel="Save overview"
                  onComplete={saveOverview}
                />
                {editOverviewError && (
                  <div className="mt-4 rounded-2xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
                    {editOverviewError}
                  </div>
                )}
              </Modal>
            )}
          </section>
        )}

        {activeTab === 'forecast' && (
          <section className="card space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-slate-950">Sales forecasts</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Capture contributor assumptions by channel or customer, including route-to-market costs like channel marketing and CAC.
                </p>
              </div>
              <button className="btn-primary sm:max-w-[220px]" onClick={() => openForecastModal()}>
                Add forecast
              </button>
            </div>

            <ForecastSummary forecasts={forecasts} />

            {forecasts.length === 0 ? (
              <EmptyState
                title="No forecasts yet"
                body="Add your first forecast to define timing, pricing, and expected volume."
              />
            ) : (
              <div className="space-y-4">
                {forecasts.map((forecast) => (
                  <div key={forecast.id} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
                          {forecast.contributor.fullName}
                        </div>
                        <h3 className="mt-2 text-xl font-semibold text-slate-900">{forecast.channelOrCustomer}</h3>
                        <p className="mt-1 text-sm text-slate-500">{forecast.contributorRole}</p>
                      </div>
                      <div className="flex gap-2">
                        <button className="btn-secondary text-sm" onClick={() => openForecastModal(forecast)}>
                          Edit
                        </button>
                        <button className="btn-danger text-sm" onClick={() => void deleteForecast(forecast.id)}>
                          Delete
                        </button>
                      </div>
                    </div>
                    <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
                      <div className="grid gap-3 border-b border-slate-200 bg-slate-50 px-4 py-4 sm:grid-cols-3">
                        <Metric label="Monthly channel spend" value={formatCurrency(forecast.monthlyMarketingSpend)} />
                        <Metric label="Marketing / unit" value={formatCurrency(forecast.marketingCostPerUnit)} />
                        <Metric label="CAC / unit" value={formatCurrency(forecast.customerAcquisitionCostPerUnit)} />
                      </div>
                      <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-50 text-left text-slate-500">
                          <tr>
                            <th className="px-4 py-3 font-medium">Month</th>
                            <th className="px-4 py-3 font-medium">Units</th>
                            <th className="px-4 py-3 font-medium">Price</th>
                            <th className="px-4 py-3 font-medium">Sales</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {forecast.monthlyVolumeEstimate.map((row, index) => (
                            <tr key={`${forecast.id}-${index}`}>
                              <td className="px-4 py-3">{formatMonth(row.month_date)}</td>
                              <td className="px-4 py-3">{row.units.toLocaleString()}</td>
                              <td className="px-4 py-3">{formatCurrency(row.price)}</td>
                              <td className="px-4 py-3">{formatCurrency(row.units * row.price)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {showForecastModal && (
              <Modal
                onClose={closeForecastModal}
                title={editingForecastId ? 'Edit forecast' : 'Add forecast'}
              >
                <div className="space-y-4">
                  <p className="text-sm leading-6 text-slate-500">
                    Name the account or channel, capture any route-to-market costs tied to that revenue stream, and then enter the monthly units and price assumptions.
                  </p>
                  <div className="form-group">
                    <label className="form-label" htmlFor="forecast-channel">
                      Channel or customer
                    </label>
                    <input
                      id="forecast-channel"
                      className="input-field"
                      placeholder="Example: Wholesale dealers, Amazon, or Acme Sporting Goods"
                      value={forecastForm.channelOrCustomer}
                      onChange={(event) =>
                        setForecastForm((current) => ({
                          ...current,
                          channelOrCustomer: event.target.value,
                        }))
                      }
                    />
                    <p className="text-xs text-slate-500">Who will buy the product through this forecast scenario?</p>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="forecast-role">
                      Contributor role
                    </label>
                    <input
                      id="forecast-role"
                      className="input-field"
                      placeholder="Example: Sales manager, channel lead, or product manager"
                      value={forecastForm.contributorRole}
                      onChange={(event) =>
                        setForecastForm((current) => ({
                          ...current,
                          contributorRole: event.target.value,
                        }))
                      }
                    />
                    <p className="text-xs text-slate-500">This helps explain whose assumptions are captured in this forecast.</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <FieldNumber
                      id="forecast-monthly-marketing-spend"
                      label="Monthly channel marketing spend"
                      hint="Fixed spend that runs while this forecast is active, like platform ads or dealer co-op support."
                      value={forecastForm.monthlyMarketingSpend}
                      min={0}
                      step={0.01}
                      onChange={(value) => setForecastForm((current) => ({ ...current, monthlyMarketingSpend: value }))}
                    />
                    <FieldNumber
                      id="forecast-marketing-per-unit"
                      label="Variable marketing cost per unit"
                      hint="Per-unit spend tied specifically to this channel or customer."
                      value={forecastForm.marketingCostPerUnit}
                      min={0}
                      step={0.01}
                      onChange={(value) => setForecastForm((current) => ({ ...current, marketingCostPerUnit: value }))}
                    />
                    <FieldNumber
                      id="forecast-cac-per-unit"
                      label="Customer acquisition cost per unit"
                      hint="Use this for PPC, affiliate, or channel acquisition costs unique to this forecast."
                      value={forecastForm.customerAcquisitionCostPerUnit}
                      min={0}
                      step={0.01}
                      onChange={(value) =>
                        setForecastForm((current) => ({ ...current, customerAcquisitionCostPerUnit: value }))
                      }
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="form-label mb-0">Monthly forecast rows</label>
                        <p className="text-xs text-slate-500">Each row represents one month of volume and selling price.</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="btn-secondary text-sm"
                          onClick={() =>
                            setForecastForm((current) => ({
                              ...current,
                              monthlyVolumeEstimate: [...current.monthlyVolumeEstimate, createEmptyForecastRow()],
                            }))
                          }
                        >
                          Add month
                        </button>
                        <button
                          type="button"
                          className="btn-secondary text-sm"
                          onClick={() => setShowLevelLoadedForm((current) => !current)}
                        >
                          {showLevelLoadedForm ? 'Hide quick fill' : 'Quick fill'}
                        </button>
                      </div>
                    </div>

                    {showLevelLoadedForm && (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="mb-3">
                          <h4 className="text-sm font-semibold text-slate-900">Quick fill a flat monthly plan</h4>
                          <p className="mt-1 text-xs text-slate-500">
                            Use this when units and price stay the same for a run of months.
                          </p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="form-group mb-0">
                            <label className="form-label" htmlFor="quick-fill-start-month">
                              Start month
                            </label>
                            <input
                              id="quick-fill-start-month"
                              type="month"
                              className="input-field"
                              value={levelLoadedForm.startMonth}
                              onChange={(event) =>
                                setLevelLoadedForm((current) => ({
                                  ...current,
                                  startMonth: event.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="form-group mb-0">
                            <label className="form-label" htmlFor="quick-fill-month-count">
                              Number of months
                            </label>
                            <BlankNumberInput
                              id="quick-fill-month-count"
                              className="input-field"
                              min={1}
                              max={60}
                              value={levelLoadedForm.numberOfMonths}
                              onChange={(value) =>
                                setLevelLoadedForm((current) => ({
                                  ...current,
                                  numberOfMonths: value,
                                }))
                              }
                            />
                          </div>
                          <div className="form-group mb-0">
                            <label className="form-label" htmlFor="quick-fill-units">
                              Units sold per month
                            </label>
                            <BlankNumberInput
                              id="quick-fill-units"
                              className="input-field"
                              min={0}
                              value={levelLoadedForm.unitsPerMonth}
                              onChange={(value) =>
                                setLevelLoadedForm((current) => ({
                                  ...current,
                                  unitsPerMonth: value,
                                }))
                              }
                              placeholder="Example: 500"
                            />
                          </div>
                          <div className="form-group mb-0">
                            <label className="form-label" htmlFor="quick-fill-price">
                              Selling price per unit
                            </label>
                            <BlankNumberInput
                              id="quick-fill-price"
                              className="input-field"
                              min={0}
                              step={0.01}
                              value={levelLoadedForm.pricePerUnit}
                              onChange={(value) =>
                                setLevelLoadedForm((current) => ({
                                  ...current,
                                  pricePerUnit: value,
                                }))
                              }
                              placeholder="Example: 79.99"
                            />
                          </div>
                        </div>
                        <button className="btn-primary mt-3" type="button" onClick={generateLevelLoadedForecast}>
                          Generate level-loaded plan
                        </button>
                      </div>
                    )}

                    <div className="space-y-3">
                      {forecastForm.monthlyVolumeEstimate.map((row, index) => (
                        <div key={index} className="rounded-2xl border border-slate-200 p-4">
                          <div className="mb-3 flex items-start justify-between gap-3">
                            <div>
                              <h4 className="text-sm font-semibold text-slate-900">Month row {index + 1}</h4>
                              <p className="mt-1 text-xs text-slate-500">Enter the month, planned units, and average selling price.</p>
                            </div>
                            <button
                              type="button"
                              className="btn-danger text-sm"
                              disabled={forecastForm.monthlyVolumeEstimate.length === 1}
                              onClick={() =>
                                setForecastForm((current) => ({
                                  ...current,
                                  monthlyVolumeEstimate: current.monthlyVolumeEstimate.filter((_, currentIndex) => currentIndex !== index),
                                }))
                              }
                            >
                              Remove
                            </button>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="form-group mb-0">
                              <label className="form-label" htmlFor={`forecast-month-${index}`}>
                                Month
                              </label>
                              <input
                                id={`forecast-month-${index}`}
                                type="month"
                                className="input-field"
                                value={row.month_date}
                                onChange={(event) =>
                                  setForecastForm((current) => ({
                                    ...current,
                                    monthlyVolumeEstimate: current.monthlyVolumeEstimate.map((currentRow, currentIndex) =>
                                      currentIndex === index
                                        ? { ...currentRow, month_date: event.target.value }
                                        : currentRow
                                    ),
                                  }))
                                }
                              />
                            </div>
                            <div className="form-group mb-0">
                              <label className="form-label" htmlFor={`forecast-units-${index}`}>
                                Units sold
                              </label>
                              <BlankNumberInput
                                id={`forecast-units-${index}`}
                                className="input-field"
                                min={0}
                                value={row.units}
                                onChange={(value) =>
                                  setForecastForm((current) => ({
                                    ...current,
                                    monthlyVolumeEstimate: current.monthlyVolumeEstimate.map((currentRow, currentIndex) =>
                                      currentIndex === index
                                        ? { ...currentRow, units: value }
                                        : currentRow
                                    ),
                                  }))
                                }
                              />
                            </div>
                            <div className="form-group mb-0">
                              <label className="form-label" htmlFor={`forecast-price-${index}`}>
                                Selling price per unit
                              </label>
                              <BlankNumberInput
                                id={`forecast-price-${index}`}
                                className="input-field"
                                min={0}
                                step={0.01}
                                value={row.price}
                                onChange={(value) =>
                                  setForecastForm((current) => ({
                                    ...current,
                                    monthlyVolumeEstimate: current.monthlyVolumeEstimate.map((currentRow, currentIndex) =>
                                      currentIndex === index
                                        ? { ...currentRow, price: value }
                                        : currentRow
                                    ),
                                  }))
                                }
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {forecastError && (
                    <div className="rounded-2xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
                      {forecastError}
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <button className="btn-secondary" onClick={closeForecastModal} disabled={forecastLoading}>
                      Cancel
                    </button>
                    <button className="btn-primary" onClick={() => void saveForecast()} disabled={forecastLoading}>
                      {forecastLoading ? 'Saving…' : editingForecastId ? 'Save forecast' : 'Add forecast'}
                    </button>
                  </div>
                </div>
              </Modal>
            )}
          </section>
        )}

        {activeTab === 'cost' && (
          <section className="card space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-slate-950">Cost estimates</h2>
                <p className="mt-2 text-sm text-slate-500">Model product-driven costs like BOM, labor, tooling, overhead, and support in one view.</p>
              </div>
              <button className="btn-primary sm:max-w-[220px]" onClick={() => openCostModal()}>
                Add cost estimate
              </button>
            </div>

            <SuggestedMSRP costEstimates={costEstimates} />
            <CostSummary costEstimates={costEstimates} />

            {costEstimates.length === 0 ? (
              <EmptyState
                title="No cost estimates yet"
                body="Add a cost model so the ROI calculation can combine investment, operating, and unit economics."
              />
            ) : (
              <div className="space-y-4">
                {costEstimates.map((estimate) => (
                  <div key={estimate.id} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
                          {estimate.contributor.fullName}
                        </div>
                        <h3 className="mt-2 text-xl font-semibold text-slate-900">
                          Total modeled cost {formatCurrency(totalEstimateCost(estimate))}
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          Created {new Date(estimate.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button className="btn-secondary text-sm" onClick={() => openCostModal(estimate)}>
                          Edit
                        </button>
                        <button className="btn-danger text-sm" onClick={() => void deleteCostEstimate(estimate.id)}>
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                      <Metric label="Tooling" value={formatCurrency(estimate.toolingCost)} />
                      <Metric label="Eng launch" value={formatCurrency(calculateEngineeringLaunchCost(estimate))} />
                      <Metric label="Scrap" value={`${(estimate.scrapRate * 100).toFixed(1)}%`} />
                      <Metric label="Overhead / Hr" value={formatCurrency(estimate.overheadRate)} />
                      <Metric label="Support %" value={`${(estimate.supportTimePct * 100).toFixed(0)}%`} />
                    </div>

                    <div className="mt-6">
                      <CostOverviewCard estimate={estimate} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {showCostModal && (
              <Modal onClose={closeCostModal} title={editingCostId ? 'Edit cost estimate' : 'Add cost estimate'}>
                <div className="space-y-6">
                  <p className="text-sm leading-6 text-slate-500">
                    Enter the product-specific costs and labor assumptions that should feed this ROI model.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FieldNumber
                      id="cost-tooling"
                      label="Upfront tooling and setup cost"
                      hint="Cash spend incurred before sales begin, separate from engineering launch labor."
                      value={costForm.toolingCost}
                      min={0}
                      step={0.01}
                      onChange={(value) => setCostForm((current) => ({ ...current, toolingCost: value }))}
                    />
                    <FieldNumber
                      id="cost-engineering-hours"
                      label="Engineering hours to launch"
                      hint="One-time engineering effort rolled into upfront tooling using the launch rate below."
                      value={costForm.engineeringHours}
                      min={0}
                      step={0.25}
                      onChange={(value) => setCostForm((current) => ({ ...current, engineeringHours: value }))}
                    />
                    <FieldNumber
                      id="cost-engineering-rate"
                      label="Engineering launch rate per hour"
                      hint="Used to monetize launch engineering hours as upfront tooling investment."
                      value={costForm.engineeringRatePerHour}
                      min={0}
                      step={0.01}
                      onChange={(value) => setCostForm((current) => ({ ...current, engineeringRatePerHour: value }))}
                    />
                    <FieldNumber
                      id="cost-scrap-rate"
                      label="Scrap rate (%)"
                      hint="Cost of poor quality. Example: 1 scrapped out of 20 started = 5%."
                      value={costForm.scrapRate === '' ? '' : costForm.scrapRate * 100}
                      min={0}
                      max={99}
                      step={0.1}
                      onChange={(value) => setCostForm((current) => ({ ...current, scrapRate: value === '' ? '' : value / 100 }))}
                    />
                    <FieldNumber
                      id="cost-overhead-rate"
                      label="Overhead rate per labor hour"
                      hint="Burdened overhead rate applied to modeled labor and support time."
                      value={costForm.overheadRate}
                      min={0}
                      step={0.01}
                      onChange={(value) => setCostForm((current) => ({ ...current, overheadRate: value }))}
                    />
                    <FieldNumber
                      id="cost-support-time"
                      label="Support time allocation (%)"
                      hint="Percent of labor time expected again for support, service, or warranty work."
                      value={costForm.supportTimePct === '' ? '' : costForm.supportTimePct * 100}
                      min={0}
                      step={1}
                      onChange={(value) => setCostForm((current) => ({ ...current, supportTimePct: value === '' ? '' : value / 100 }))}
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">BOM parts</h3>
                        <p className="mt-1 text-xs text-slate-500">List the materials or components required for one finished unit.</p>
                      </div>
                      <button
                        type="button"
                        className="btn-secondary text-sm"
                        onClick={() => setBomParts((current) => [...current, { item: '', unitCost: '', quantity: '', cashEffect: true }])}
                      >
                        Add BOM row
                      </button>
                    </div>
                    {bomParts.map((part, index) => (
                      <div key={index} className="rounded-2xl border border-slate-200 p-4">
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div>
                            <h4 className="text-sm font-semibold text-slate-900">BOM row {index + 1}</h4>
                            <p className="mt-1 text-xs text-slate-500">Define the part name, cost per item, and quantity used in one finished unit.</p>
                          </div>
                          <button
                            type="button"
                            className="btn-danger text-sm"
                            disabled={bomParts.length === 1}
                            onClick={() => setBomParts((current) => current.filter((_, currentIndex) => currentIndex !== index))}
                          >
                            Remove
                          </button>
                        </div>
                        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_140px_140px]">
                          <div className="form-group mb-0">
                            <label className="form-label" htmlFor={`bom-item-${index}`}>
                              Part or material name
                            </label>
                            <input
                              id={`bom-item-${index}`}
                              className="input-field"
                              value={part.item}
                              placeholder="Example: Polymer housing"
                              onChange={(event) =>
                                setBomParts((current) =>
                                  current.map((currentPart, currentIndex) =>
                                    currentIndex === index ? { ...currentPart, item: event.target.value } : currentPart
                                  )
                                )
                              }
                            />
                          </div>
                          <div className="form-group mb-0">
                            <label className="form-label" htmlFor={`bom-cost-${index}`}>
                              Cost per item
                            </label>
                            <BlankNumberInput
                              id={`bom-cost-${index}`}
                              min={0}
                              step={0.01}
                              className="input-field"
                              value={part.unitCost}
                              onChange={(value) =>
                                setBomParts((current) =>
                                  current.map((currentPart, currentIndex) =>
                                    currentIndex === index ? { ...currentPart, unitCost: value } : currentPart
                                  )
                                )
                              }
                            />
                          </div>
                          <div className="form-group mb-0">
                            <label className="form-label" htmlFor={`bom-quantity-${index}`}>
                              Quantity per unit
                            </label>
                            <BlankNumberInput
                              id={`bom-quantity-${index}`}
                              min={0}
                              step={1}
                              className="input-field"
                              value={part.quantity}
                              onChange={(value) =>
                                setBomParts((current) =>
                                  current.map((currentPart, currentIndex) =>
                                    currentIndex === index ? { ...currentPart, quantity: value } : currentPart
                                  )
                                )
                              }
                            />
                          </div>
                        </div>
                        <label className="mt-3 flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-600">
                          <input
                            type="checkbox"
                            checked={part.cashEffect}
                            onChange={(event) =>
                              setBomParts((current) =>
                                current.map((currentPart, currentIndex) =>
                                  currentIndex === index ? { ...currentPart, cashEffect: event.target.checked } : currentPart
                                )
                              )
                            }
                          />
                          Include this part in cash flow calculations
                        </label>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">Labor entries</h3>
                        <p className="mt-1 text-xs text-slate-500">Choose a rate card and enter the direct labor time required for one finished unit.</p>
                      </div>
                      <button
                        type="button"
                        className="btn-secondary text-sm"
                        onClick={() => setLaborEntries((current) => [...current, { activityId: '', hours: '', minutes: '', seconds: '' }])}
                      >
                        Add labor row
                      </button>
                    </div>
                    {laborEntries.map((entry, index) => (
                      <div key={index} className="rounded-2xl border border-slate-200 p-4">
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div>
                            <h4 className="text-sm font-semibold text-slate-900">Labor row {index + 1}</h4>
                            <p className="mt-1 text-xs text-slate-500">Select the work type and enter the time required to produce one finished unit.</p>
                          </div>
                          <button
                            type="button"
                            className="btn-danger text-sm"
                            disabled={laborEntries.length === 1}
                            onClick={() => setLaborEntries((current) => current.filter((_, currentIndex) => currentIndex !== index))}
                          >
                            Remove
                          </button>
                        </div>
                        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_100px_100px_100px]">
                          <div className="form-group mb-0">
                            <label className="form-label" htmlFor={`labor-activity-${index}`}>
                              Activity / rate card
                            </label>
                            <select
                              id={`labor-activity-${index}`}
                              className="input-field"
                              value={entry.activityId}
                              onChange={(event) =>
                                setLaborEntries((current) =>
                                  current.map((currentEntry, currentIndex) =>
                                    currentIndex === index ? { ...currentEntry, activityId: event.target.value } : currentEntry
                                  )
                                )
                              }
                            >
                              <option value="">Select activity</option>
                              {activityRates.map((rate) => (
                                <option key={rate.id} value={rate.id}>
                                  {rate.activityName} ({formatCurrency(rate.ratePerHour)}/hr)
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="form-group mb-0">
                            <label className="form-label" htmlFor={`labor-hours-${index}`}>
                              Hours
                            </label>
                            <BlankNumberInput
                              id={`labor-hours-${index}`}
                              min={0}
                              step={1}
                              className="input-field"
                              value={entry.hours}
                              onChange={(value) =>
                                setLaborEntries((current) =>
                                  current.map((currentEntry, currentIndex) =>
                                    currentIndex === index ? { ...currentEntry, hours: value } : currentEntry
                                  )
                                )
                              }
                            />
                          </div>
                          <div className="form-group mb-0">
                            <label className="form-label" htmlFor={`labor-minutes-${index}`}>
                              Minutes
                            </label>
                            <BlankNumberInput
                              id={`labor-minutes-${index}`}
                              min={0}
                              step={1}
                              className="input-field"
                              value={entry.minutes}
                              onChange={(value) =>
                                setLaborEntries((current) =>
                                  current.map((currentEntry, currentIndex) =>
                                    currentIndex === index ? { ...currentEntry, minutes: value } : currentEntry
                                  )
                                )
                              }
                            />
                          </div>
                          <div className="form-group mb-0">
                            <label className="form-label" htmlFor={`labor-seconds-${index}`}>
                              Seconds
                            </label>
                            <BlankNumberInput
                              id={`labor-seconds-${index}`}
                              min={0}
                              step={1}
                              className="input-field"
                              value={entry.seconds}
                              onChange={(value) =>
                                setLaborEntries((current) =>
                                  current.map((currentEntry, currentIndex) =>
                                    currentIndex === index ? { ...currentEntry, seconds: value } : currentEntry
                                  )
                                )
                              }
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {costError && (
                    <div className="rounded-2xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
                      {costError}
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <button className="btn-secondary" onClick={closeCostModal} disabled={costLoading}>
                      Cancel
                    </button>
                    <button className="btn-primary" onClick={() => void saveCostEstimate()} disabled={costLoading}>
                      {costLoading ? 'Saving…' : editingCostId ? 'Save estimate' : 'Add estimate'}
                    </button>
                  </div>
                </div>
              </Modal>
            )}
          </section>
        )}

        {activeTab === 'unit-economics' && (
          <section className="card space-y-6">
            <UnitEconomicsTab forecasts={forecasts} costEstimates={costEstimates} />
          </section>
        )}

        {activeTab === 'finalize' && (
          <section className="card space-y-6">
            <div>
              <h2 className="text-2xl font-semibold text-slate-950">Finalize ROI</h2>
              <p className="mt-2 text-sm text-slate-500">
                Review the generated cash flow model, then save the latest ROI summary to the project record.
              </p>
            </div>
            <ROICalculator
              project={product}
              forecasts={forecasts}
              costEstimates={costEstimates}
              roiSummary={roiSummary}
              onSave={saveRoiSummary}
              saving={savingROI}
              saveError={saveROIError}
            />
          </section>
        )}
      </div>
    </div>
  )
}

function OverviewCard({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string
  body: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        {actionLabel && onAction && (
          <button type="button" className="text-sm font-medium text-primary-700 hover:text-primary-800" onClick={onAction}>
            {actionLabel}
          </button>
        )}
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">{body}</p>
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

function CostOverviewCard({ estimate }: { estimate: CostEstimateRecord }) {
  const totalBomPerUnit = estimate.bomParts.reduce((sum, part) => sum + part.unitCost * part.quantity, 0)
  const cashBomPerUnit = estimate.bomParts.filter((part) => part.cashEffect).reduce((sum, part) => sum + part.unitCost * part.quantity, 0)
  const laborPerUnit = calculateLaborCost(estimate.laborEntries)
  const laborHoursPerUnit = calculateLaborHours(estimate.laborEntries)
  const combinedUnitCost = totalBomPerUnit + laborPerUnit

  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="text-lg font-semibold text-slate-900">Unit cost overview</h4>
          <p className="mt-1 text-sm text-slate-500">Materials and direct labor rolled into the per-unit cost picture.</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Metric label="Materials / unit" value={formatUnitCurrency(totalBomPerUnit)} />
        <Metric label="Direct labor / unit" value={formatUnitCurrency(laborPerUnit)} />
        <Metric label="Materials + labor / unit" value={formatUnitCurrency(combinedUnitCost)} />
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-600">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            Cash BOM in ROI model: <span className="font-semibold text-slate-900">{formatUnitCurrency(cashBomPerUnit)}</span>
          </div>
          <div>
            Labor time / unit: <span className="font-semibold text-slate-900">{formatHours(laborHoursPerUnit)}</span>
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-5">
        <div>
          <div className="flex items-end justify-between gap-3">
            <div>
              <h5 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">BOM detail</h5>
              <p className="mt-1 text-sm text-slate-500">Part-level material cost contribution for one finished unit.</p>
            </div>
          </div>

          {estimate.bomParts.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No BOM entries.</p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Part</th>
                    <th className="px-4 py-3 font-medium">Unit cost</th>
                    <th className="px-4 py-3 font-medium">Qty / unit</th>
                    <th className="px-4 py-3 font-medium">BOM / unit</th>
                    <th className="px-4 py-3 font-medium">ROI model</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {estimate.bomParts.map((part) => (
                    <tr key={part.id}>
                      <td className="px-4 py-3 font-medium text-slate-900">{part.item}</td>
                      <td className="px-4 py-3">{formatUnitCurrency(part.unitCost)}</td>
                      <td className="px-4 py-3">{formatQuantity(part.quantity)}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{formatUnitCurrency(part.unitCost * part.quantity)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            part.cashEffect ? 'bg-success-50 text-success-700' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {part.cashEffect ? 'Cash-affecting' : 'Reference only'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-end justify-between gap-3">
            <div>
              <h5 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Labor detail</h5>
              <p className="mt-1 text-sm text-slate-500">Per-unit labor time, rate, and direct labor cost by activity.</p>
            </div>
          </div>

          {estimate.laborEntries.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No labor entries.</p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Activity</th>
                    <th className="px-4 py-3 font-medium">Time / unit</th>
                    <th className="px-4 py-3 font-medium">Rate / hr</th>
                    <th className="px-4 py-3 font-medium">Labor / unit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {estimate.laborEntries.map((entry) => {
                    const hours = entry.hours + entry.minutes / 60 + entry.seconds / 3600
                    const laborCost = hours * entry.activity.ratePerHour

                    return (
                      <tr key={entry.id}>
                        <td className="px-4 py-3 font-medium text-slate-900">{entry.activity.activityName}</td>
                        <td className="px-4 py-3">{formatLaborDuration(entry.hours, entry.minutes, entry.seconds)}</td>
                        <td className="px-4 py-3">{formatUnitCurrency(entry.activity.ratePerHour)}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{formatUnitCurrency(laborCost)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <p className="mt-4 text-xs leading-5 text-slate-500">
        Overhead and support are modeled separately from direct labor, so they are not included in this card’s combined materials + labor total.
      </p>
    </div>
  )
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-8 py-12 text-center">
      <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm text-slate-500">{body}</p>
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
    <div className="form-group">
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

function Modal({
  title,
  children,
  onClose,
}: {
  title: string
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/40 px-4 py-8 backdrop-blur-sm">
      <div className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[28px] border border-white/60 bg-white p-6 shadow-2xl">
        <button className="absolute right-4 top-4 text-2xl text-slate-400 hover:text-slate-700" onClick={onClose}>
          ×
        </button>
        <h3 className="mb-6 text-2xl font-semibold text-slate-950">{title}</h3>
        {children}
      </div>
    </div>
  )
}

function ForecastSummary({ forecasts }: { forecasts: ForecastRecord[] }) {
  const monthMap: Record<string, { sales: number; units: number }> = {}
  let grandTotal = 0

  for (const forecast of forecasts) {
    for (const month of forecast.monthlyVolumeEstimate) {
      if (!month.month_date || month.units <= 0 || month.price <= 0) {
        continue
      }

      if (!monthMap[month.month_date]) {
        monthMap[month.month_date] = { sales: 0, units: 0 }
      }

      const sales = month.units * month.price
      monthMap[month.month_date].sales += sales
      monthMap[month.month_date].units += month.units
      grandTotal += sales
    }
  }

  const sortedMonths = Object.keys(monthMap).sort()

  if (!sortedMonths.length) {
    return null
  }

  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
      <div className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">Forecast rollup</div>
      <div className="mt-2 text-3xl font-semibold text-primary-700">{formatCurrency(grandTotal)}</div>
      <p className="mt-1 text-sm text-slate-500">Combined projected sales across all forecast entries.</p>
      <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Month</th>
              <th className="px-4 py-3 font-medium">Units</th>
              <th className="px-4 py-3 font-medium">Sales</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedMonths.map((month) => (
              <tr key={month}>
                <td className="px-4 py-3">{formatMonth(month)}</td>
                <td className="px-4 py-3">{monthMap[month].units.toLocaleString()}</td>
                <td className="px-4 py-3">{formatCurrency(monthMap[month].sales)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CostSummary({ costEstimates }: { costEstimates: CostEstimateRecord[] }) {
  if (!costEstimates.length) {
    return null
  }

  const latest = costEstimates[0]
  const total = totalEstimateCost(latest)

  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
      <div className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">Latest estimate</div>
      <div className="mt-2 text-3xl font-semibold text-primary-700">{formatCurrency(total)}</div>
      <p className="mt-1 text-sm text-slate-500">
        Includes tooling, launch engineering labor, BOM, and modeled manufacturing/support assumptions from the latest saved estimate.
      </p>
    </div>
  )
}

function SuggestedMSRP({ costEstimates }: { costEstimates: CostEstimateRecord[] }) {
  if (!costEstimates.length) {
    return null
  }

  const latest = costEstimates[0]
  const bomCost = latest.bomParts
    .filter((part) => part.cashEffect)
    .reduce((sum, part) => sum + part.unitCost * part.quantity, 0)
  const laborCost = calculateLaborCost(latest.laborEntries)
  const totalLaborHours = calculateLaborHours(latest.laborEntries)
  const yieldMultiplier = 1 / (1 - Math.min(Math.max(latest.scrapRate, 0), 0.99))
  const laborCostWithScrap = laborCost * yieldMultiplier
  const overheadCost = totalLaborHours * latest.overheadRate * yieldMultiplier
  const supportCost = latest.supportTimePct * (laborCostWithScrap + overheadCost)
  const msrp = (bomCost * yieldMultiplier + laborCostWithScrap + supportCost + overheadCost) / 0.45

  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
      <div className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">Suggested MSRP</div>
      <div className="mt-2 text-3xl font-semibold text-primary-700">{formatCurrency(msrp)}</div>
      <p className="mt-1 text-sm text-slate-500">Calculated from cash-affecting BOM, labor, support, and overhead at a 55% gross margin target, including scrap/yield loss.</p>
    </div>
  )
}

function ROICalculator({
  project,
  forecasts,
  costEstimates,
  roiSummary,
  onSave,
  saving,
  saveError,
}: {
  project: IdeaDetailRecord
  forecasts: ForecastRecord[]
  costEstimates: CostEstimateRecord[]
  roiSummary: RoiSummaryRecord | null
  onSave: (payload: {
    npv: number
    irr: number
    breakEvenMonth: number
    paybackPeriod: number
    contributionMarginPerUnit: number
    profitPerUnit: number
    assumptions: Record<string, unknown>
  }) => void
  saving: boolean
  saveError: string | null
}) {
  const calculations = useMemo(() => calculateRoiMetrics(forecasts, costEstimates), [costEstimates, forecasts])
  const [exportError, setExportError] = useState<string | null>(null)

  const hasChanges =
    !roiSummary ||
    roiSummary.npv.toFixed(2) !== calculations.npv.toFixed(2) ||
    roiSummary.irr.toFixed(4) !== calculations.irr.toFixed(4) ||
    roiSummary.breakEvenMonth !== calculations.breakEvenMonth ||
    roiSummary.paybackPeriod.toFixed(2) !== calculations.paybackPeriod.toFixed(2)

  const exportReport = () => {
    try {
      setExportError(null)

      const exportedAt = new Date()
      const html = buildRoiExportHtml({
        project,
        forecasts,
        costEstimates,
        calculations,
        exportedAt,
      })
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')

      link.href = url
      link.download = buildRoiExportFilename(project.title, exportedAt)
      document.body.append(link)
      link.click()
      link.remove()

      window.setTimeout(() => {
        window.URL.revokeObjectURL(url)
      }, 0)
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Failed to export ROI report')
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Metric label="NPV" value={formatCurrency(calculations.npv)} />
        <Metric label="IRR" value={`${(calculations.irr * 100).toFixed(1)}%`} />
        <Metric label="Break-even month" value={String(calculations.breakEvenMonth)} />
        <Metric label="Payback period" value={`${calculations.paybackPeriod.toFixed(2)} years`} />
        <Metric label="Contribution / unit" value={formatCurrency(calculations.contributionMarginPerUnit)} />
        <Metric label="Profit / unit" value={formatCurrency(calculations.profitPerUnit)} />
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
        <h3 className="text-lg font-semibold text-slate-900">Cash flow detail</h3>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Month</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Sales</th>
                <th className="px-4 py-3 font-medium">Marketing</th>
                <th className="px-4 py-3 font-medium">CAC</th>
                <th className="px-4 py-3 font-medium">Materials</th>
                <th className="px-4 py-3 font-medium">Labor</th>
                <th className="px-4 py-3 font-medium">Overhead</th>
                <th className="px-4 py-3 font-medium">Support</th>
                <th className="px-4 py-3 font-medium">Tooling</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {calculations.cashFlows.map((flow) => (
                <tr key={flow.month}>
                  <td className="px-4 py-3">{flow.month.startsWith('Month 0') ? flow.month : formatMonth(flow.month)}</td>
                  <td className="px-4 py-3 font-semibold">{formatCurrency(flow.total)}</td>
                  <td className="px-4 py-3">{flow.sales ? formatCurrency(flow.sales) : '-'}</td>
                  <td className="px-4 py-3">{flow.marketing ? formatCurrency(flow.marketing) : '-'}</td>
                  <td className="px-4 py-3">{flow.cac ? formatCurrency(flow.cac) : '-'}</td>
                  <td className="px-4 py-3">{flow.costOfSales ? formatCurrency(flow.costOfSales) : '-'}</td>
                  <td className="px-4 py-3">{flow.labor ? formatCurrency(flow.labor) : '-'}</td>
                  <td className="px-4 py-3">{flow.overhead ? formatCurrency(flow.overhead) : '-'}</td>
                  <td className="px-4 py-3">{flow.support ? formatCurrency(flow.support) : '-'}</td>
                  <td className="px-4 py-3">{flow.tooling ? formatCurrency(flow.tooling) : '-'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-slate-300 bg-slate-100 text-slate-700">
              <tr>
                <td className="px-4 py-3 font-semibold">
                  <div>Totals</div>
                  <div className="text-xs font-medium text-slate-500">ROI {(calculations.roiPct * 100).toFixed(1)}%</div>
                </td>
                <td className="px-4 py-3 font-semibold">{formatCurrency(calculations.totals.total)}</td>
                <td className="px-4 py-3 font-semibold">{formatCurrency(calculations.totals.sales)}</td>
                <td className="px-4 py-3 font-semibold">{formatCurrency(calculations.totals.marketing)}</td>
                <td className="px-4 py-3 font-semibold">{formatCurrency(calculations.totals.cac)}</td>
                <td className="px-4 py-3 font-semibold">{formatCurrency(calculations.totals.costOfSales)}</td>
                <td className="px-4 py-3 font-semibold">{formatCurrency(calculations.totals.labor)}</td>
                <td className="px-4 py-3 font-semibold">{formatCurrency(calculations.totals.overhead)}</td>
                <td className="px-4 py-3 font-semibold">{formatCurrency(calculations.totals.support)}</td>
                <td className="px-4 py-3 font-semibold">{formatCurrency(calculations.totals.tooling)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
        <div className="font-semibold text-slate-900">Assumptions</div>
        <p className="mt-2">{String(calculations.assumptions.note)}</p>
      </div>

      {saveError && (
        <div className="rounded-2xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          {saveError}
        </div>
      )}

      {exportError && (
        <div className="rounded-2xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          {exportError}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex flex-wrap gap-3">
          <button className="btn-secondary" onClick={exportReport}>
            Export ROI report
          </button>

          {hasChanges && (
            <button
              className="btn-primary"
              onClick={() =>
                onSave({
                  npv: Number(calculations.npv.toFixed(2)),
                  irr: Number(calculations.irr.toFixed(4)),
                  breakEvenMonth: calculations.breakEvenMonth,
                  paybackPeriod: Number(calculations.paybackPeriod.toFixed(2)),
                  contributionMarginPerUnit: Number(calculations.contributionMarginPerUnit.toFixed(2)),
                  profitPerUnit: Number(calculations.profitPerUnit.toFixed(2)),
                  assumptions: calculations.assumptions,
                })
              }
              disabled={saving}
            >
              {saving ? 'Saving ROI…' : roiSummary ? 'Update ROI summary' : 'Save ROI summary'}
            </button>
          )}
        </div>

        <p className="text-sm text-slate-500">
          Exports the current ROI snapshot as an HTML file Jason can open in any browser or print to PDF.
        </p>

        {!hasChanges && (
          <div className="rounded-2xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700">
            The saved ROI summary already matches the current forecast and cost assumptions.
          </div>
        )}
      </div>
    </div>
  )
}

function totalEstimateCost(estimate: CostEstimateRecord) {
  return calculateTotalEstimateCost(estimate)
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
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

function formatUnitCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatHours(value: number) {
  return `${value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} hr`
}

function formatLaborDuration(hours: number, minutes: number, seconds: number) {
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

function formatMonth(month: string) {
  return new Date(`${month}-01T00:00:00`).toLocaleString('default', {
    year: 'numeric',
    month: 'short',
  })
}
