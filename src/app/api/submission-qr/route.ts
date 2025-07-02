import { NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { getSubmissionUrl } from '@/lib/getSubmissionUrl'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  if (!code) {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 })
  }

  const url = getSubmissionUrl(code)
  try {
    const dataUrl = await QRCode.toDataURL(url)
    const base64 = dataUrl.split(',')[1]
    return new NextResponse(Buffer.from(base64, 'base64'), {
      headers: { 'Content-Type': 'image/png' }
    })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to generate QR' }, { status: 500 })
  }
}
