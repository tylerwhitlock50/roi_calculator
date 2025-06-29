'use client'

import React from 'react'

interface LoadingSpinnerProps {
  message?: string
  size?: 'sm' | 'md' | 'lg'
  showError?: boolean
  errorMessage?: string
  onRetry?: () => void
}

export default function LoadingSpinner({ 
  message = 'Loading...', 
  size = 'lg',
  showError = false,
  errorMessage,
  onRetry 
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-16 w-16', 
    lg: 'h-32 w-32'
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        {!showError ? (
          <>
            <div className={`animate-spin rounded-full border-b-2 border-primary-600 mx-auto mb-4 ${sizeClasses[size]}`}></div>
            <p className="text-gray-600">{message}</p>
          </>
        ) : (
          <div className="max-w-md mx-auto">
            <div className="p-3 bg-danger-50 border border-danger-200 rounded-md">
              <p className="text-sm text-danger-600 mb-3">{errorMessage || 'An error occurred'}</p>
              {onRetry && (
                <button 
                  onClick={onRetry}
                  className="text-sm text-danger-700 hover:text-danger-800 underline"
                >
                  Try Again
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 