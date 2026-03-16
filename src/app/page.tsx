'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import AdminDashboard from '@/components/AdminDashboard'
import LoadingSpinner from '@/components/LoadingSpinner'
import ProductIdeaForm, { type ProductIdeaFormData } from '@/components/ProductIdeaForm'
import ProjectDashboard from '@/components/ProjectDashboard'
import { apiFetch, type IdeaRecord } from '@/lib/api'
import { useAppStore } from '@/lib/store'

export default function HomePage() {
  const router = useRouter()
  const {
    user,
    isAuthenticated,
    authChecked,
    isLoading,
    currentView,
    error,
    initializeAuth,
    signIn,
    signOut,
    setCurrentView,
    setError,
  } = useAppStore()

  const [credentials, setCredentials] = useState({
    email: 'admin@local.test',
    password: 'admin123',
  })
  const [savingIdea, setSavingIdea] = useState(false)

  useEffect(() => {
    if (!authChecked) {
      void initializeAuth()
    }
  }, [authChecked, initializeAuth])

  const loginHint = useMemo(
    () => [
      { label: 'Admin', email: 'admin@local.test', password: 'admin123' },
      { label: 'Member', email: 'member@local.test', password: 'member123' },
    ],
    []
  )

  const handleCreateIdea = async (data: ProductIdeaFormData) => {
    try {
      setSavingIdea(true)
      const idea = await apiFetch<IdeaRecord>('/api/ideas', {
        method: 'POST',
        body: JSON.stringify({
          title: data.title,
          description: data.description,
          category: data.category,
          positioningStatement: data.positioning_statement,
          requiredAttributes: data.required_attributes,
          competitorOverview: data.competitor_overview,
        }),
      })
      setCurrentView('dashboard')
      router.push(`/products/${idea.id}`)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to create idea')
    } finally {
      setSavingIdea(false)
    }
  }

  if (isLoading && !authChecked) {
    return <LoadingSpinner message="Loading workspace..." />
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.16),_transparent_35%),linear-gradient(180deg,#eff6ff_0%,#f8fafc_38%,#e2e8f0_100%)] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <section className="space-y-8">
            <div className="inline-flex rounded-full border border-primary-200 bg-white/70 px-4 py-1 text-xs font-semibold uppercase tracking-[0.26em] text-primary-700 backdrop-blur">
              SQLite local mode
            </div>
            <div className="space-y-4">
              <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                Product ROI decisions, now fully local and fast.
              </h1>
              <p className="max-w-xl text-base leading-7 text-slate-600">
                This workspace no longer depends on Supabase. Authentication, projects, forecasts, costs, and ROI all run in one local Next.js app backed by SQLite.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <FeatureCard title="Seeded access" body="Default credentials work immediately for local development and demos." />
              <FeatureCard title="SQLite storage" body="All operational data lives in a single local file managed through Prisma." />
              <FeatureCard title="Focused workflow" body="Capture ideas, build the model, and review ROI without org setup or invite friction." />
            </div>
          </section>

          <section className="card border border-white/50 bg-white/85 backdrop-blur">
            <div className="space-y-2 text-center">
              <h2 className="text-2xl font-semibold text-slate-950">Sign in</h2>
              <p className="text-sm text-slate-500">Use one of the local seeded accounts below, or override them through the seed environment variables.</p>
            </div>

            <div className="mt-6 grid gap-3">
              {loginHint.map((account) => (
                <button
                  key={account.label}
                  type="button"
                  onClick={() => setCredentials({ email: account.email, password: account.password })}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-primary-300 hover:bg-primary-50"
                >
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{account.label}</div>
                  <div className="mt-1 text-sm font-medium text-slate-900">{account.email}</div>
                  <div className="text-sm text-slate-500">{account.password}</div>
                </button>
              ))}
            </div>

            <form
              className="mt-6 space-y-4"
              onSubmit={async (event) => {
                event.preventDefault()
                await signIn(credentials)
              }}
            >
              <div className="form-group">
                <label className="form-label" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  className="input-field"
                  value={credentials.email}
                  onChange={(event) => setCredentials((current) => ({ ...current, email: event.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  className="input-field"
                  value={credentials.password}
                  onChange={(event) => setCredentials((current) => ({ ...current, password: event.target.value }))}
                />
              </div>
              {error && (
                <div className="rounded-2xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
                  {error}
                </div>
              )}
              <button type="submit" className="btn-primary w-full">
                Access workspace
              </button>
            </form>
          </section>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#eff6ff_0%,#f8fafc_18%,#ffffff_100%)]">
      <header className="border-b border-slate-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary-700">Product ROI Tool</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-950">Local planning workspace</h1>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <div className="font-medium text-slate-900">{user.fullName}</div>
              <div className="text-slate-500">{user.email}</div>
            </div>
            <button onClick={() => setCurrentView('dashboard')} className="btn-secondary">
              Dashboard
            </button>
            <button onClick={() => setCurrentView('create')} className="btn-secondary">
              New Idea
            </button>
            {user.role === 'admin' && (
              <button onClick={() => setCurrentView('admin')} className="btn-secondary">
                Admin
              </button>
            )}
            <button onClick={() => void signOut()} className="btn-secondary">
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 rounded-2xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
            {error}
          </div>
        )}

        {currentView === 'dashboard' && <ProjectDashboard onCreateNew={() => setCurrentView('create')} />}

        {currentView === 'create' && (
          <section className="card">
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-slate-950">Create a new product idea</h2>
                <p className="mt-2 text-sm text-slate-500">Capture the concept, positioning, and requirements before you move into forecasting and cost modeling.</p>
              </div>
              <button onClick={() => setCurrentView('dashboard')} className="btn-secondary">
                Back to dashboard
              </button>
            </div>
            <ProductIdeaForm onComplete={handleCreateIdea} isLoading={savingIdea} />
          </section>
        )}

        {currentView === 'admin' && user.role === 'admin' && <AdminDashboard />}
      </main>
    </div>
  )
}

function FeatureCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[24px] border border-white/50 bg-white/70 p-5 shadow-sm backdrop-blur">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
    </div>
  )
}
