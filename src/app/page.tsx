'use client'

import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'
import ProjectDashboard from '@/components/ProjectDashboard'
import ProductIdeaForm from '@/components/ProductIdeaForm'
import OrganizationSetup from '@/components/OrganizationSetup'
import PasswordReset from '@/components/PasswordReset'
import LoadingSpinner from '@/components/LoadingSpinner'
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
  const [authChecked, setAuthChecked] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const router = useRouter()
  const params = useParams();
  const productId = params.id;

  const handleSessionFailure = async () => {
    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.error('Error during sign out:', err)
    } finally {
      window.location.reload()
    }
  }

  // Set a timeout to prevent infinite loading
  useEffect(() => {
    loadingTimeoutRef.current = setTimeout(() => {
      if (loading) {
        console.warn('Loading timeout reached, forcing logout and reload')
        handleSessionFailure()
      }
    }, 10000) // 10 second timeout

    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
      }
    }
  }, [loading])

  useEffect(() => {
    let mounted = true

    const initializeAuth = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (!mounted) return

        if (sessionError) {
          console.error('Session error:', sessionError)
          await handleSessionFailure()
          return
        }

        if (session?.user) {
          const { data: { user: networkUser }, error: userError } = await supabase.auth.getUser()

          if (userError || !networkUser) {
            console.error('Failed to validate session:', userError)
            await handleSessionFailure()
            return
          }

          setUser(networkUser)
          await checkUserOrganization(networkUser.id)
        } else {
          setLoading(false)
          setAuthChecked(true)
        }
      } catch (error) {
        console.error('Auth initialization error:', error)
        await handleSessionFailure()
      }
    }

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      console.log('Auth state change:', event, session?.user?.email)
      
      setUser(session?.user ?? null)
      
      if (session?.user) {
        await checkUserOrganization(session.user.id)
      } else {
        setLoading(false)
        setAuthChecked(true)
        setUserOrganization(null)
        setCurrentView('dashboard')
      }
    })

    initializeAuth()

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const fetchUserOrganization = async (userId: string) => {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Database query timeout')), 5000)
    )

    const queryPromise = supabase
      .from('users')
      .select('organization_id, role')
      .eq('id', userId)
      .single()

    return Promise.race([queryPromise, timeoutPromise]) as Promise<any>
  }

  const checkUserOrganization = async (userId: string) => {
    try {
      console.log('Checking user organization for:', userId)

      let attempts = 0
      let data: any = null
      let error: any = null

      while (attempts < 3) {
        try {
          ;({ data, error } = await fetchUserOrganization(userId))
          if (!error) break
        } catch (err) {
          error = err
        }

        attempts += 1
        console.warn(`Organization check attempt ${attempts} failed:`, error)
        // Small delay before retrying
        await new Promise(res => setTimeout(res, 1000 * attempts))
      }

      if (error) {
        console.error('Error checking user organization:', error)
        
        // Handle specific error cases
        if (error.code === 'PGRST116') {
          // User not found in users table - this might happen if the trigger didn't work
          console.log('User not found in users table, creating profile...')
          setCurrentView('org-setup')
          setLoading(false)
          setAuthChecked(true)
          return
        }

        await handleSessionFailure()
        return
      }

      if (!data) {
        await handleSessionFailure()
        return
      }

      console.log('User organization data:', data)

      if (!data?.organization_id) {
        setCurrentView('org-setup')
      } else {
        setUserOrganization(data)
        setCurrentView('dashboard')
      }

      setLoading(false)
      setAuthChecked(true)
    } catch (error) {
      console.error('Error checking user organization:', error)
      await handleSessionFailure()
    }
  }

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    
    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setError(error.message)
      }
    } catch (error) {
      console.error('Sign in error:', error)
      setError('Failed to sign in - please try again')
    }
  }

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    
    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const fullName = formData.get('fullName') as string

    try {
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
        setError(error.message)
      } else {
        alert('Check your email for the confirmation link!')
      }
    } catch (error) {
      console.error('Sign up error:', error)
      setError('Failed to create account - please try again')
    }
  }

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
    } catch (error) {
      console.error('Sign out error:', error)
      setError('Failed to sign out')
    }
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
      setLoading(true)
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

  // Show loading spinner
  if (loading) {
    return (
      <LoadingSpinner
        message="Loading application..."
        showError={!!error}
        errorMessage={error || undefined}
        onRetry={handleSessionFailure}
      />
    )
  }

  // Show error state if authentication failed
  if (error && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md mx-auto text-center">
          <div className="card">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Connection Error</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={handleSessionFailure}
              className="btn-primary"
            >
              Refresh Page
            </button>
          </div>
        </div>
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
            {error && (
              <div className="mb-4 p-3 bg-danger-50 border border-danger-200 rounded-md">
                <p className="text-sm text-danger-600">{error}</p>
              </div>
            )}

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

        {error && (
          <div className="mt-4 p-3 bg-danger-50 border border-danger-200 rounded-md">
            <p className="text-sm text-danger-600">{error}</p>
          </div>
        )}

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