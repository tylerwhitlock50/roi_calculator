import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: Request) {
  const { email, organizationId } = await req.json()
  if (!email || !organizationId) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
  }

  const supabase = createRouteHandlerClient({ cookies })
  const {
    data: { session }
  } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check that current user is admin of the target organization
  const { data: userData } = await supabase
    .from('users')
    .select('role, organization_id')
    .eq('id', session.user.id)
    .single()

  if (
    userData?.role !== 'admin' ||
    !userData.organization_id ||
    userData.organization_id !== organizationId
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: invite, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    email
  )

  if (error || !invite.user) {
    return NextResponse.json({ error: error?.message || 'Invite failed' }, { status: 500 })
  }

  await supabaseAdmin
    .from('users')
    .update({ organization_id: organizationId })
    .eq('id', invite.user.id)

  return NextResponse.json({ success: true })
}
