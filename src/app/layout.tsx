import React from 'react'
import type { Metadata } from 'next'
import './globals.css'
import ErrorBoundary from '@/components/ErrorBoundary'
import AuthProvider from '@/components/AuthProvider'

export const metadata: Metadata = {
  title: 'Product ROI Tool',
  description: 'Evaluate new product ideas with data-driven ROI analysis',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <ErrorBoundary>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
} 
