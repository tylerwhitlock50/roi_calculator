'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase, Database } from '@/lib/supabase'
import ProductIdeaForm from '@/components/ProductIdeaForm'
import { useAppStore } from '@/lib/store'
import { parse, addMonths, format } from 'date-fns'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'forecast', label: 'Forecast' },
  { key: 'cost', label: 'Cost' },
  { key: 'finalize', label: 'Finalize ROI' },
]

type Idea = Partial<Database['public']['Tables']['ideas']['Row']>
type ROISummary = {
  id?: string
  idea_id?: string
  npv?: number
  irr?: number
  break_even_month?: number
  payback_period?: number
  assumptions?: Record<string, any>
  created_at?: string
}

type ProductData = {
  id?: string
  organization_id?: string
  title?: string
  description?: string
  category?: string
  positioning_statement?: string
  required_attributes?: string
  competitor_overview?: string
  created_by?: string
  created_at?: string
  roi_summary?: ROISummary | null
  owner_name?: string
  status?: string
}

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params?.id
  const {
    user,
    isAuthenticated,
    authChecked,
  } = useAppStore()
  const authInit = useRef(false)

  useEffect(() => {
    if (authInit.current) return
    authInit.current = true
  }, [])
  const [activeTab, setActiveTab] = useState('overview')
  const [product, setProduct] = useState<ProductData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [forecasts, setForecasts] = useState<any[]>([])
  const [loadingForecasts, setLoadingForecasts] = useState(false)
  const [forecastError, setForecastError] = useState<string | null>(null)
  const [showForecastModal, setShowForecastModal] = useState(false)
  const [forecastForm, setForecastForm] = useState({
    channel_or_customer: '',
    contributor_role: '',
    monthly_volume_estimate: [
      { month_date: '', units: 0, price: 0 }
    ] as Array<{ month_date: string; units: number; price: number }>,
  })
  const [formError, setFormError] = useState<string | null>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [editingForecast, setEditingForecast] = useState<any | null>(null)
  const [costEstimates, setCostEstimates] = useState<any[]>([])
  const [loadingCosts, setLoadingCosts] = useState(false)
  const [costError, setCostError] = useState<string | null>(null)
  // Cost modal state
  const [showCostModal, setShowCostModal] = useState(false)
  const [editingCost, setEditingCost] = useState<any | null>(null)
  const [costForm, setCostForm] = useState({
    tooling_cost: 0,
    marketing_budget: 0,
    marketing_cost_per_unit: 0,
    overhead_rate: 60, // Default $60
    support_time_pct: 0.2, // Default 20%
    ppc_budget: 0,
  })
  const [bomParts, setBomParts] = useState<Array<{ item: string; unit_cost: number; quantity: number; cash_effect?: boolean }>>([
    { item: '', unit_cost: 0, quantity: 1, cash_effect: true }
  ])
  const [laborEntries, setLaborEntries] = useState<Array<{ activity_id: string; hours: number; minutes: number; seconds: number }>>([
    { activity_id: '', hours: 0, minutes: 0, seconds: 0 }
  ])
  const [activityRates, setActivityRates] = useState<any[]>([])
  const [costFormError, setCostFormError] = useState<string | null>(null)
  const [costFormLoading, setCostFormLoading] = useState(false)
  // ROI summary state
  const [roiSummary, setRoiSummary] = useState<any | null>(null)
  const [savingROI, setSavingROI] = useState(false)
  const [saveROIError, setSaveROIError] = useState<string | null>(null)
  // Status update state
  const [statusSaving, setStatusSaving] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)
  // Edit overview modal state
  const [showEditOverview, setShowEditOverview] = useState(false)
  const [editOverviewLoading, setEditOverviewLoading] = useState(false)
  const [editOverviewError, setEditOverviewError] = useState<string | null>(null)
  // Level loaded forecast state
  const [showLevelLoadedForm, setShowLevelLoadedForm] = useState(false)
  const [levelLoadedForm, setLevelLoadedForm] = useState({
    start_month: '',
    units_per_month: 0,
    price_per_unit: 0,
    number_of_months: 24, // Default to 2 years
  })

  useEffect(() => {
    if (!id || !isAuthenticated || !user) return
    setLoading(true)
    setError(null)
    supabase
      .from('ideas')
      .select(`
        *,
        roi_summaries(*),
        created_by_user:users!ideas_created_by_fkey(full_name)
      `)
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setError('Product not found')
          setProduct(null)
        } else {
          setProduct({
            ...data,
            roi_summary: data.roi_summaries?.[0] || null,
            owner_name: data.created_by_user?.full_name || 'Unknown',
          })
        }
        setLoading(false)
      })
  }, [id, isAuthenticated, user])

  useEffect(() => {
    if (!product?.id || !isAuthenticated || !user) return
    setLoadingForecasts(true)
    setForecastError(null)
    supabase
      .from('sales_forecasts')
      .select(`*, contributor:users!sales_forecasts_contributor_id_fkey(full_name)`)
      .eq('idea_id', product.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          setForecastError('Could not load forecasts')
          setForecasts([])
        } else {
          setForecasts(data || [])
        }
        setLoadingForecasts(false)
      })
  }, [product?.id, isAuthenticated, user])

  useEffect(() => {
    if (!product?.id || !isAuthenticated || !user) return
    setLoadingCosts(true)
    setCostError(null)
    supabase
      .from('cost_estimates')
      .select(`
        *,
        contributor:users!cost_estimates_created_by_fkey(full_name),
        bom_parts(*),
        labor_entries(
          *,
          activity:activity_rates(*)
        )
      `)
      .eq('idea_id', product.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          setCostError('Could not load cost estimates')
          setCostEstimates([])
        } else {
          setCostEstimates(data || [])
        }
        setLoadingCosts(false)
      })
  }, [product?.id, isAuthenticated, user])

  useEffect(() => {
    if (!product?.id || !isAuthenticated || !user) return
    supabase
      .from('roi_summaries')
      .select('*')
      .eq('idea_id', product.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setRoiSummary(data && data.length ? data[0] : null))
  }, [product?.id, isAuthenticated, user])

  // Add handlers for monthly rows
  const handleMonthRowChange = (idx: number, field: string, value: any) => {
    setForecastForm(prev => {
      const updated = prev.monthly_volume_estimate.map((row, i) =>
        i === idx ? { ...row, [field]: value } : row
      )
      return { ...prev, monthly_volume_estimate: updated }
    })
  }
  const handleAddMonthRow = () => {
    setForecastForm(prev => ({
      ...prev,
      monthly_volume_estimate: [
        ...prev.monthly_volume_estimate,
        { month_date: '', units: 0, price: 0 },
      ],
    }))
  }
  const handleRemoveMonthRow = (idx: number) => {
    setForecastForm(prev => ({
      ...prev,
      monthly_volume_estimate: prev.monthly_volume_estimate.filter((_, i) => i !== idx),
    }))
  }

  // Open modal for editing
  const handleEditForecast = (forecast: any) => {
    setEditingForecast(forecast)
    setForecastForm({
      channel_or_customer: forecast.channel_or_customer,
      contributor_role: forecast.contributor_role,
      monthly_volume_estimate: Array.isArray(forecast.monthly_volume_estimate)
        ? forecast.monthly_volume_estimate.map((m: any) => ({
            month_date: m.month_date || '',
            units: m.units || 0,
            price: m.price || 0,
          }))
        : [{ month_date: '', units: 0, price: 0 }],
    })
    setShowForecastModal(true)
  }

  // Add or update forecast submit
  const handleAddForecast = async () => {
    setFormError(null)
    setFormLoading(true)
    if (!product?.id) {
      setFormError('No product loaded')
      setFormLoading(false)
      return
    }
    if (!forecastForm.channel_or_customer || !forecastForm.contributor_role) {
      setFormError('All fields are required')
      setFormLoading(false)
      return
    }
    // Validate months
    if (forecastForm.monthly_volume_estimate.length === 0 || forecastForm.monthly_volume_estimate.some(m => !m.month_date || !m.units || !m.price)) {
      setFormError('All month fields are required')
      setFormLoading(false)
      return
    }
    const user = (await supabase.auth.getUser()).data.user
    const contributor_id = user?.id
    if (!contributor_id) {
      setFormError('You must be logged in to add a forecast')
      setFormLoading(false)
      return
    }
    let error
    if (editingForecast) {
      // Update existing forecast
      const { error: updateError } = await supabase.from('sales_forecasts').update({
        contributor_role: forecastForm.contributor_role,
        channel_or_customer: forecastForm.channel_or_customer,
        monthly_volume_estimate: forecastForm.monthly_volume_estimate,
      }).eq('id', editingForecast.id)
      error = updateError
    } else {
      // Insert new forecast
      const { error: insertError } = await supabase.from('sales_forecasts').insert({
        idea_id: product.id,
        contributor_id,
        contributor_role: forecastForm.contributor_role,
        channel_or_customer: forecastForm.channel_or_customer,
        monthly_volume_estimate: forecastForm.monthly_volume_estimate,
      })
      error = insertError
    }
    if (error) {
      setFormError(error.message)
      setFormLoading(false)
      return
    }
    setShowForecastModal(false)
    setEditingForecast(null)
    setForecastForm({ channel_or_customer: '', contributor_role: '', monthly_volume_estimate: [{ month_date: '', units: 0, price: 0 }] })
    setFormLoading(false)
    // Refresh forecasts
    supabase
      .from('sales_forecasts')
      .select(`*, contributor:users!sales_forecasts_contributor_id_fkey(full_name)`)
      .eq('idea_id', product.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setForecasts(data || []))
  }

  // When closing modal, clear editing state
  const handleCloseModal = () => {
    setShowForecastModal(false)
    setEditingForecast(null)
    setForecastForm({ channel_or_customer: '', contributor_role: '', monthly_volume_estimate: [{ month_date: '', units: 0, price: 0 }] })
    setFormError(null)
    setFormLoading(false)
    setShowLevelLoadedForm(false)
    setLevelLoadedForm({ start_month: '', units_per_month: 0, price_per_unit: 0, number_of_months: 24 })
  }

  // Generate level loaded forecast
  const handleGenerateLevelLoaded = () => {
    if (!levelLoadedForm.start_month || !levelLoadedForm.units_per_month || !levelLoadedForm.price_per_unit || !levelLoadedForm.number_of_months) {
      setFormError('All level loaded fields are required')
      return
    }

    const monthlyForecasts: Array<{ month_date: string; units: number; price: number }> = []
    const startDate = parse(levelLoadedForm.start_month, 'yyyy-MM', new Date())

    for (let i = 0; i < levelLoadedForm.number_of_months; i++) {
      const currentDate = addMonths(startDate, i)
      const monthString = format(currentDate, 'yyyy-MM')

      if (monthlyForecasts.length === 0 || monthlyForecasts[monthlyForecasts.length - 1].month_date !== monthString) {
        monthlyForecasts.push({
          month_date: monthString,
          units: levelLoadedForm.units_per_month,
          price: levelLoadedForm.price_per_unit,
        })
      }
    }
    
    setForecastForm(prev => ({
      ...prev,
      monthly_volume_estimate: monthlyForecasts,
    }))
    setShowLevelLoadedForm(false)
    setFormError(null)
  }

  // Delete forecast
  const handleDeleteForecast = async (forecastId: string) => {
    if (!window.confirm('Are you sure you want to delete this forecast?')) return
    await supabase.from('sales_forecasts').delete().eq('id', forecastId)
    // Refresh forecasts
    if (product?.id) {
      supabase
        .from('sales_forecasts')
        .select(`*, contributor:users!sales_forecasts_contributor_id_fkey(full_name)`)
        .eq('idea_id', product.id)
        .order('created_at', { ascending: false })
        .then(({ data }) => setForecasts(data || []))
    }
  }

  // Load activity rates when component mounts
  useEffect(() => {
    if (!product?.organization_id) return
    supabase
      .from('activity_rates')
      .select('*')
      .eq('organization_id', product.organization_id)
      .order('activity_name')
      .then(({ data }) => setActivityRates(data || []))
  }, [product?.organization_id])

  // Open modal for add/edit
  const handleAddCost = () => {
    setEditingCost(null)
    setCostForm({ tooling_cost: 0, marketing_budget: 0, marketing_cost_per_unit: 0, overhead_rate: 60, support_time_pct: 0.2, ppc_budget: 0 })
    setBomParts([{ item: '', unit_cost: 0, quantity: 1, cash_effect: true }])
    setLaborEntries([{ activity_id: '', hours: 0, minutes: 0, seconds: 0 }])
    setShowCostModal(true)
  }
  const handleEditCost = (cost: any) => {
    setEditingCost(cost)
    setCostForm({
      tooling_cost: cost.tooling_cost || 0,
      marketing_budget: cost.marketing_budget || 0,
      marketing_cost_per_unit: cost.marketing_cost_per_unit || 0,
      overhead_rate: cost.overhead_rate || 60,
      support_time_pct: cost.support_time_pct || 0.2,
      ppc_budget: cost.ppc_budget || 0,
    })
    // Load BOM parts and labor entries for this cost estimate
    if (cost.id) {
      loadBomParts(cost.id)
      loadLaborEntries(cost.id)
    }
    setShowCostModal(true)
  }
  const handleCloseCostModal = () => {
    setShowCostModal(false)
    setEditingCost(null)
    setCostForm({ tooling_cost: 0, marketing_budget: 0, marketing_cost_per_unit: 0, overhead_rate: 60, support_time_pct: 0.2, ppc_budget: 0 })
    setBomParts([{ item: '', unit_cost: 0, quantity: 1, cash_effect: true }])
    setLaborEntries([{ activity_id: '', hours: 0, minutes: 0, seconds: 0 }])
    setCostFormError(null)
    setCostFormLoading(false)
  }

  const loadBomParts = async (costEstimateId: string) => {
    const { data } = await supabase
      .from('bom_parts')
      .select('*')
      .eq('cost_estimate_id', costEstimateId)
    if (data && data.length > 0) {
      setBomParts(data.map(part => ({
        item: part.item,
        unit_cost: part.unit_cost,
        quantity: part.quantity,
        cash_effect: part.cash_effect !== false
      })))
    } else {
      setBomParts([{ item: '', unit_cost: 0, quantity: 1, cash_effect: true }])
    }
  }

  const loadLaborEntries = async (costEstimateId: string) => {
    const { data } = await supabase
      .from('labor_entries')
      .select('*')
      .eq('cost_estimate_id', costEstimateId)
    if (data && data.length > 0) {
      setLaborEntries(data.map(entry => ({
        activity_id: entry.activity_id,
        hours: entry.hours,
        minutes: entry.minutes,
        seconds: entry.seconds
      })))
    } else {
      setLaborEntries([{ activity_id: '', hours: 0, minutes: 0, seconds: 0 }])
    }
  }

  // BOM parts handlers
  const handleBomPartChange = (idx: number, field: string, value: any) => {
    setBomParts(prev => {
      const updated = prev.map((part, i) => i === idx ? { ...part, [field]: value } : part)
      return updated
    })
  }
  const handleAddBomPart = () => {
    setBomParts(prev => [...prev, { item: '', unit_cost: 0, quantity: 1, cash_effect: true }])
  }
  const handleRemoveBomPart = (idx: number) => {
    setBomParts(prev => prev.filter((_, i) => i !== idx))
  }

  // Labor entries handlers
  const handleLaborEntryChange = (idx: number, field: string, value: any) => {
    setLaborEntries(prev => {
      const updated = prev.map((entry, i) => i === idx ? { ...entry, [field]: value } : entry)
      return updated
    })
  }
  const handleAddLaborEntry = () => {
    setLaborEntries(prev => [...prev, { activity_id: '', hours: 0, minutes: 0, seconds: 0 }])
  }
  const handleRemoveLaborEntry = (idx: number) => {
    setLaborEntries(prev => prev.filter((_, i) => i !== idx))
  }
  // Add or update cost estimate
  const handleSaveCost = async () => {
    setCostFormError(null)
    setCostFormLoading(true)
    if (!product?.id) {
      setCostFormError('No product loaded')
      setCostFormLoading(false)
      return
    }
    // Validate BOM parts
    if (!bomParts.every(part => part.item && part.unit_cost >= 0 && part.quantity > 0)) {
      setCostFormError('All BOM parts must have item, cost >= 0, and quantity > 0')
      setCostFormLoading(false)
      return
    }
    // Validate labor entries
    if (!laborEntries.every(entry => entry.activity_id && (entry.hours > 0 || entry.minutes > 0 || entry.seconds > 0))) {
      setCostFormError('All labor entries must have an activity selected and time > 0')
      setCostFormLoading(false)
      return
    }
    const user = (await supabase.auth.getUser()).data.user
    const created_by = user?.id
    if (!created_by) {
      setCostFormError('You must be logged in to add a cost estimate')
      setCostFormLoading(false)
      return
    }
    let error
    let costEstimateId: string
    if (editingCost) {
      // Update
      const { error: updateError } = await supabase.from('cost_estimates').update({
        tooling_cost: costForm.tooling_cost,
        marketing_budget: costForm.marketing_budget,
        marketing_cost_per_unit: costForm.marketing_cost_per_unit,
        overhead_rate: costForm.overhead_rate,
        support_time_pct: costForm.support_time_pct,
        ppc_budget: costForm.ppc_budget,
      }).eq('id', editingCost.id)
      error = updateError
      costEstimateId = editingCost.id
    } else {
      // Insert
      const { data: insertData, error: insertError } = await supabase.from('cost_estimates').insert({
        idea_id: product.id,
        created_by,
        tooling_cost: costForm.tooling_cost,
        marketing_budget: costForm.marketing_budget,
        marketing_cost_per_unit: costForm.marketing_cost_per_unit,
        overhead_rate: costForm.overhead_rate,
        support_time_pct: costForm.support_time_pct,
        ppc_budget: costForm.ppc_budget,
      }).select('id').single()
      error = insertError
      costEstimateId = insertData?.id
    }
    if (error) {
      setCostFormError(error.message)
      setCostFormLoading(false)
      return
    }
    // Save BOM parts
    if (costEstimateId) {
      // Delete existing BOM parts if editing
      if (editingCost) {
        await supabase.from('bom_parts').delete().eq('cost_estimate_id', costEstimateId)
      }
      // Insert new BOM parts
      const bomPartsToInsert = bomParts.filter(part => part.item && part.unit_cost > 0).map(part => ({
        cost_estimate_id: costEstimateId,
        item: part.item,
        unit_cost: part.unit_cost,
        quantity: part.quantity,
        cash_effect: part.cash_effect !== false
      }))
      if (bomPartsToInsert.length > 0) {
        const { error: bomError } = await supabase.from('bom_parts').insert(
          bomPartsToInsert.map(part => ({
            cost_estimate_id: costEstimateId,
            item: part.item,
            unit_cost: part.unit_cost,
            quantity: part.quantity,
            cash_effect: part.cash_effect !== false
          }))
        )
        if (bomError) {
          setCostFormError('Failed to save BOM parts: ' + bomError.message)
          setCostFormLoading(false)
          return
        }
      }
      // Save labor entries
      if (editingCost) {
        await supabase.from('labor_entries').delete().eq('cost_estimate_id', costEstimateId)
      }
      const laborEntriesToInsert = laborEntries.filter(entry => entry.activity_id && (entry.hours > 0 || entry.minutes > 0 || entry.seconds > 0))
      if (laborEntriesToInsert.length > 0) {
        const { error: laborError } = await supabase.from('labor_entries').insert(
          laborEntriesToInsert.map(entry => ({
            cost_estimate_id: costEstimateId,
            activity_id: entry.activity_id,
            hours: entry.hours,
            minutes: entry.minutes,
            seconds: entry.seconds
          }))
        )
        if (laborError) {
          setCostFormError('Failed to save labor entries: ' + laborError.message)
          setCostFormLoading(false)
          return
        }
      }
    }
    setShowCostModal(false)
    setEditingCost(null)
    setCostForm({ tooling_cost: 0, marketing_budget: 0, marketing_cost_per_unit: 0, overhead_rate: 0.2, support_time_pct: 0.2, ppc_budget: 0 })
    setBomParts([{ item: '', unit_cost: 0, quantity: 1, cash_effect: true }])
    setLaborEntries([{ activity_id: '', hours: 0, minutes: 0, seconds: 0 }])
    setCostFormLoading(false)
    // Refresh cost estimates
    supabase
      .from('cost_estimates')
      .select(`*, contributor:users!cost_estimates_created_by_fkey(full_name), bom_parts(*), labor_entries(*, activity:activity_rates(*))`)
      .eq('idea_id', product.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setCostEstimates(data || []))
    // Force a full page reload to ensure all state is fresh
    window.location.reload();
  }
  // Delete cost estimate
  const handleDeleteCost = async (costId: string) => {
    if (!window.confirm('Are you sure you want to delete this cost estimate?')) return
    await supabase.from('cost_estimates').delete().eq('id', costId)
    // Refresh cost estimates
    if (product?.id) {
      supabase
        .from('cost_estimates')
        .select(`*, contributor:users!cost_estimates_created_by_fkey(full_name), bom_parts(*), labor_entries(*, activity:activity_rates(*))`)
        .eq('idea_id', product.id)
        .order('created_at', { ascending: false })
        .then(({ data }) => setCostEstimates(data || []))
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-10 px-4 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600 mx-auto mb-4"></div>
        <div className="text-gray-500">Loading product...</div>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="max-w-4xl mx-auto py-10 px-4 text-center">
        <div className="text-red-500 font-semibold mb-2">{error || 'Product not found'}</div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      {/* Back to Dashboard */}
      <div className="mb-4">
        <button className="btn" onClick={() => router.push('/')}>{'<'} Back to Dashboard</button>
      </div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">{product?.title}</h1>
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span className="inline-block px-3 py-1 rounded-full bg-gray-100 font-medium text-cyan-700 border border-cyan-100">{product?.status}</span>
            <span>{product?.category}</span>
            <span>•</span>
            <span>Owner: {product?.owner_name}</span>
            <span>•</span>
            <span>Created: {product?.created_at ? new Date(product.created_at).toLocaleDateString() : ''}</span>
          </div>
        </div>
        {/* Status dropdown (editable) */}
        <div className="flex flex-col gap-1">
          <select
            className="input-field w-40"
            value={product?.status || 'Draft'}
            disabled={statusSaving || !product?.id}
            onChange={async (e) => {
              if (!product?.id) return
              setStatusSaving(true)
              setStatusError(null)
              const { error } = await supabase.from('ideas').update({ status: e.target.value }).eq('id', product.id)
              if (error) setStatusError(error.message)
              else setProduct(p => p ? { ...p, status: e.target.value } : p)
              setStatusSaving(false)
            }}
          >
            <option value="Draft">Draft</option>
            <option value="In Review">In Review</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
            <option value="Archived">Archived</option>
          </select>
          {statusSaving && <span className="text-xs text-gray-400">Saving...</span>}
          {statusError && <span className="text-xs text-red-500">{statusError}</span>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-8">
        {TABS.map(tab => (
          <button
            key={tab.key}
            className={`px-6 py-3 -mb-px text-lg font-medium border-b-2 transition-colors duration-150 ${
              activeTab === tab.key
                ? 'border-cyan-600 text-cyan-700 bg-white'
                : 'border-transparent text-gray-400 hover:text-cyan-600'
            }`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'overview' && (
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-semibold">Product Overview</h2>
              <button className="btn-secondary text-xs" onClick={() => setShowEditOverview(true)}>Edit</button>
            </div>
            <div className="mb-4">
              <div className="text-gray-700 mb-2"><strong>Description:</strong> {product?.description}</div>
              <div className="text-gray-700 mb-2"><strong>Positioning:</strong> {product?.positioning_statement}</div>
              <div className="text-gray-700 mb-2"><strong>Required Attributes:</strong> {product?.required_attributes}</div>
              <div className="text-gray-700 mb-2"><strong>Competitor Overview:</strong> {product?.competitor_overview}</div>
            </div>
            {/* Edit Overview Modal */}
            {showEditOverview && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
                <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full p-6 relative">
                  <button className="absolute top-2 right-2 text-gray-400 hover:text-gray-600" onClick={() => setShowEditOverview(false)}>&times;</button>
                  <h3 className="text-lg font-semibold mb-4">Edit Product Overview</h3>
                  <ProductIdeaForm
                    initialData={{
                      title: product?.title || '',
                      description: product?.description || '',
                      category: product?.category || '',
                      positioning_statement: product?.positioning_statement || '',
                      required_attributes: product?.required_attributes || '',
                      competitor_overview: product?.competitor_overview || '',
                    }}
                    isLoading={editOverviewLoading}
                    onComplete={async (data) => {
                      if (!product?.id) return
                      setEditOverviewLoading(true)
                      setEditOverviewError(null)
                      const { error } = await supabase.from('ideas').update(data).eq('id', product.id)
                      if (error) {
                        setEditOverviewError(error.message)
                        setEditOverviewLoading(false)
                        return
                      }
                      setProduct(p => p ? { ...p, ...data } : p)
                      setEditOverviewLoading(false)
                      setShowEditOverview(false)
                    }}
                  />
                  {editOverviewError && <div className="text-red-500 text-sm mt-2">{editOverviewError}</div>}
                </div>
              </div>
            )}
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-2">ROI Summary</h3>
              {product.roi_summary ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4 text-center">
                    <div className="text-xs text-gray-500">NPV</div>
                    <div className="text-xl font-bold text-cyan-700">${product.roi_summary?.npv?.toLocaleString?.() ?? '-'}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 text-center">
                    <div className="text-xs text-gray-500">IRR</div>
                    <div className="text-xl font-bold text-cyan-700">{product.roi_summary?.irr !== undefined ? (product.roi_summary.irr * 100).toFixed(1) + '%' : '-'}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 text-center">
                    <div className="text-xs text-gray-500">Break Even</div>
                    <div className="text-xl font-bold text-cyan-700">{product.roi_summary?.break_even_month ?? '-'} mo</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 text-center">
                    <div className="text-xs text-gray-500">Payback</div>
                    <div className="text-xl font-bold text-cyan-700">{product.roi_summary?.payback_period ?? '-'} yr</div>
                  </div>
                </div>
              ) : (
                <div className="text-gray-500">No ROI summary available.</div>
              )}
            </div>
          </div>
        )}
        {activeTab === 'forecast' && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Sales Forecasts</h2>
              <button className="btn-primary" onClick={() => setShowForecastModal(true)}>Add Forecast</button>
            </div>
            {/* Aggregated forecast summary by month */}
            <ForecastSummary forecasts={forecasts} />
            {loadingForecasts ? (
              <div className="text-gray-500">Loading forecasts...</div>
            ) : forecastError ? (
              <div className="text-red-500">{forecastError}</div>
            ) : forecasts.length === 0 ? (
              <div className="text-gray-500">No forecasts yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-2 text-left font-semibold">Contributor</th>
                      <th className="px-4 py-2 text-left font-semibold">Role</th>
                      <th className="px-4 py-2 text-left font-semibold">Channel/Customer</th>
                      <th className="px-4 py-2 text-left font-semibold">Monthly Forecasts</th>
                      <th className="px-4 py-2 text-left font-semibold">Created</th>
                      <th className="px-4 py-2 text-left font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecasts.map(forecast => (
                      <tr key={forecast.id} className="border-b">
                        <td className="px-4 py-2">{forecast.contributor?.full_name || 'Unknown'}</td>
                        <td className="px-4 py-2">{forecast.contributor_role}</td>
                        <td className="px-4 py-2">{forecast.channel_or_customer}</td>
                        <td className="px-4 py-2">
                          {Array.isArray(forecast.monthly_volume_estimate)
                            ? (
                              <table className="border text-xs">
                                <thead>
                                  <tr>
                                    <th className="px-1">Month</th>
                                    <th className="px-1">Units</th>
                                    <th className="px-1">Price</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {forecast.monthly_volume_estimate.map((m: any, i: number) => (
                                    <tr key={i}>
                                      <td className="px-1">{m.month_date ? new Date(m.month_date).toLocaleString('default', { year: 'numeric', month: 'short' }) : ''}</td>
                                      <td className="px-1">{m.units}</td>
                                      <td className="px-1">{m.price}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : '-'}
                        </td>
                        <td className="px-4 py-2">{forecast.created_at ? new Date(forecast.created_at).toLocaleDateString() : ''}</td>
                        <td className="px-4 py-2">
                          <button className="btn-secondary text-xs mr-2" onClick={() => handleEditForecast(forecast)}>Edit</button>
                          <button className="btn-danger text-xs" onClick={() => handleDeleteForecast(forecast.id)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {/* Forecast Modal */}
            {showForecastModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
                <div className="bg-white rounded-lg shadow-lg max-w-lg w-full max-h-[90vh] flex flex-col">
                  <div className="p-6 border-b border-gray-200">
                    <button className="absolute top-2 right-2 text-gray-400 hover:text-gray-600" onClick={handleCloseModal}>&times;</button>
                    <h3 className="text-lg font-semibold">{editingForecast ? 'Edit Sales Forecast' : 'Add Sales Forecast'}</h3>
                  </div>
                  <div className="p-6 overflow-y-auto flex-1">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Channel/Customer</label>
                        <input
                          className="input-field w-full"
                          value={forecastForm.channel_or_customer}
                          onChange={e => setForecastForm(f => ({ ...f, channel_or_customer: e.target.value }))}
                          placeholder="e.g. Amazon, Walmart, Direct, etc."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Contributor Role</label>
                        <input
                          className="input-field w-full"
                          value={forecastForm.contributor_role}
                          onChange={e => setForecastForm(f => ({ ...f, contributor_role: e.target.value }))}
                          placeholder="e.g. Sales, Marketing, etc."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Monthly Forecasts</label>
                        <div className="space-y-2">
                          <div className="flex gap-2 items-center font-semibold text-xs text-gray-600 mb-1">
                            <span className="w-32">Month</span>
                            <span className="w-20">Units <span className="text-gray-400">(to sell)</span></span>
                            <span className="w-20">Price <span className="text-gray-400">(per unit)</span></span>
                            <span className="w-8"></span>
                          </div>
                          {forecastForm.monthly_volume_estimate.map((row, idx) => (
                            <div key={idx} className="flex gap-2 items-center">
                              <input
                                type="month"
                                className="input-field w-32"
                                value={row.month_date}
                                onChange={e => handleMonthRowChange(idx, 'month_date', e.target.value)}
                                placeholder="Month"
                              />
                              <input
                                type="number"
                                className="input-field w-20"
                                min={0}
                                value={row.units}
                                onChange={e => handleMonthRowChange(idx, 'units', Number(e.target.value))}
                                placeholder="Units to sell"
                              />
                              <input
                                type="number"
                                className="input-field w-20"
                                min={0}
                                step={0.01}
                                value={row.price}
                                onChange={e => handleMonthRowChange(idx, 'price', Number(e.target.value))}
                                placeholder="Price per unit"
                              />
                              <button
                                className="text-red-500 hover:text-red-700 text-lg px-2"
                                onClick={() => handleRemoveMonthRow(idx)}
                                disabled={forecastForm.monthly_volume_estimate.length === 1}
                                title="Remove month"
                              >
                                &times;
                              </button>
                            </div>
                          ))}
                          <div className="flex gap-2 mt-2">
                            <button className="btn text-xs" type="button" onClick={handleAddMonthRow}>+ Add Month</button>
                            <button 
                              className="btn-secondary text-xs" 
                              type="button" 
                              onClick={() => setShowLevelLoadedForm(!showLevelLoadedForm)}
                            >
                              {showLevelLoadedForm ? 'Hide' : 'Show'} Level Loaded Forecast
                            </button>
                          </div>
                          
                          {/* Level Loaded Forecast Form */}
                          {showLevelLoadedForm && (
                            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 mt-2">
                              <div className="text-sm font-medium mb-2 text-gray-700">Quick Level Loaded Forecast</div>
                              <div className="grid grid-cols-2 gap-3 mb-3">
                                <div>
                                  <label className="block text-xs font-medium mb-1">Start Month</label>
                                  <input
                                    type="month"
                                    className="input-field w-full text-xs"
                                    value={levelLoadedForm.start_month}
                                    onChange={e => setLevelLoadedForm(prev => ({ ...prev, start_month: e.target.value }))}
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium mb-1">Number of Months</label>
                                  <input
                                    type="number"
                                    className="input-field w-full text-xs"
                                    min={1}
                                    max={60}
                                    value={levelLoadedForm.number_of_months}
                                    onChange={e => setLevelLoadedForm(prev => ({ ...prev, number_of_months: Number(e.target.value) }))}
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium mb-1">Units per Month</label>
                                  <input
                                    type="number"
                                    className="input-field w-full text-xs"
                                    min={0}
                                    value={levelLoadedForm.units_per_month}
                                    onChange={e => setLevelLoadedForm(prev => ({ ...prev, units_per_month: Number(e.target.value) }))}
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium mb-1">Price per Unit</label>
                                  <input
                                    type="number"
                                    className="input-field w-full text-xs"
                                    min={0}
                                    step={0.01}
                                    value={levelLoadedForm.price_per_unit}
                                    onChange={e => setLevelLoadedForm(prev => ({ ...prev, price_per_unit: Number(e.target.value) }))}
                                  />
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button 
                                  className="btn-primary text-xs" 
                                  onClick={handleGenerateLevelLoaded}
                                >
                                  Generate {levelLoadedForm.number_of_months} Months
                                </button>
                                <div className="text-xs text-gray-500 flex items-center">
                                  Total: ${(levelLoadedForm.units_per_month * levelLoadedForm.price_per_unit * levelLoadedForm.number_of_months).toLocaleString()}
                                </div>
                              </div>
                              {levelLoadedForm.start_month && levelLoadedForm.units_per_month > 0 && levelLoadedForm.price_per_unit > 0 && (
                                <div className="text-xs text-gray-600 mt-2">
                                  <div>Will generate: {levelLoadedForm.units_per_month} units × ${levelLoadedForm.price_per_unit} = ${(levelLoadedForm.units_per_month * levelLoadedForm.price_per_unit).toLocaleString()}/month</div>
                                  <div>From {new Date(levelLoadedForm.start_month + '-01').toLocaleString('default', { year: 'numeric', month: 'long' })} for {levelLoadedForm.number_of_months} months</div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      {formError && <div className="text-red-500 text-sm">{formError}</div>}
                    </div>
                  </div>
                  <div className="p-6 border-t border-gray-200">
                    <div className="flex justify-end gap-2">
                      <button className="btn" onClick={handleCloseModal} disabled={formLoading}>Cancel</button>
                      <button className="btn-primary" onClick={handleAddForecast} disabled={formLoading}>
                        {formLoading ? 'Saving...' : 'Add Forecast'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {activeTab === 'cost' && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Cost Estimates</h2>
              <button className="btn-primary" onClick={handleAddCost}>Add Cost Estimate</button>
            </div>
            {/* Suggested MSRP */}
            <SuggestedMSRP costEstimates={costEstimates} />
            {/* Cost summary */}
            <CostSummary costEstimates={costEstimates} />
            {loadingCosts ? (
              <div className="text-gray-500">Loading cost estimates...</div>
            ) : costError ? (
              <div className="text-red-500">{costError}</div>
            ) : costEstimates.length === 0 ? (
              <div className="text-gray-500">No cost estimates yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-2 text-left font-semibold">Contributor</th>
                      <th className="px-4 py-2 text-left font-semibold">Created</th>
                      <th className="px-4 py-2 text-left font-semibold">Tooling</th>
                      <th className="px-4 py-2 text-left font-semibold">Labor</th>
                      <th className="px-4 py-2 text-left font-semibold">Marketing</th>
                      <th className="px-4 py-2 text-left font-semibold">PPC</th>
                      <th className="px-4 py-2 text-left font-semibold">BOM Total</th>
                      <th className="px-4 py-2 text-left font-semibold">Total</th>
                      <th className="px-4 py-2 text-left font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {costEstimates.map(cost => {
                      // Calculate BOM total from bom_parts
                      const bomTotal = cost.bom_parts?.reduce((sum: number, part: any) => 
                        sum + (part.unit_cost || 0) * (part.quantity || 1), 0) || 0
                      
                      // Calculate labor total from labor_entries
                      const laborTotal = cost.labor_entries?.reduce((sum: number, entry: any) => {
                        const totalHours = (entry.hours || 0) + (entry.minutes || 0) / 60 + (entry.seconds || 0) / 3600
                        return sum + (totalHours * (entry.activity?.rate_per_hour || 0))
                      }, 0) || 0
                      
                      const total =
                        (Number(cost.tooling_cost) || 0) +
                        bomTotal +
                        laborTotal +
                        (Number(cost.marketing_budget) || 0) +
                        (Number(cost.ppc_budget) || 0)
                      
                      return (
                        <tr key={cost.id} className="border-b">
                          <td className="px-4 py-2">{cost.contributor?.full_name || 'Unknown'}</td>
                          <td className="px-4 py-2">{cost.created_at ? new Date(cost.created_at).toLocaleDateString() : ''}</td>
                          <td className="px-4 py-2">${Number(cost.tooling_cost).toLocaleString()}</td>
                          <td className="px-4 py-2">${laborTotal.toLocaleString()}</td>
                          <td className="px-4 py-2">${Number(cost.marketing_budget).toLocaleString()}</td>
                          <td className="px-4 py-2">${Number(cost.ppc_budget).toLocaleString()}</td>
                          <td className="px-4 py-2">${bomTotal.toLocaleString()}</td>
                          <td className="px-4 py-2 font-bold">${total.toLocaleString()}</td>
                          <td className="px-4 py-2">
                            <button className="btn-secondary text-xs mr-2" onClick={() => handleEditCost(cost)}>Edit</button>
                            <button className="btn-danger text-xs" onClick={() => handleDeleteCost(cost.id)}>Delete</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {/* Cost Modal */}
            {showCostModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
                <div className="bg-white rounded-lg shadow-lg max-w-lg w-full p-6 relative max-h-[90vh] overflow-y-auto">
                  <button className="absolute top-2 right-2 text-gray-400 hover:text-gray-600" onClick={handleCloseCostModal}>&times;</button>
                  <h3 className="text-lg font-semibold mb-4">{editingCost ? 'Edit Cost Estimate' : 'Add Cost Estimate'}</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Bill of Materials (BOM)</label>
                      <div className="space-y-2">
                        <div className="flex gap-2 items-center font-semibold text-xs text-gray-600 mb-1">
                          <span className="w-32">Item</span>
                          <span className="w-20">Unit Cost</span>
                          <span className="w-20">Quantity</span>
                          <span className="w-8"></span>
                        </div>
                        {bomParts.map((part, idx) => (
                          <div key={idx} className="flex gap-2 items-center">
                            <input
                              className="input-field w-32"
                              value={part.item}
                              onChange={e => handleBomPartChange(idx, 'item', e.target.value)}
                              placeholder="Item name"
                            />
                            <input
                              type="number"
                              className="input-field w-20"
                              min={0}
                              step={0.01}
                              value={part.unit_cost}
                              onChange={e => handleBomPartChange(idx, 'unit_cost', Number(e.target.value))}
                              placeholder="Unit Cost"
                            />
                            <input
                              type="number"
                              className="input-field w-20"
                              min={1}
                              value={part.quantity}
                              onChange={e => handleBomPartChange(idx, 'quantity', Number(e.target.value))}
                              placeholder="Qty"
                            />
                            <label className="flex items-center text-xs ml-2">
                              <input
                                type="checkbox"
                                checked={part.cash_effect !== false}
                                onChange={e => handleBomPartChange(idx, 'cash_effect', e.target.checked)}
                                className="mr-1"
                              />
                              Affects Cash Flow
                            </label>
                            <button
                              className="text-red-500 hover:text-red-700 text-lg px-2"
                              onClick={() => handleRemoveBomPart(idx)}
                              disabled={bomParts.length === 1}
                              title="Remove BOM part"
                            >
                              &times;
                            </button>
                          </div>
                        ))}
                        <button className="btn text-xs mt-2" type="button" onClick={handleAddBomPart}>+ Add BOM Part</button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Labor Entries</label>
                      <div className="space-y-2">
                        <div className="flex gap-2 items-center font-semibold text-xs text-gray-600 mb-1">
                          <span className="w-32">Activity</span>
                          <span className="w-16">Hours</span>
                          <span className="w-16">Minutes</span>
                          <span className="w-16">Seconds</span>
                          <span className="w-8"></span>
                        </div>
                        {laborEntries.map((entry, idx) => (
                          <div key={idx} className="flex gap-2 items-center">
                            <select
                              className="input-field w-32"
                              value={entry.activity_id}
                              onChange={e => handleLaborEntryChange(idx, 'activity_id', e.target.value)}
                            >
                              <option value="">Select Activity</option>
                              {activityRates.map(rate => (
                                <option key={rate.id} value={rate.id}>
                                  {rate.activity_name} (${rate.rate_per_hour}/hr)
                                </option>
                              ))}
                            </select>
                            <input
                              type="number"
                              className="input-field w-16"
                              min={0}
                              value={entry.hours}
                              onChange={e => handleLaborEntryChange(idx, 'hours', Number(e.target.value))}
                              placeholder="Hrs"
                            />
                            <input
                              type="number"
                              className="input-field w-16"
                              min={0}
                              max={59}
                              value={entry.minutes}
                              onChange={e => handleLaborEntryChange(idx, 'minutes', Number(e.target.value))}
                              placeholder="Min"
                            />
                            <input
                              type="number"
                              className="input-field w-16"
                              min={0}
                              max={59}
                              value={entry.seconds}
                              onChange={e => handleLaborEntryChange(idx, 'seconds', Number(e.target.value))}
                              placeholder="Sec"
                            />
                            <button
                              className="text-red-500 hover:text-red-700 text-lg px-2"
                              onClick={() => handleRemoveLaborEntry(idx)}
                              disabled={laborEntries.length === 1}
                              title="Remove labor entry"
                            >
                              &times;
                            </button>
                          </div>
                        ))}
                        <button className="btn text-xs mt-2" type="button" onClick={handleAddLaborEntry}>+ Add Labor Entry</button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Tooling Cost / Inventory Investment</label>
                        <input
                          type="number"
                          className="input-field w-full"
                          min={0}
                          step={0.01}
                          value={costForm.tooling_cost}
                          onChange={e => setCostForm(f => ({ ...f, tooling_cost: Number(e.target.value) }))}
                          placeholder="Tooling Cost"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Marketing Budget per Month</label>
                        <input
                          type="number"
                          className="input-field w-full"
                          min={0}
                          step={0.01}
                          value={costForm.marketing_budget}
                          onChange={e => setCostForm(f => ({ ...f, marketing_budget: Number(e.target.value) }))}
                          placeholder="Marketing Budget"
                        />
                      </div>
                      {/* <div>
                        <label className="block text-sm font-medium mb-1">Marketing Cost per Unit</label>
                        <input
                          type="number"
                          className="input-field w-full"
                          min={0}
                          step={0.01}
                          value={costForm.marketing_cost_per_unit}
                          onChange={e => setCostForm(f => ({ ...f, marketing_cost_per_unit: Number(e.target.value) }))}
                          placeholder="Marketing Cost per Unit"
                        />
                      </div> */}
                      <div>
                        <label className="block text-sm font-medium mb-1">Customer Acquisition Cost (CAC) per Unit ($)</label>
                        <input
                          type="number"
                          className="input-field w-full"
                          min={0}
                          step={0.01}
                          value={costForm.ppc_budget}
                          onChange={e => setCostForm(f => ({ ...f, ppc_budget: Number(e.target.value) }))}
                          placeholder="CAC per unit"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Overhead Rate ($/hr)</label>
                        <input
                          type="number"
                          className="input-field w-full"
                          min={0}
                          step={0.01}
                          value={costForm.overhead_rate}
                          onChange={e => setCostForm(f => ({ ...f, overhead_rate: Number(e.target.value) }))}
                          placeholder="Overhead Rate $/hr"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Support Time (%)</label>
                        <input
                          type="number"
                          className="input-field w-full"
                          min={0}
                          max={100}
                          step={0.1}
                          value={costForm.support_time_pct * 100}
                          onChange={e => setCostForm(f => ({ ...f, support_time_pct: Number(e.target.value) / 100 }))}
                          placeholder="Support Time %"
                        />
                      </div>
                    </div>
                    {costFormError && <div className="text-red-500 text-sm">{costFormError}</div>}
                    <div className="flex justify-end gap-2 mt-4">
                      <button className="btn" onClick={handleCloseCostModal} disabled={costFormLoading}>Cancel</button>
                      <button className="btn-primary" onClick={handleSaveCost} disabled={costFormLoading}>
                        {costFormLoading ? 'Saving...' : (editingCost ? 'Save Changes' : 'Add Cost Estimate')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {activeTab === 'finalize' && (
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Finalize ROI</h2>
            <ROICalculator
              forecasts={forecasts}
              costEstimates={costEstimates}
              roiSummary={roiSummary}
              onSave={async (roi: any) => {
                setSavingROI(true)
                setSaveROIError(null)
                const { error } = await supabase.from('roi_summaries').insert({
                  idea_id: product.id,
                  ...roi,
                  assumptions: roi.assumptions,
                })
                if (error) {
                  setSaveROIError(error.message)
                  setSavingROI(false)
                  return
                }
                setRoiSummary(roi)
                // Fetch organization members to email
                const { data: users } = await supabase
                  .from('users')
                  .select('email')
                  .eq('organization_id', product.organization_id!)
                const recipients = users?.map(u => u.email).filter(Boolean) || []
                if (recipients.length) {
                  await fetch('/api/send-roi-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      product,
                      roi,
                      cost: costEstimates[0] || {},
                      recipients,
                    }),
                  })
                }
                setSavingROI(false)
              }}
              saving={savingROI}
              saveError={saveROIError}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function ForecastSummary({ forecasts }: { forecasts: any[] }) {
  // Aggregate all monthly_volume_estimate entries by month_date
  const monthMap: Record<string, { total: number, units: number, price: number }> = {}
  let grandTotal = 0
  forecasts.forEach(forecast => {
    if (Array.isArray(forecast.monthly_volume_estimate)) {
      forecast.monthly_volume_estimate.forEach((m: any) => {
        if (m.month_date && m.units && m.price) {
          if (!monthMap[m.month_date]) {
            monthMap[m.month_date] = { total: 0, units: 0, price: 0 }
          }
          const sales = m.units * m.price
          monthMap[m.month_date].total += sales
          monthMap[m.month_date].units += m.units
          monthMap[m.month_date].price += m.price
          grandTotal += sales
        }
      })
    }
  })
  const sortedMonths = Object.keys(monthMap).sort()
  if (sortedMonths.length === 0) return null
  return (
    <div className="mb-4">
      <div className="text-lg font-bold text-cyan-700 mb-1">Total Forecasted Sales: ${grandTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
      <h4 className="font-semibold text-sm mb-1">Total Estimated Sales by Month</h4>
      <table className="text-xs border mb-2">
        <thead>
          <tr className="bg-gray-50">
            <th className="px-2 py-1 text-left">Month</th>
            <th className="px-2 py-1 text-right">Total Sales</th>
          </tr>
        </thead>
        <tbody>
          {sortedMonths.map(month => (
            <tr key={month}>
              <td className="px-2 py-1">{new Date(month + '-01').toLocaleString('default', { year: 'numeric', month: 'short' })}</td>
              <td className="px-2 py-1 text-right">${monthMap[month].total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CostSummary({ costEstimates }: { costEstimates: any[] }) {
  // Show the sum of the latest cost estimate (or all, if you want)
  if (!costEstimates.length) return null
  // Use the latest estimate for summary
  const latest = costEstimates[0]
  
  // Calculate BOM total from bom_parts table
  const bomTotal = latest.bom_parts?.reduce((sum: number, part: any) => 
    sum + (part.unit_cost || 0) * (part.quantity || 1), 0) || 0
  
  // Calculate labor total from labor_entries table
  const laborTotal = latest.labor_entries?.reduce((sum: number, entry: any) => {
    const totalHours = (entry.hours || 0) + (entry.minutes || 0) / 60 + (entry.seconds || 0) / 3600
    return sum + (totalHours * (entry.activity?.rate_per_hour || 0))
  }, 0) || 0
  
  const total =
    (Number(latest.tooling_cost) || 0) +
    bomTotal +
    laborTotal +
    (Number(latest.marketing_budget) || 0) +
    (Number(latest.ppc_budget) || 0)
  
  return (
    <div className="mb-4">
      <div className="text-lg font-bold text-cyan-700 mb-1">Latest Total Cost Estimate: ${total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
      <div className="text-xs text-gray-500">
        Includes BOM (${bomTotal.toLocaleString()}), Labor (${laborTotal.toLocaleString()}), Tooling (${Number(latest.tooling_cost || 0).toLocaleString()}), Marketing (${Number(latest.marketing_budget || 0).toLocaleString()}), and PPC (${Number(latest.ppc_budget || 0).toLocaleString()}).
      </div>
    </div>
  )
}

import { useMemo } from 'react'
function ROICalculator({ forecasts, costEstimates, roiSummary, onSave, saving, saveError }: {
  forecasts: any[],
  costEstimates: any[],
  roiSummary: any,
  onSave: (roi: any) => void,
  saving: boolean,
  saveError: string | null,
}) {
  const salesByMonth = useMemo(() => {
    const map: Record<string, { units: number, sales: number }> = {}
    forecasts.forEach(forecast => {
      if (Array.isArray(forecast.monthly_volume_estimate)) {
        forecast.monthly_volume_estimate.forEach((m: any) => {
          if (m.month_date && m.units && m.price) {
            if (!map[m.month_date]) map[m.month_date] = { units: 0, sales: 0 }
            map[m.month_date].units += m.units
            map[m.month_date].sales += m.units * m.price
          }
        })
      }
    })
    return map
  }, [forecasts])
  const months = Object.keys(salesByMonth).sort()
  const firstMonth = months[0]
  const cost = costEstimates[0] || {}
  // BOM cost per unit (sum of all parts * their quantity)
  const bomUnitCost = cost.bom_parts?.filter((part: any) => part.cash_effect !== false).reduce((sum: number, part: any) => sum + (part.unit_cost || 0) * (part.quantity || 1), 0) || 0
  // Calculate labor cost per unit (sum of all labor entries per unit)
  const laborCostPerUnit = cost.labor_entries?.reduce((sum: number, entry: any) => {
    const timePerUnit = (entry.hours || 0) + (entry.minutes || 0) / 60 + (entry.seconds || 0) / 3600;
    return sum + timePerUnit * (entry.activity?.rate_per_hour || 0);
  }, 0) || 0;
  // We'll distribute total labor hours across all forecasted units
  const totalLaborHours = cost.labor_entries?.reduce((sum: number, entry: any) => {
    return sum + ((entry.hours || 0) + (entry.minutes || 0) / 60 + (entry.seconds || 0) / 3600)
  }, 0) || 0
  const totalLaborCost = cost.labor_entries?.reduce((sum: number, entry: any) => {
    const hours = (entry.hours || 0) + (entry.minutes || 0) / 60 + (entry.seconds || 0) / 3600
    return sum + hours * (entry.activity?.rate_per_hour || 0)
  }, 0) || 0
  const totalUnits = Object.values(salesByMonth).reduce((sum, m) => sum + m.units, 0) || 1
  const laborUnitCost = totalLaborCost / totalUnits
  // Overhead and support rates
  const overheadRate = Number(cost.overhead_rate) || 60
  const supportPct = Number(cost.support_time_pct) || 0.2
  // Upfront cost (tooling only in month 0)
  const upfrontCost = Number(cost.tooling_cost) || 0
  // Marketing and PPC (flat per month)
  const marketingPerMonth = Number(cost.marketing_budget) || 0
  const ppcPerMonth = Number(cost.ppc_budget) || 0
  // Cash flows
  const cashFlows: { month: string, total: number, sales: number, marketing: number, cac: number, costOfSales: number, labor: number, overhead: number, support: number, tooling: number }[] = []
  if (firstMonth) {
    // Month 0: upfront costs only
    cashFlows.push({
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
    })
    months.forEach((month, i) => {
      const { units, sales } = salesByMonth[month] || { units: 0, sales: 0 }
      // BOM cost for this month
      const bomCost = units * bomUnitCost
      // Labor cost for this month (per-unit labor cost * units sold)
      const laborCost = units * laborCostPerUnit
      // Total labor hours for this month (for overhead/support)
      const laborHoursMonth = cost.labor_entries?.reduce((sum: number, entry: any) => {
        const timePerUnit = (entry.hours || 0) + (entry.minutes || 0) / 60 + (entry.seconds || 0) / 3600;
        return sum + timePerUnit * units;
      }, 0) || 0;
      // Overhead for this month
      const overhead = laborHoursMonth * overheadRate
      // Support for this month (use same rate as overhead)
      const support = laborHoursMonth * supportPct * overheadRate
      // Cost of sales (BOM only)
      const costOfSales = bomCost
      // Marketing and CAC (per month and per unit)
      const marketing = marketingPerMonth
      const cac = ppcPerMonth * units
      // Tooling is only in month 0
      const tooling = 0
      // Total cash flow
      const total = sales - marketing - cac - costOfSales - laborCost - overhead - support - tooling
      cashFlows.push({
        month: new Date(month + '-01').toLocaleString('default', { year: 'numeric', month: 'short' }),
        total,
        sales,
        marketing,
        cac,
        costOfSales,
        labor: laborCost,
        overhead,
        support,
        tooling,
      })
    })
  }
  // NPV calculation (10% discount rate)
  const discountRate = 0.10/12
  let npv = 0
  cashFlows.forEach((cf, i) => {
    npv += cf.total / Math.pow(1 + discountRate, i)
  })
  // IRR calculation (simple, using Newton's method or fallback)
  function calcIRR(cashFlows: number[], guess = 0.1) {
    let x0 = guess
    for (let iter = 0; iter < 100; iter++) {
      let f = 0, df = 0
      for (let t = 0; t < cashFlows.length; t++) {
        f += cashFlows[t] / Math.pow(1 + x0, t)
        df += -t * cashFlows[t] / Math.pow(1 + x0, t + 1)
      }
      const x1 = x0 - f / df
      if (Math.abs(x1 - x0) < 1e-6) return x1
      x0 = x1
    }
    return x0
  }
  const irr = cashFlows.length > 1 ? calcIRR(cashFlows.map(cf => cf.total)) : 0
  // Cap IRR at 3 (300%) for display
  const irrCapped = Math.min(irr, 3)
  // Break-even month
  let cumulative = 0, breakEvenMonth = 0
  for (let i = 0; i < cashFlows.length; i++) {
    cumulative += cashFlows[i].total
    if (cumulative >= 0) {
      breakEvenMonth = i
      break
    }
  }
  // Payback period (in years)
  let paybackPeriod = 0
  cumulative = 0
  for (let i = 0; i < cashFlows.length; i++) {
    cumulative += cashFlows[i].total
    if (cumulative >= 0) {
      paybackPeriod = i / 12
      break
    }
  }
  // Assumptions
  const assumptions = {
    upfrontCost,
    discountRate,
    firstMonth,
    months,
    note: 'Tooling cost is upfront. Cost of sales = BOM + labor. Overhead and support are based on labor hours. Marketing and PPC are monthly.'
  }
  // Per-unit summary
  const avgPrice = totalUnits ? Object.values(salesByMonth).reduce((a, m) => a + m.sales, 0) / totalUnits : 0
  const contributionMarginPerUnit = avgPrice - (bomUnitCost + laborUnitCost)
  const profitPerUnit = contributionMarginPerUnit
  const isDifferent = !roiSummary ||
    Number(roiSummary.npv).toFixed(2) !== npv.toFixed(2) ||
    Number(roiSummary.irr).toFixed(4) !== irr.toFixed(4) ||
    Number(roiSummary.break_even_month) !== breakEvenMonth ||
    Number(roiSummary.payback_period).toFixed(2) !== paybackPeriod.toFixed(2) ||
    Number(roiSummary.contribution_margin_per_unit).toFixed(2) !== contributionMarginPerUnit.toFixed(2) ||
    Number(roiSummary.profit_per_unit).toFixed(2) !== profitPerUnit.toFixed(2)
  const handleSave = () => {
    onSave({
      npv: Number(npv.toFixed(2)),
      irr: Math.min(Number(irr.toFixed(4)), 3), // Cap at 3 (300%) before saving
      break_even_month: breakEvenMonth,
      payback_period: Number(paybackPeriod.toFixed(2)),
      contribution_margin_per_unit: Number(contributionMarginPerUnit.toFixed(2)),
      profit_per_unit: Number(profitPerUnit.toFixed(2)),
      assumptions,
    })
  }
  return (
    <div>
      <div className="mb-4">
        <div className="text-lg font-bold text-cyan-700 mb-1">Calculated ROI Summary</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-2">
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <div className="text-xs text-gray-500">NPV</div>
            <div className="text-xl font-bold text-cyan-700">${npv.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <div className="text-xs text-gray-500">IRR</div>
            <div className="text-xl font-bold text-cyan-700">{irr > 3 ? '300%+' : (irrCapped * 100).toFixed(1) + '%'}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <div className="text-xs text-gray-500">Break Even</div>
            <div className="text-xl font-bold text-cyan-700">{breakEvenMonth} mo</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <div className="text-xs text-gray-500">Payback</div>
            <div className="text-xl font-bold text-cyan-700">{paybackPeriod.toFixed(2)} yr</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center col-span-2 sm:col-span-1">
            <div className="text-xs text-gray-500">Contribution Margin / Unit</div>
            <div className="text-xl font-bold text-cyan-700">${contributionMarginPerUnit.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center col-span-2 sm:col-span-1">
            <div className="text-xs text-gray-500">Profit / Unit</div>
            <div className="text-xl font-bold text-cyan-700">${profitPerUnit.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
          </div>
        </div>
        <div className="text-xs text-gray-500 mb-2">Assumptions: {assumptions.note}</div>
        <div className="text-xs text-gray-500 mb-2">Discount Rate: {(discountRate * 100).toFixed(1)}%</div>
        <div className="text-xs text-gray-500 mb-2">Upfront Cost: ${upfrontCost.toLocaleString()}</div>
        <div className="text-xs text-gray-500 mb-2">Monthly Cost: ${marketingPerMonth.toLocaleString()}</div>
      </div>
      <div className="mb-4">
        <div className="font-semibold text-sm mb-1">Cash Flows</div>
        <table className="text-xs border mb-2">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-2 py-1 text-right">Total Cash Flow</th>
              <th className="px-2 py-1 text-right">Sales</th>
              <th className="px-2 py-1 text-right">Marketing</th>
              <th className="px-2 py-1 text-right">CAC</th>
              <th className="px-2 py-1 text-right">Cost of Sales</th>
              <th className="px-2 py-1 text-right">Labor</th>
              <th className="px-2 py-1 text-right">Overhead</th>
              <th className="px-2 py-1 text-right">Support</th>
              <th className="px-2 py-1 text-right">Tooling</th>
              <th className="px-2 py-1 text-left">Month</th>
            </tr>
          </thead>
          <tbody>
            {cashFlows.map((cf, i) => (
              <tr key={i}>
                <td className="px-2 py-1 text-right font-bold">${cf.total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                <td className="px-2 py-1 text-right">{cf.sales ? `$${cf.sales.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '-'}</td>
                <td className="px-2 py-1 text-right">{cf.marketing ? `$${cf.marketing.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '-'}</td>
                <td className="px-2 py-1 text-right">{cf.cac ? `$${cf.cac.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '-'}</td>
                <td className="px-2 py-1 text-right">{cf.costOfSales ? `$${cf.costOfSales.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '-'}</td>
                <td className="px-2 py-1 text-right">{cf.labor ? `$${cf.labor.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '-'}</td>
                <td className="px-2 py-1 text-right">{cf.overhead ? `$${cf.overhead.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '-'}</td>
                <td className="px-2 py-1 text-right">{cf.support ? `$${cf.support.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '-'}</td>
                <td className="px-2 py-1 text-right">{cf.tooling ? `$${cf.tooling.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '-'}</td>
                <td className="px-2 py-1">{cf.month}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isDifferent ? (
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {roiSummary ? (saving ? 'Updating...' : 'Update ROI Summary') : (saving ? 'Saving...' : 'Save ROI Summary')}
        </button>
      ) : (
        <div className="text-green-600 font-semibold">ROI summary already saved for this idea.</div>
      )}
      {saveError && <div className="text-red-500 text-sm mt-2">{saveError}</div>}
    </div>
  )
} 

// Add this component above CostSummary
function SuggestedMSRP({ costEstimates }: { costEstimates: any[] }) {
  if (!costEstimates.length) return null
  const latest = costEstimates[0]
  // Calculate BOM total from bom_parts (only those with cash_effect !== false)
  const bomTotal = latest.bom_parts?.filter((part: any) => part.cash_effect !== false).reduce((sum: number, part: any) => 
    sum + (part.unit_cost || 0) * (part.quantity || 1), 0) || 0
  // Calculate labor total from labor_entries
  const laborTotal = latest.labor_entries?.reduce((sum: number, entry: any) => {
    const totalHours = (entry.hours || 0) + (entry.minutes || 0) / 60 + (entry.seconds || 0) / 3600
    return sum + (totalHours * (entry.activity?.rate_per_hour || 0))
  }, 0) || 0
  // Calculate total labor hours for support/overhead
  const totalLaborHours = latest.labor_entries?.reduce((sum: number, entry: any) => {
    return sum + ((entry.hours || 0) + (entry.minutes || 0) / 60 + (entry.seconds || 0) / 3600)
  }, 0) || 0
  const overheadRate = Number(latest.overhead_rate) || 60
  const supportPct = Number(latest.support_time_pct) || 0.2
  const overhead = totalLaborHours * overheadRate
  const support = totalLaborHours * supportPct * overheadRate
  // MSRP calculation
  const msrp = (bomTotal + laborTotal + support + overhead) / 0.45
  return (
    <div className="mb-4">
      <div className="text-lg font-bold text-cyan-700 mb-1">
        Suggested MSRP: ${msrp.toLocaleString(undefined, { maximumFractionDigits: 2 })}
      </div>
      <div className="text-xs text-gray-500 mb-2">
        (Calculated as (BOM + Labor + Support + Overhead) / 0.45 for a 55% gross margin)
      </div>
    </div>
  )
}