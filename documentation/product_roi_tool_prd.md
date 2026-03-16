# Product Requirements Document

## Title: Product ROI Tool, Local SQLite Edition
**Owner**: Tyler Whitlock
**Version**: 1.0
**Date**: 2026-03-16

---

## 1. Overview
This application helps a small internal team evaluate product ideas with a consistent local workflow. Users log in with seeded local credentials, define the concept, add revenue forecasts, build cost estimates, and save ROI summaries from a single Next.js app backed by SQLite.

---

## 2. Objectives
- Make the app easy to run locally with no third-party backend dependency.
- Keep idea intake, forecasting, cost modeling, and ROI analysis in one workflow.
- Support a lightweight admin role for managing activity rates.
- Preserve collaboration across seeded users without multi-organization overhead.
- Keep setup simple enough for demos and self-hosted local use.

---

## 3. MVP Scope

### 3.1 Authentication
- Local username/password login.
- Signed cookie-based sessions.
- Seeded admin and member accounts.

### 3.2 Product Idea Submission
- Create and edit a product idea with:
  - Title
  - Description
  - Category
  - Positioning statement
  - Required attributes
  - Competitor overview
  - Status

### 3.3 Sales Forecasting
- Add and edit forecasts with:
  - Channel or customer
  - Contributor role
  - Monthly channel marketing spend
  - Variable marketing cost per unit
  - CAC per unit
  - Monthly unit and price rows
  - Quick level-loaded forecast generation

### 3.4 Cost Modeling
- Add and edit cost estimates with:
  - BOM parts
  - Labor entries tied to activity rates
  - Tooling cost
  - Engineering hours
  - Engineering rate per hour
  - Overhead rate
  - Support time percentage

### 3.5 ROI Summary
- Calculate and save:
  - NPV
  - IRR
  - Break-even month
  - Payback period
  - Contribution margin per unit
  - Profit per unit

### 3.6 Admin Workspace
- View seeded users.
- Manage activity rates used in labor costing.

---

## 4. Data Model

### Tables
1. **User**
   - id
   - email
   - fullName
   - passwordHash
   - role
   - isActive
   - createdAt

2. **Idea**
   - id
   - title
   - description
   - category
   - status
   - positioningStatement
   - requiredAttributes
   - competitorOverview
   - createdById
   - createdAt
   - updatedAt

3. **SalesForecast**
   - id
   - ideaId
   - contributorId
   - contributorRole
   - channelOrCustomer
   - monthlyMarketingSpend
   - marketingCostPerUnit
   - customerAcquisitionCostPerUnit
   - monthlyVolumeEstimate
   - createdAt
   - updatedAt

4. **CostEstimate**
   - id
   - ideaId
   - toolingCost
   - engineeringHours
   - engineeringRatePerHour
   - overheadRate
   - supportTimePct
   - createdById
   - createdAt
   - updatedAt

5. **BomPart**
   - id
   - costEstimateId
   - item
   - unitCost
   - quantity
   - cashEffect
   - createdAt

6. **LaborEntry**
   - id
   - costEstimateId
   - activityId
   - hours
   - minutes
   - seconds
   - createdAt

7. **ActivityRate**
   - id
   - activityName
   - ratePerHour
   - createdAt
   - updatedAt

8. **RoiSummary**
   - id
   - ideaId
   - npv
   - irr
   - breakEvenMonth
   - paybackPeriod
   - contributionMarginPerUnit
   - profitPerUnit
   - assumptions
   - createdAt
   - updatedAt

---

## 5. UX Flow
1. User logs in with a seeded local account.
2. Dashboard lists all ideas with summary ROI context.
3. User creates a new idea through the three-step form.
4. User opens the detail view to:
   - edit overview
   - add forecasts
   - add cost estimates
   - save ROI summary
5. Admin can review users and update activity rates.

---

## 6. Non-Goals
- Multi-organization support
- Invite-code flows
- Public submission pages
- Password reset flows
- Hosted auth providers

---

## 7. Success Criteria
- Local install requires only env setup, Prisma sync, seed, and `npm run dev`.
- Admin and member seeded accounts can log in successfully.
- A user can create an idea, add forecast and cost data, and save ROI.
- Activity rates can be managed without touching the database manually.
