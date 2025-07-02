import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// During build time, create a dummy client if env vars are missing
if (!supabaseUrl || !serviceRoleKey) {
  console.warn('Supabase admin environment variables not found. Using placeholder values for build.')
}

export const supabaseAdmin = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  serviceRoleKey || 'placeholder_service_role_key'
)
