import { create } from 'zustand'
import { User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { getUserOrganization, UserOrgResult } from './getUserOrganization'

export type AppView = 'dashboard' | 'create' | 'view' | 'org-setup' | 'admin' | 'auth'

export interface UserOrganization {
  organization_id: string | null
  role: string
}

export interface AppState {
  // Auth state
  user: User | null
  isAuthenticated: boolean
  authChecked: boolean
  
  // Loading states
  isLoading: boolean
  isCheckingOrganization: boolean
  
  // Application state
  currentView: AppView
  selectedProjectId: string | null
  userOrganization: UserOrganization | null
  
  // UI state
  showSignUp: boolean
  showPasswordReset: boolean
  error: string | null
  
  // Actions
  initializeAuth: () => Promise<void>
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setCurrentView: (view: AppView) => void
  setSelectedProjectId: (id: string | null) => void
  setShowSignUp: (show: boolean) => void
  setShowPasswordReset: (show: boolean) => void
  checkUserOrganization: (userId: string) => Promise<void>
  signOut: () => Promise<void>
  resetState: () => void
  setupAuthListener: () => void
}

const fetchUserOrganizationWithRetry = async (userId: string, maxRetries = 3): Promise<{
  data: UserOrgResult | null
  error: any
  userNotFound: boolean
}> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Organization check attempt ${attempt} for user:`, userId)

      const { data, error } = await getUserOrganization()

      if (error) {
        console.warn(`Organization check attempt ${attempt} failed:`, error)

        if (attempt === maxRetries) {
          throw error
        }

        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }

      console.log('Organization check successful:', data)

      const userNotFound = !data?.role && !data?.organization_id
      return { data, error: null, userNotFound }
    } catch (error) {
      console.warn(`Organization check attempt ${attempt} failed:`, error)

      if (attempt === maxRetries) {
        throw error
      }

      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw new Error('Max retries exceeded')
}

export const useAppStore = create<AppState>((set, get) => {
  let authListenerSetup = false
  let isCheckingOrg = false

  return {
    // Initial state
    user: null,
    isAuthenticated: false,
    authChecked: false,
    isLoading: true,
    isCheckingOrganization: false,
    currentView: 'auth',
    selectedProjectId: null,
    userOrganization: null,
    showSignUp: false,
    showPasswordReset: false,
    error: null,

    // Actions
    initializeAuth: async () => {
      if (get().authChecked) return
      set({ isLoading: true, error: null })
      
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session?.user) {
          set({
            user: session.user,
            isAuthenticated: true,
            currentView: 'dashboard',
            isLoading: false,
            authChecked: true
          })
          await get().checkUserOrganization(session.user.id)
        } else {
          set({ isLoading: false, authChecked: true, currentView: 'auth' })
        }
      } catch (error) {
        console.error('Auth initialization error:', error)
        set({ isLoading: false, authChecked: true, error: 'Authentication failed' })
      }
    },

    setUser: (user: User | null) => {
      set({ 
        user, 
        isAuthenticated: !!user,
        currentView: user ? 'dashboard' : 'auth',
        authChecked: true,
        isLoading: false
      })
    },

    setLoading: (loading: boolean) => {
      set({ isLoading: loading })
    },

    setError: (error: string | null) => {
      set({ error })
    },

    setCurrentView: (view: AppView) => {
      set({ currentView: view })
    },

    setSelectedProjectId: (id: string | null) => {
      set({ selectedProjectId: id })
    },

    setShowSignUp: (show: boolean) => {
      set({ showSignUp: show })
    },

    setShowPasswordReset: (show: boolean) => {
      set({ showPasswordReset: show })
    },

    checkUserOrganization: async (userId: string) => {
      if (isCheckingOrg) {
        console.log('Organization check already in progress, skipping...')
        return
      }
      
      console.log('Checking user organization for:', userId)
      isCheckingOrg = true
      set({ isCheckingOrganization: true, error: null })
      
      try {
        const { data, error, userNotFound } = await fetchUserOrganizationWithRetry(userId)

        if (userNotFound) {
          set({ 
            currentView: 'org-setup',
            isLoading: false,
            isCheckingOrganization: false,
            authChecked: true
          })
          return
        }

        if (error) {
          console.error('Error checking user organization:', error)
          set({ 
            error: 'Failed to check user organization',
            isLoading: false,
            isCheckingOrganization: false,
            authChecked: true
          })
          return
        }

        console.log('User organization data:', data)

        if (!data?.organization_id) {
          set({ 
            currentView: 'org-setup',
            userOrganization: data,
            isLoading: false,
            isCheckingOrganization: false,
            authChecked: true
          })
        } else {
          set({ 
            currentView: 'dashboard',
            userOrganization: data,
            isLoading: false,
            isCheckingOrganization: false,
            authChecked: true
          })
        }
      } catch (error) {
        console.error('Error checking user organization:', error)
        set({ 
          error: 'Failed to check user organization',
          isLoading: false,
          isCheckingOrganization: false,
          authChecked: true
        })
      } finally {
        isCheckingOrg = false
      }
    },

    signOut: async () => {
      try {
        await supabase.auth.signOut()
        get().resetState()
      } catch (error) {
        console.error('Error signing out:', error)
        set({ error: 'Failed to sign out' })
      }
    },

    resetState: () => {
      set({
        user: null,
        isAuthenticated: false,
        authChecked: false,
        isLoading: false,
        isCheckingOrganization: false,
        currentView: 'auth',
        selectedProjectId: null,
        userOrganization: null,
        showSignUp: false,
        showPasswordReset: false,
        error: null
      })
    },

    setupAuthListener: () => {
      if (authListenerSetup) return
      authListenerSetup = true

      supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
          if (session?.user) {
            get().setUser(session.user)
            await get().checkUserOrganization(session.user.id)
          }
        }
        if (event === 'SIGNED_OUT') {
          get().resetState()
        }
      })
    }
  }
})
