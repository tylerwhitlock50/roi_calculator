export function getSubmissionUrl(inviteCode: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  return `${base}/submit/${inviteCode}`
}
