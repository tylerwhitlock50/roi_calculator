import { supabase } from './supabase'

export interface UserOrgResult {
  organization_id: string | null
  role: string | null
}

export async function getUserOrganization(): Promise<{ data: UserOrgResult | null; error: any }> {
  try {
    const [{ data: orgId, error: orgError }, { data: role, error: roleError }] = await Promise.all([
      supabase.rpc('get_organization_id_for_current_user'),
      supabase.rpc('get_user_role_for_current_user')
    ])

    if (orgError || roleError) {
      return { data: null, error: orgError || roleError }
    }

    return { data: { organization_id: orgId ?? null, role: role ?? null }, error: null }
  } catch (error) {
    return { data: null, error }
  }
}
