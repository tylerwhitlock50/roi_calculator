import { create } from 'zustand'

import { apiFetch, type AppUser, type SessionPayload } from '@/lib/api'

export type AppView = 'dashboard' | 'create' | 'admin' | 'auth'

type Credentials = {
  email: string
  password: string
}

export interface AppState {
  user: AppUser | null
  isAuthenticated: boolean
  authChecked: boolean
  isLoading: boolean
  currentView: AppView
  error: string | null
  initializeAuth: () => Promise<void>
  signIn: (credentials: Credentials) => Promise<void>
  signOut: () => Promise<void>
  setCurrentView: (view: AppView) => void
  setError: (error: string | null) => void
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  isAuthenticated: false,
  authChecked: false,
  isLoading: true,
  currentView: 'auth',
  error: null,

  async initializeAuth() {
    set({ isLoading: true, error: null })

    try {
      const session = await apiFetch<SessionPayload>('/api/auth/session')
      set({
        user: session.user,
        isAuthenticated: session.authenticated,
        authChecked: true,
        isLoading: false,
        currentView: session.authenticated ? 'dashboard' : 'auth',
      })
    } catch (error) {
      console.error(error)
      set({
        user: null,
        isAuthenticated: false,
        authChecked: true,
        isLoading: false,
        currentView: 'auth',
        error: 'Failed to initialize session',
      })
    }
  },

  async signIn({ email, password }) {
    set({ isLoading: true, error: null })

    try {
      const session = await apiFetch<SessionPayload>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })

      set({
        user: session.user,
        isAuthenticated: session.authenticated,
        authChecked: true,
        isLoading: false,
        currentView: 'dashboard',
      })
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to sign in',
      })
    }
  },

  async signOut() {
    try {
      await apiFetch('/api/auth/logout', {
        method: 'POST',
      })
    } catch (error) {
      console.error(error)
    }

    set({
      user: null,
      isAuthenticated: false,
      authChecked: true,
      isLoading: false,
      currentView: 'auth',
      error: null,
    })
  },

  setCurrentView(view) {
    set({ currentView: view })
  },

  setError(error) {
    set({ error })
  },
}))
