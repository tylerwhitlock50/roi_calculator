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
DATABASE_URL="file:/absolute/path/to/roi_calculator/data/roi-tool.db" npx prisma db push
```

4. Seed the default local users and activity rates:

```bash
DATABASE_URL="file:/absolute/path/to/roi_calculator/data/roi-tool.db" npx prisma db seed
```

5. Start the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Default seeded credentials:

- `admin@local.test` / `admin123`
- `member@local.test` / `member123`

## Useful Commands

- `npm run dev`
- `npm run lint`
- `npm run type-check`
- `npm run test`
- `npm run build`
- `npm run prisma:generate`
- `npm run db:seed`

## Project Notes

- The SQLite database file lives at `data/roi-tool.db` and is ignored by git.
- SMTP is optional. If email settings are not configured, ROI save operations still succeed and notification emails are skipped.
- Checked-in Prisma migration SQL lives in `prisma/migrations/`.
