import bcrypt from 'bcryptjs'
import { PrismaClient, Role } from '@prisma/client'

const prisma = new PrismaClient()

const activityRates = [
  { activityName: 'Industrial Design', ratePerHour: 95 },
  { activityName: 'Mechanical Engineering', ratePerHour: 125 },
  { activityName: 'Electrical Engineering', ratePerHour: 140 },
  { activityName: 'Supply Chain', ratePerHour: 85 },
  { activityName: 'Quality Assurance', ratePerHour: 90 },
]

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@local.test'
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'admin123'
  const demoEmail = process.env.SEED_MEMBER_EMAIL ?? 'member@local.test'
  const demoPassword = process.env.SEED_MEMBER_PASSWORD ?? 'member123'

  const [adminHash, demoHash] = await Promise.all([
    bcrypt.hash(adminPassword, 10),
    bcrypt.hash(demoPassword, 10),
  ])

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      fullName: 'Local Admin',
      passwordHash: adminHash,
      role: Role.ADMIN,
      isActive: true,
    },
    create: {
      email: adminEmail,
      fullName: 'Local Admin',
      passwordHash: adminHash,
      role: Role.ADMIN,
      isActive: true,
    },
  })

  await prisma.user.upsert({
    where: { email: demoEmail },
    update: {
      fullName: 'Local Member',
      passwordHash: demoHash,
      role: Role.MEMBER,
      isActive: true,
    },
    create: {
      email: demoEmail,
      fullName: 'Local Member',
      passwordHash: demoHash,
      role: Role.MEMBER,
      isActive: true,
    },
  })

  for (const rate of activityRates) {
    await prisma.activityRate.upsert({
      where: { activityName: rate.activityName },
      update: { ratePerHour: rate.ratePerHour },
      create: rate,
    })
  }

  console.log('Seed complete.')
  console.log(`Admin login: ${adminEmail} / ${adminPassword}`)
  console.log(`Member login: ${demoEmail} / ${demoPassword}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
