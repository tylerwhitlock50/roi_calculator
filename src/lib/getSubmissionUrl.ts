export function getSubmissionUrl(inviteCode: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://roi-calculator-green.vercel.app/'
  return `${base}/submit/${inviteCode}`
}
