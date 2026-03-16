import { NextResponse } from 'next/server'
import { emailIsConfigured, sendEmail } from '@/lib/email'
import { badRequest, jsonError } from '@/lib/http'
import { prisma } from '@/lib/prisma'
import { calculateEngineeringLaunchCost } from '@/lib/roi-calculations'
import { requireUser } from '@/lib/server-auth'

function buildHtml(project: any, roi: any, cost: any) {
  const bomRows = Array.isArray(cost?.bomParts)
    ? cost.bomParts
        .map((line: any) => `<tr><td>${line.item}</td><td>${line.quantity}</td><td>$${line.unitCost}</td></tr>`)
        .join('')
    : ''
  const bomTable = bomRows
    ? `<h3>BOM</h3><table border="1" cellpadding="4" cellspacing="0"><tr><th>Item</th><th>Qty</th><th>Cost</th></tr>${bomRows}</table>`
    : ''
  const engineeringLaunchCost = calculateEngineeringLaunchCost(cost)
  return `
    <h2>${project.title}</h2>
    <p><strong>Description:</strong> ${project.description}</p>
    <p><strong>Positioning:</strong> ${project.positioningStatement}</p>
    <p><strong>Competitor Overview:</strong> ${project.competitorOverview}</p>
    <h3>ROI Summary</h3>
    <ul>
      <li>NPV: $${roi.npv}</li>
      <li>IRR: ${(roi.irr * 100).toFixed(1)}%</li>
      <li>Break Even: ${roi.breakEvenMonth} months</li>
      <li>Payback Period: ${roi.paybackPeriod} years</li>
    </ul>
    ${bomTable}
    <p><strong>Engineering Hours:</strong> ${cost?.engineeringHours ?? 0}</p>
    <p><strong>Engineering Rate / Hour:</strong> $${cost?.engineeringRatePerHour ?? 0}</p>
    <p><strong>Engineering Launch Cost:</strong> $${engineeringLaunchCost}</p>
    <p><strong>Tooling Cost:</strong> $${cost?.toolingCost ?? 0}</p>
    <p><strong>Marketing Budget:</strong> $${cost?.marketingBudget ?? 0}</p>
    <p><strong>PPC Budget:</strong> $${cost?.ppcBudget ?? 0}</p>
  `
}

export async function POST(req: Request) {
  try {
    await requireUser()
    const { project, roi, cost, recipients } = await req.json()

    if (!project || !roi) {
      throw badRequest('Invalid payload')
    }

    const recipientList =
      Array.isArray(recipients) && recipients.length
        ? recipients
        : (
            await prisma.user.findMany({
              where: { isActive: true },
              select: { email: true },
            })
          ).map((user) => user.email)

    if (!recipientList.length || !emailIsConfigured()) {
      return NextResponse.json({ success: true, skipped: true })
    }

    const html = buildHtml(project, roi, cost)
    await sendEmail(recipientList, `ROI Completed: ${project.title}`, html)
    return NextResponse.json({ success: true })
  } catch (error) {
    return jsonError(error)
  }
}
