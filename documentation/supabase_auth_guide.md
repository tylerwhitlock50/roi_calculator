# Supabase Auth Sync Pattern

The `@supabase/auth-helpers` packages simplify keeping authentication state
consistent between the server and client in Next.js apps.

Below is a minimal example that wires the helpers into a global store with
Zustand. It ensures the session is available immediately on page load and stays
in sync when the user signs in or out.

```tsx
import { useEffect } from 'react'
import {
  SessionContextProvider,
  useSessionContext,
  createBrowserSupabaseClient,
} from '@supabase/auth-helpers-react'
import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'

const supabase = createBrowserSupabaseClient()

type AuthState = {
  user: User | null
  loading: boolean
  setSession: (session: Session | null) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  setSession: (session) =>
    set({ user: session?.user ?? null, loading: false }),
}))

function AuthSync({ children }: { children: React.ReactNode }) {
  const { session } = useSessionContext()
  const setSession = useAuthStore((s) => s.setSession)

  useEffect(() => {
    setSession(session)
  }, [session, setSession])

  return <>{children}</>
}

// _app.tsx
export default function App({ Component, pageProps }: AppProps) {
  return (
    <SessionContextProvider supabaseClient={supabase}>
      <AuthSync>
        <Component {...pageProps} />
      </AuthSync>
    </SessionContextProvider>
  )
}
```

This pattern centralizes the Supabase session in a single store. The
`SessionContextProvider` handles cookie-based rehydration on the client, while
`AuthSync` updates your store whenever the session changes.
