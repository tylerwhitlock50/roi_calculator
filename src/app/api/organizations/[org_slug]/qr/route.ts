import { NextResponse } from 'next/server'
import QRCode from 'qrcode'

export async function POST(
  req: Request,
  { params }: { params: { org_slug: string } }
) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || req.headers.get('origin') || ''
  const submitUrl = `${baseUrl}/submit/${params.org_slug}`
  try {
    const qr = await QRCode.toDataURL(submitUrl)
    return NextResponse.json({ qr })
  } catch (err: any) {
    console.error('Failed to generate QR code', err)
    return NextResponse.json({ error: 'Failed to generate QR code' }, { status: 500 })
  }
}
