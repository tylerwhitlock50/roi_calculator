'use client'

import React, { useEffect, useState } from 'react'

import BlankNumberInput, { blankableNumberToNumber, type BlankableNumber } from '@/components/BlankNumberInput'
import LoadingSpinner from '@/components/LoadingSpinner'
import { apiFetch, type ActivityRateRecord, type AdminUserRecord, type CategoryOptionRecord } from '@/lib/api'

type ActivityRateDraft = {
  activityName: string
  ratePerHour: BlankableNumber
}

function createInitialRateDraft(): ActivityRateDraft {
  return {
    activityName: '',
    ratePerHour: '',
  }
}

export default function AdminDashboard() {
  const [users, setUsers] = useState<AdminUserRecord[]>([])
  const [rates, setRates] = useState<ActivityRateRecord[]>([])
  const [categories, setCategories] = useState<CategoryOptionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draftRate, setDraftRate] = useState<ActivityRateDraft>(createInitialRateDraft)
  const [editingRateId, setEditingRateId] = useState<string | null>(null)
  const [draftCategory, setDraftCategory] = useState('')
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)

  useEffect(() => {
    void loadAdminData()
  }, [])

  const loadAdminData = async () => {
    try {
      setLoading(true)
      setError(null)
      const [usersPayload, ratesPayload, categoriesPayload] = await Promise.all([
        apiFetch<AdminUserRecord[]>('/api/admin/users'),
        apiFetch<ActivityRateRecord[]>('/api/admin/activity-rates'),
        apiFetch<CategoryOptionRecord[]>('/api/admin/categories'),
      ])
      setUsers(usersPayload)
      setRates(ratesPayload)
      setCategories(categoriesPayload)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load admin data')
    } finally {
      setLoading(false)
    }
  }

  const saveRate = async () => {
    try {
      if (!draftRate.activityName.trim()) {
        return
      }

      const normalizedRatePerHour = blankableNumberToNumber(draftRate.ratePerHour)

      if (editingRateId) {
        await apiFetch<ActivityRateRecord>('/api/admin/activity-rates', {
          method: 'PATCH',
          body: JSON.stringify({
            id: editingRateId,
            activityName: draftRate.activityName,
            ratePerHour: normalizedRatePerHour,
          }),
        })
      } else {
        await apiFetch<ActivityRateRecord>('/api/admin/activity-rates', {
          method: 'POST',
          body: JSON.stringify({
            activityName: draftRate.activityName,
            ratePerHour: normalizedRatePerHour,
          }),
        })
      }

      setDraftRate(createInitialRateDraft())
      setEditingRateId(null)
      await loadAdminData()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save activity rate')
    }
  }

  const editRate = (rate: ActivityRateRecord) => {
    setEditingRateId(rate.id)
    setDraftRate({
      activityName: rate.activityName,
      ratePerHour: rate.ratePerHour,
    })
  }

  const deleteRate = async (id: string) => {
    try {
      await apiFetch('/api/admin/activity-rates', {
        method: 'DELETE',
        body: JSON.stringify({ id }),
      })
      await loadAdminData()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete activity rate')
    }
  }

  const saveCategory = async () => {
    try {
      if (!draftCategory.trim()) {
        return
      }

      if (editingCategoryId) {
        await apiFetch<CategoryOptionRecord>('/api/admin/categories', {
          method: 'PATCH',
          body: JSON.stringify({
            id: editingCategoryId,
            name: draftCategory,
          }),
        })
      } else {
        await apiFetch<CategoryOptionRecord>('/api/admin/categories', {
          method: 'POST',
          body: JSON.stringify({ name: draftCategory }),
        })
      }

      setDraftCategory('')
      setEditingCategoryId(null)
      await loadAdminData()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save category')
    }
  }

  const editCategory = (category: CategoryOptionRecord) => {
    setEditingCategoryId(category.id)
    setDraftCategory(category.name)
  }

  const deleteCategory = async (id: string) => {
    try {
      await apiFetch('/api/admin/categories', {
        method: 'DELETE',
        body: JSON.stringify({ id }),
      })
      await loadAdminData()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete category')
    }
  }

  if (loading) {
    return <LoadingSpinner message="Loading admin workspace..." size="md" />
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-8 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary-700">Admin</p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-900">Workspace control room</h2>
            <p className="mt-3 max-w-2xl text-sm text-slate-600">
              Keep planning categories, labor rates, and account access aligned across the ROI workspace.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricTile label="Active users" value={String(users.filter((user) => user.isActive).length)} />
            <MetricTile label="Rate cards" value={String(rates.length)} />
            <MetricTile label="Categories" value={String(categories.length)} />
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          {error}
        </div>
      )}

      <section className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="card space-y-6">
          <div>
            <h3 className="text-2xl font-semibold text-slate-900">Team accounts</h3>
            <p className="mt-2 text-sm text-slate-500">Workspace accounts are listed here. Credentials are still managed through the seed script for now.</p>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{user.fullName}</td>
                    <td className="px-4 py-3 text-slate-600">{user.email}</td>
                    <td className="px-4 py-3 capitalize text-slate-600">{user.role}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                        user.isActive ? 'bg-success-100 text-success-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {user.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-8">
          <div className="card space-y-6">
            <div>
              <h3 className="text-2xl font-semibold text-slate-900">Planning categories</h3>
              <p className="mt-2 text-sm text-slate-500">Use these categories in idea intake so overview framing stays consistent.</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="form-group mb-0">
                <label className="form-label" htmlFor="category-name">
                  Category name
                </label>
                <input
                  id="category-name"
                  value={draftCategory}
                  onChange={(event) => setDraftCategory(event.target.value)}
                  className="input-field"
                  placeholder="Example: Optics or Apparel"
                />
              </div>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <button onClick={saveCategory} className="btn-primary sm:max-w-[220px]">
                  {editingCategoryId ? 'Update category' : 'Add category'}
                </button>
                {editingCategoryId && (
                  <button
                    onClick={() => {
                      setDraftCategory('')
                      setEditingCategoryId(null)
                    }}
                    className="btn-secondary"
                  >
                    Cancel edit
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {categories.map((category) => (
                <div key={category.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-medium text-slate-900">{category.name}</div>
                    <div className="text-sm text-slate-500">Available in the product overview and intake flow.</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => editCategory(category)} className="btn-secondary text-sm">
                      Edit
                    </button>
                    <button onClick={() => void deleteCategory(category.id)} className="btn-danger text-sm">
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card space-y-6">
            <div>
              <h3 className="text-2xl font-semibold text-slate-900">Activity rates</h3>
              <p className="mt-2 text-sm text-slate-500">Use these hourly rates across cost estimates and ROI calculations.</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                <div className="form-group mb-0">
                  <label className="form-label" htmlFor="activity-rate-name">
                    Activity name
                  </label>
                  <input
                    id="activity-rate-name"
                    value={draftRate.activityName}
                    onChange={(event) => setDraftRate((current) => ({ ...current, activityName: event.target.value }))}
                    className="input-field"
                    placeholder="Example: CNC setup or Packaging"
                  />
                </div>
                <div className="form-group mb-0">
                  <label className="form-label" htmlFor="activity-rate-hourly">
                    Hourly rate
                  </label>
                  <BlankNumberInput
                    id="activity-rate-hourly"
                    min={0}
                    step={0.01}
                    value={draftRate.ratePerHour}
                    onChange={(value) => setDraftRate((current) => ({ ...current, ratePerHour: value }))}
                    className="input-field"
                    placeholder="Example: 85"
                  />
                </div>
              </div>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <button onClick={saveRate} className="btn-primary sm:max-w-[220px]">
                  {editingRateId ? 'Update rate' : 'Add rate'}
                </button>
                {editingRateId && (
                  <button
                    onClick={() => {
                      setDraftRate(createInitialRateDraft())
                      setEditingRateId(null)
                    }}
                    className="btn-secondary"
                  >
                    Cancel edit
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {rates.map((rate) => (
                <div key={rate.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-medium text-slate-900">{rate.activityName}</div>
                    <div className="text-sm text-slate-500">${rate.ratePerHour.toFixed(2)} / hour</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => editRate(rate)} className="btn-secondary text-sm">
                      Edit
                    </button>
                    <button onClick={() => void deleteRate(rate.id)} className="btn-danger text-sm">
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <div className="text-xs uppercase tracking-[0.24em] text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
    </div>
  )
}
