import { loadEnvConfig } from '@next/env'
import { defineConfig } from 'prisma/config'

loadEnvConfig(process.cwd())

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:./prisma/dev.db'
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
})
