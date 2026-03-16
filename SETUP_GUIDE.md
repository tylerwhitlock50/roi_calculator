# Local Setup Guide

## Requirements

- Node.js 18+
- npm

## Environment

Create `.env.local` from `env.example` and set at least:

```env
DATABASE_URL="file:../data/roi-tool.db"
SESSION_SECRET="replace-this-with-a-long-random-string"
```

Optional:

```env
SEED_ADMIN_EMAIL=admin@local.test
SEED_ADMIN_PASSWORD=admin123
SEED_MEMBER_EMAIL=member@local.test
SEED_MEMBER_PASSWORD=member123
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM="ROI Tool <noreply@example.com>"
```

## Database

1. Push the Prisma schema to SQLite:

```bash
npx prisma db push
```

2. Seed the local users and starter activity rates:

```bash
npx prisma db seed
```

Default seeded logins:

- `admin@local.test` / `admin123`
- `member@local.test` / `member123`

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Verification

```bash
npm run lint
npm run type-check
npm run test
npm run build
```

## Notes

- SMTP is optional. If it is not configured, ROI saves still work and email notifications are skipped.
- SQLite lives in `data/roi-tool.db`, which is ignored by git.
- Prisma resolves the SQLite URL relative to `prisma/schema.prisma`, so the local path should stay `file:../data/roi-tool.db`.
