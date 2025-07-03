import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: Request) {
  const { userId } = await req.json()
  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
  }

  const supabase = createRouteHandlerClient({ cookies })
  const {
    data: { session }
  } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: adminData } = await supabase
    .from('users')
    .select('role, organization_id')
    .eq('id', session.user.id)
    .single()

  if (!adminData || adminData.role !== 'admin' || !adminData.organization_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Ensure the target user belongs to the admin's organization
  const { data: targetUser } = await supabaseAdmin
    .from('users')
    .select('organization_id')
    .eq('id', userId)
    .single()

  if (targetUser?.organization_id !== adminData.organization_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
