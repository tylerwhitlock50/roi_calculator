'use client'
import { useEffect } from 'react'
import {
  SessionContextProvider,
  useSessionContext,
} from '@supabase/auth-helpers-react'
import { createBrowserSupabaseClient } from '@supabase/auth-helpers-nextjs'
import type { SupabaseClient, Session } from '@supabase/supabase-js'
import { useAppStore } from '@/lib/store'
import type { Database } from '@/lib/supabase'

function AuthSync({ children }: { children: React.ReactNode }) {
  const { session } = useSessionContext()
  const setUser = useAppStore((s) => s.setUser)
  const checkOrg = useAppStore((s) => s.checkUserOrganization)

  useEffect(() => {
    if (session?.user) {
      setUser(session.user)
      checkOrg(session.user.id)
    } else {
      setUser(null)
    }
  }, [session, setUser, checkOrg])

  return <>{children}</>
}

export default function SupabaseAuthProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const supabaseClient: SupabaseClient<Database> = createBrowserSupabaseClient()
  return (
    <SessionContextProvider supabaseClient={supabaseClient}>
      <AuthSync>{children}</AuthSync>
    </SessionContextProvider>
  )
}
