import nodemailer from 'nodemailer'

const host = process.env.SMTP_HOST
const port = Number(process.env.SMTP_PORT || 587)
const user = process.env.SMTP_USER
const pass = process.env.SMTP_PASS
const from = process.env.SMTP_FROM || user

const transporter = nodemailer.createTransport({
  host,
  port,
  auth: user && pass ? { user, pass } : undefined,
})

export async function sendEmail(to: string[], subject: string, html: string) {
  if (!host) throw new Error('SMTP_HOST not configured')
  await transporter.sendMail({
    from,
    to: to.join(', '),
    subject,
    html,
  })
}

