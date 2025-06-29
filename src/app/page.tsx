'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'
import ProjectDashboard from '@/components/ProjectDashboard'
import ProductIdeaForm from '@/components/ProductIdeaForm'
import OrganizationSetup from '@/components/OrganizationSetup'
import PasswordReset from '@/components/PasswordReset'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [showSignUp, setShowSignUp] = useState(false)
  const [showPasswordReset, setShowPasswordReset] = useState(false)
  const [currentView, setCurrentView] = useState<'dashboard' | 'create' | 'view' | 'org-setup'>('dashboard')
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [userOrganization, setUserOrganization] = useState<any>(null)
  const router = useRouter()
  const params = useParams();
  const productId = params.id;

  useEffect(() => {
    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        checkUserOrganization(session.user.id)
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        await checkUserOrganization(session.user.id)
      } else {
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const checkUserOrganization = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('organization_id, role')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error checking user organization:', error)
        setLoading(false)
        return
      }

      if (!data?.organization_id) {
        setCurrentView('org-setup')
      } else {
        setUserOrganization(data)
      }
      setLoading(false)
    } catch (error) {
      console.error('Error checking user organization:', error)
      setLoading(false)
    }
  }

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      alert(error.message)
    }
  }

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const fullName = formData.get('fullName') as string

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    })

    if (error) {
      alert(error.message)
    } else {
      alert('Check your email for the confirmation link!')
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  const handleCreateProject = () => {
    setCurrentView('create')
  }

  const handleViewProject = (id: string) => {
    setSelectedProjectId(id)
    setCurrentView('view')
  }

  const handleBackToDashboard = () => {
    setCurrentView('dashboard')
    setSelectedProjectId(null)
  }

  const handleOrganizationComplete = () => {
    setCurrentView('dashboard')
    // Refresh user organization data
    if (user) {
      checkUserOrganization(user.id)
    }
  }

  const handleCreateIdea = async (data: any) => {
    try {
      if (!user) return

      // Get user's organization
      const { data: userData } = await supabase
        .from('users')
        .select('organization_id')
        .eq('id', user.id)
        .single()

      if (!userData?.organization_id) {
        alert('Please join an organization first')
        return
      }

      // Create the idea
      const { error } = await supabase
        .from('ideas')
        .insert({
          ...data,
          organization_id: userData.organization_id,
          created_by: user.id,
        })

      if (error) {
        console.error('Error creating idea:', error)
        alert('Error creating product idea')
        return
      }

      alert('Product idea created successfully!')
      setCurrentView('dashboard')
    } catch (error) {
      console.error('Error creating idea:', error)
      alert('Error creating product idea')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <h1 
                  className="text-xl font-semibold text-gray-900 cursor-pointer"
                  onClick={() => setCurrentView('dashboard')}
                >
                  Product ROI Tool
                </h1>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-700">{user.email}</span>
                <button
                  onClick={handleSignOut}
                  className="btn-secondary"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            {currentView === 'org-setup' && (
              <OrganizationSetup onComplete={handleOrganizationComplete} />
            )}

            {currentView === 'dashboard' && userOrganization && (
              <ProjectDashboard
                onCreateNew={handleCreateProject}
                onViewProject={handleViewProject}
              />
            )}

            {currentView === 'create' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-gray-900">Create New Product Idea</h2>
                  <button
                    onClick={handleBackToDashboard}
                    className="btn-secondary"
                  >
                    Back to Dashboard
                  </button>
                </div>
                <ProductIdeaForm
                  onComplete={handleCreateIdea}
                />
              </div>
            )}

            {currentView === 'view' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-gray-900">Project Details</h2>
                  <button
                    onClick={handleBackToDashboard}
                    className="btn-secondary"
                  >
                    Back to Dashboard
                  </button>
                </div>
                <div className="card">
                  <p className="text-gray-600">Project details view coming soon...</p>
                  <p className="text-sm text-gray-500 mt-2">Project ID: {selectedProjectId}</p>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md mx-auto">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Product ROI Tool
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Evaluate new product ideas with data-driven ROI analysis
          </p>
        </div>

        {showPasswordReset ? (
          <PasswordReset onBack={() => setShowPasswordReset(false)} />
        ) : !showSignUp ? (
          <div className="card mt-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-8 text-center">Sign In</h3>
            <form className="space-y-6" onSubmit={handleSignIn}>
              <div>
                <label htmlFor="email" className="form-label">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="input-field"
                />
              </div>
              <div>
                <label htmlFor="password" className="form-label">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="input-field"
                />
              </div>
              <button type="submit" className="btn-primary mt-2">
                Sign in
              </button>
            </form>
            <div className="mt-8 space-y-3">
              <div className="text-center">
                <button
                  onClick={() => setShowPasswordReset(true)}
                  className="text-cyan-600 hover:text-cyan-700 text-sm font-medium"
                >
                  Forgot your password?
                </button>
              </div>
              <div className="text-center">
                <button
                  onClick={() => setShowSignUp(true)}
                  className="text-cyan-600 hover:text-cyan-700 text-sm font-medium"
                >
                  Don't have an account? Sign up
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="card mt-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-8 text-center">Create Account</h3>
            <form className="space-y-6" onSubmit={handleSignUp}>
              <div>
                <label htmlFor="fullName" className="form-label">
                  Full Name
                </label>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  autoComplete="name"
                  required
                  className="input-field"
                />
              </div>
              <div>
                <label htmlFor="signup-email" className="form-label">
                  Email address
                </label>
                <input
                  id="signup-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="input-field"
                />
              </div>
              <div>
                <label htmlFor="signup-password" className="form-label">
                  Password
                </label>
                <input
                  id="signup-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  className="input-field"
                />
              </div>
              <button type="submit" className="btn-primary mt-2">
                Create account
              </button>
            </form>
            <div className="mt-8">
              <button
                onClick={() => setShowSignUp(false)}
                className="text-cyan-600 hover:text-cyan-700 text-sm font-medium"
              >
                Already have an account? Sign in
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 