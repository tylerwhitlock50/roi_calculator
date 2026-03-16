'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'

import LoadingSpinner from '@/components/LoadingSpinner'
import { apiFetch, type IdeaRecord } from '@/lib/api'

interface ProjectDashboardProps {
  onCreateNew: () => void
}

export default function ProjectDashboard({ onCreateNew }: ProjectDashboardProps) {
  const [projects, setProjects] = useState<IdeaRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    void loadProjects()
  }, [])

  const loadProjects = async () => {
    try {
      setLoading(true)
      setError(null)
      const payload = await apiFetch<IdeaRecord[]>('/api/ideas')
      setProjects(payload)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load ideas')
    } finally {
      setLoading(false)
    }
  }

  const filteredProjects = projects.filter((project) => {
    const matchesSearch =
      project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = !statusFilter || project.status === statusFilter
    return matchesSearch && matchesStatus
  })

  if (loading) {
    return <LoadingSpinner message="Loading projects..." size="md" />
  }

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-900 px-8 py-10 text-white shadow-2xl">
        <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.35),_transparent_55%)]" />
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-4">
            <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-100">
              Local ROI Workspace
            </span>
            <div className="space-y-3">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Shape product bets with a fast local workflow.</h2>
              <p className="max-w-xl text-sm text-slate-200 sm:text-base">
                Ideas, forecasts, costs, and ROI live in your local SQLite app now. Start new concepts quickly and keep the financial story in one place.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Ideas" value={String(projects.length)} />
            <StatCard
              label="Approved"
              value={String(projects.filter((project) => project.status === 'approved').length)}
            />
            <button
              onClick={onCreateNew}
              className="rounded-2xl border border-cyan-300/40 bg-cyan-400/15 px-5 py-4 text-left transition hover:bg-cyan-400/25"
            >
              <div className="text-xs uppercase tracking-[0.22em] text-cyan-100">Action</div>
              <div className="mt-1 text-lg font-semibold">Create idea</div>
            </button>
          </div>
        </div>
      </section>

      <section className="card space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Project pipeline</h2>
            <p className="text-sm text-slate-500">Review active concepts and jump directly into forecasts, costs, and ROI.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="form-group mb-0">
              <label className="form-label" htmlFor="project-search">
                Search ideas
              </label>
              <input
                id="project-search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="input-field min-w-[240px]"
                placeholder="Search title or description"
              />
            </div>
            <div className="form-group mb-0">
              <label className="form-label" htmlFor="project-status-filter">
                Filter by status
              </label>
              <select
                id="project-status-filter"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="input-field min-w-[180px]"
              >
                <option value="">All statuses</option>
                <option value="draft">Draft</option>
                <option value="in_review">In review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
            {error}
          </div>
        )}

        {filteredProjects.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-8 py-12 text-center">
            <h3 className="text-xl font-semibold text-slate-900">No ideas yet</h3>
            <p className="mt-2 text-sm text-slate-500">Start with a new product concept and flesh it out with forecasts and cost models.</p>
            <button onClick={onCreateNew} className="btn-primary mt-6 max-w-xs">
              Create your first idea
            </button>
          </div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-2">
            {filteredProjects.map((project) => (
              <Link
                key={project.id}
                href={`/products/${project.id}`}
                className="group rounded-[26px] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium capitalize text-slate-700">
                      {project.status.replace('_', ' ')}
                    </span>
                    <h3 className="text-xl font-semibold text-slate-900 transition group-hover:text-primary-700">
                      {project.title}
                    </h3>
                    <p className="line-clamp-3 text-sm text-slate-600">{project.description}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-950 px-4 py-3 text-right text-white">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-slate-300">NPV</div>
                    <div className="mt-1 text-lg font-semibold">
                      {project.roiSummary ? formatCurrency(project.roiSummary.npv) : 'Pending'}
                    </div>
                  </div>
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <MetaChip label="Category" value={project.category} />
                  <MetaChip
                    label="IRR"
                    value={project.roiSummary ? `${(project.roiSummary.irr * 100).toFixed(1)}%` : 'Pending'}
                  />
                  <MetaChip label="Owner" value={project.owner.fullName} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-4 backdrop-blur">
      <div className="text-xs uppercase tracking-[0.22em] text-slate-300">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-white">{value}</div>
    </div>
  )
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-3">
      <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-medium text-slate-900">{value}</div>
    </div>
  )
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}
