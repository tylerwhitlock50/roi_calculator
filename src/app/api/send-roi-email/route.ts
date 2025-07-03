import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'

function buildHtml(project: any, roi: any, cost: any) {
  const bomRows = Array.isArray(cost?.bom_lines)
    ? cost.bom_lines.map((l: any) => `<tr><td>${l.item}</td><td>${l.quantity}</td><td>$${l.cost}</td></tr>`).join('')
    : ''
  const bomTable = bomRows
    ? `<h3>BOM</h3><table border="1" cellpadding="4" cellspacing="0"><tr><th>Item</th><th>Qty</th><th>Cost</th></tr>${bomRows}</table>`
    : ''
  return `
    <h2>${project.title}</h2>
    <p><strong>Description:</strong> ${project.description}</p>
    <p><strong>Positioning:</strong> ${project.positioning_statement}</p>
    <p><strong>Competitor Overview:</strong> ${project.competitor_overview}</p>
    <h3>ROI Summary</h3>
    <ul>
      <li>NPV: $${roi.npv}</li>
      <li>IRR: ${(roi.irr * 100).toFixed(1)}%</li>
      <li>Break Even: ${roi.break_even_month} months</li>
      <li>Payback Period: ${roi.payback_period} years</li>
    </ul>
    ${bomTable}
    <p><strong>Engineering Hours:</strong> ${cost?.engineering_hours ?? 0}</p>
    <p><strong>Tooling Cost:</strong> $${cost?.tooling_cost ?? 0}</p>
    <p><strong>Marketing Budget:</strong> $${cost?.marketing_budget ?? 0}</p>
    <p><strong>PPC Budget:</strong> $${cost?.ppc_budget ?? 0}</p>
  `
}

export async function POST(req: Request) {
  const { project, roi, cost, recipients } = await req.json()
  if (!project || !roi || !recipients) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const supabase = createRouteHandlerClient({ cookies })
  const {
    data: { session }
  } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: userData } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', session.user.id)
    .single()

  if (!userData || userData.organization_id !== project.organization_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const html = buildHtml(project, roi, cost)
    await sendEmail(recipients, `ROI Completed: ${project.title}`, html)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

