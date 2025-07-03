import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { ideaId, status } = await req.json()
  if (!ideaId || !status) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
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

  // Ensure the idea belongs to the admin's organization
  const { data: idea } = await supabase
    .from('ideas')
    .select('organization_id')
    .eq('id', ideaId)
    .single()

  if (!idea || idea.organization_id !== adminData.organization_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await supabase
    .from('ideas')
    .update({ status })
    .eq('id', ideaId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
