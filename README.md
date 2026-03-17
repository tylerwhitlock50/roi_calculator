# Product ROI Tool

Product ROI Tool is a local-first Next.js application for evaluating product ideas with forecasts, cost models, and ROI analysis. The app now runs entirely on a local SQLite database through Prisma and uses simple cookie-based auth with seeded local accounts.

## Stack

- Next.js 15
- React 18
- Prisma + SQLite
- Zustand
- Tailwind CSS
- Recharts

## Features

- Seeded local login for admin and member accounts
- Product idea intake with positioning and requirement capture
- Sales forecasting by channel or customer
- Cost estimation with BOM parts, labor entries, tooling, overhead, and support assumptions
- Saved ROI summaries with NPV, IRR, payback period, and unit economics
- Admin activity-rate management

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` from `env.example`.

3. Create the database:

```bash
npm run db:push
```

4. Seed the default local users and activity rates:

```bash
npm run db:seed
```

5. Start the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Default seeded credentials:

- `admin@local.test` / `admin123`
- `member@local.test` / `member123`

## Vercel Testing Build (SQLite)

If you want Vercel deployments to run Prisma setup against your local/testing SQLite DB, use the included build script:

- `vercel-build` runs Prisma generate, pushes schema, seeds data, then builds Next.js.
- `vercel.json` is configured to run this command during builds.

```bash
npm run vercel-build
```

> This is suitable for test/demo deployments only. For production, use a managed database instead of SQLite on Vercel.

## Useful Commands

- `npm run dev`
- `npm run lint`
- `npm run type-check`
- `npm run test`
- `npm run build`
- `npm run db:push`
- `npm run prisma:generate`
- `npm run db:seed`

## Project Notes

- The SQLite database file lives at `data/roi-tool.db` and is ignored by git.
- Use `DATABASE_URL="file:../data/roi-tool.db"` in local env files. Prisma resolves this path relative to `prisma/schema.prisma`.
- If you run Prisma directly instead of the npm scripts, use `--schema prisma/schema.prisma` from the repo root.
- SMTP is optional. If email settings are not configured, ROI save operations still succeed and notification emails are skipped.
- Checked-in Prisma migration SQL lives in `prisma/migrations/`.
