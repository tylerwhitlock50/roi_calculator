import React from 'react'
import type { Metadata } from 'next'
import './globals.css'
import ErrorBoundary from '@/components/ErrorBoundary'
import SupabaseAuthProvider from '@/components/SupabaseAuthProvider'

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
          <SupabaseAuthProvider>
            {children}
          </SupabaseAuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
} 
