'use client'
import { useEffect, useRef } from 'react'
import { useAppStore } from '@/lib/store'

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { initializeAuth, setupAuthListener, authChecked } = useAppStore()
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    setupAuthListener()
    if (!authChecked) {
      initializeAuth()
    }
  }, [authChecked, initializeAuth, setupAuthListener])

  return <>{children}</>
}
