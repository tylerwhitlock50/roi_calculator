'use client'

import React from 'react'
import { useAppStore } from '@/lib/store'

export default function DebugPanel() {
  const {
    user,
    isAuthenticated,
    authChecked,
    isLoading,
    isCheckingOrganization,
    currentView,
    selectedProjectId,
    userOrganization,
    showSignUp,
    showPasswordReset,
    error,
    initializeAuth,
    setError
  } = useAppStore()

  const [isVisible, setIsVisible] = React.useState(false)

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 bg-gray-800 text-white p-2 rounded-full shadow-lg z-50"
        title="Debug Panel"
      >
        🐛
      </button>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white border border-gray-300 rounded-lg shadow-lg p-4 max-w-sm z-50">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold text-sm">Debug Panel</h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>
      
      <div className="space-y-2 text-xs">
        <div>
          <strong>Auth State:</strong>
          <div className="ml-2">
            <div>User: {user ? user.email : 'null'}</div>
            <div>Authenticated: {isAuthenticated ? 'true' : 'false'}</div>
            <div>Auth Checked: {authChecked ? 'true' : 'false'}</div>
          </div>
        </div>
        
        <div>
          <strong>Loading States:</strong>
          <div className="ml-2">
            <div>Is Loading: {isLoading ? 'true' : 'false'}</div>
            <div>Checking Org: {isCheckingOrganization ? 'true' : 'false'}</div>
          </div>
        </div>
        
        <div>
          <strong>App State:</strong>
          <div className="ml-2">
            <div>Current View: {currentView}</div>
            <div>Selected Project: {selectedProjectId || 'null'}</div>
            <div>User Org: {userOrganization ? JSON.stringify(userOrganization) : 'null'}</div>
          </div>
        </div>
        
        <div>
          <strong>UI State:</strong>
          <div className="ml-2">
            <div>Show Sign Up: {showSignUp ? 'true' : 'false'}</div>
            <div>Show Password Reset: {showPasswordReset ? 'true' : 'false'}</div>
          </div>
        </div>
        
        {error && (
          <div>
            <strong>Error:</strong>
            <div className="ml-2 text-red-600">{error}</div>
          </div>
        )}
        
        <div className="pt-2 space-y-1">
          <button
            onClick={() => {
              setError(null)
              initializeAuth()
            }}
            className="w-full bg-blue-500 text-white px-2 py-1 rounded text-xs"
          >
            Retry Auth
          </button>
          <button
            onClick={() => {
              console.log('Current store state:', useAppStore.getState())
            }}
            className="w-full bg-gray-500 text-white px-2 py-1 rounded text-xs"
          >
            Log State
          </button>
        </div>
      </div>
    </div>
  )
} 