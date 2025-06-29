# Product Requirements Document (PRD)

## Title: New Product Feasibility & ROI Evaluation Tool  
**Owner**: Tyler Whitlock  
**Version**: 0.3 - Schema & Wireframes  
**Date**: 2025-06-28  

---

## 1. Overview
This web app enables product owners and cross-functional teams to assess the viability of new product ideas in a consistent, data-driven, and collaborative manner. It walks the user through defining the product, forecasting sales, estimating costs, and calculating ROI metrics such as NPV and IRR to support prioritization decisions.

---

## 2. Objectives
- Enable teams to **log and define new product ideas** consistently.  
- Provide tools to **forecast revenue** across customers, channels, and time.  
- Allow users to **estimate all costs** involved (tooling, materials, marketing, etc.).  
- Automatically calculate **financial metrics**: ROI, IRR, NPV, and break-even point.  
- Enable comparison and prioritization of multiple projects.  
- Support **collaborative input** (engineering, sales, finance) with visibility into assumptions.  
- Implement **secure multi-tenant access** using Supabase Row-Level Security (RLS).  

---

## 3. Key Features and Modules (MVP Scope)

### 3.1 Authentication and Access Control
- Use **Supabase Auth** for user management (sign-up/login/reset password).
- Implement **organizations**: each user is assigned to one organization.
- Enforce **row-level security** so users only access data from their organization.

### 3.2 Organization & User Management
- Users can:
  - Join an organization with an invite code or admin approval.
  - View other users in their organization.
  - Add/remove users (admin only).

### 3.3 Product Idea Submission
- Create and edit a product idea with the following fields:
  - Title
  - Description
  - Product category / type
  - Positioning statement
  - Required attributes
  - Competitor overview

### 3.4 Sales Forecast Input
- Add basic forecasts with:
  - Customer or channel name
  - Monthly expected volume
  - Ramp-up period (optional)
  - Forecast contributor role (Sales, Finance, etc.)

### 3.5 Cost Forecast Input
- Enter estimates for:
  - BOM (simple line items)
  - Tooling cost
  - Engineering time (in hours)
  - Marketing & Launch budget
  - PPC budget

### 3.6 ROI Summary Calculation
- Backend logic for:
  - NPV (configurable discount rate)
  - IRR
  - Break-even point (months & units)

### 3.7 Project Dashboard
- List of submitted projects with:
  - High-level summary (Title, Owner, ROI, NPV, IRR)
  - Search and filter by owner, status, or category

---

## 4. Database Schema

### Tables
1. **organizations**
   - id (PK)
   - name
   - invite_code
   - created_at

2. **users**
   - id (PK - Supabase UUID)
   - email
   - full_name
   - organization_id (FK)
   - role (admin, member)
   - created_at

3. **ideas**
   - id (PK)
   - organization_id (FK)
   - title
   - description
   - category
   - positioning_statement
   - required_attributes
   - competitor_overview
   - created_by (FK to users)
   - created_at

4. **sales_forecasts**
   - id (PK)
   - idea_id (FK)
   - contributor_id (FK to users)
   - contributor_role
   - channel_or_customer
   - monthly_volume_estimate (JSON: month:value)
   - created_at

5. **cost_estimates**
   - id (PK)
   - idea_id (FK)
   - bom_lines (JSON array)
   - tooling_cost
   - engineering_hours
   - marketing_budget
   - ppc_budget
   - created_by (FK to users)
   - created_at

6. **roi_summaries** (optional - could be calculated on-the-fly)
   - id (PK)
   - idea_id (FK)
   - npv
   - irr
   - break_even_month
   - payback_period
   - assumptions (JSON)
   - created_at

### RLS Policies
- Ensure users can only access records tied to their `organization_id`
- Admin-only permission for managing users

---

## 5. UX/UI Flow (MVP)

1. **Sign-up & Organization Creation**
   - User creates org or joins via invite

2. **Dashboard View**
   - List of product ideas
   - Filter/search by status, category, owner

3. **Idea Entry Wizard**
   - Step 1: Product Info (title, desc, positioning)
   - Step 2: Forecast Builder (channels/customers)
   - Step 3: Cost Estimator (tooling, marketing, etc.)
   - Step 4: ROI Summary (auto-calculated + editable assumptions)

4. **Collaboration & Export**
   - Team members view/edit own forecasts
   - Admins approve/finalize
   - Export PDF or shareable link

---

## 6. MVP Milestones

| Milestone                      | Target Date | Owner        |
|-------------------------------|-------------|--------------|
| Supabase Schema Setup         | Jun 29      | Tyler        |
| Auth & RLS Configured         | Jun 29      | Tyler        |
| Org/User Management UI        | Jun 30      | Tyler        |
| Idea Submission UI            | Jul 1       | Tyler        |
| Forecast & Cost Entry Modules | Jul 2       | Tyler        |
| ROI Calculation & Dashboard   | Jul 3       | Tyler        |
| Final Styling + Vercel Deploy | Jul 4       | Tyler        |

---

## 7. KPIs for Success (MVP)
- # of orgs created and product ideas logged  
- # of unique users submitting forecasts  
- Time to complete one product evaluation  
- Shared demo links or exported summaries  
- # of product prioritization decisions informed by tool

