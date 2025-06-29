-- Reset Database Schema - Run this in Supabase SQL Editor to fix RLS issues

-- Drop all existing policies first
DROP POLICY IF EXISTS "Users can view their own organization" ON organizations;
DROP POLICY IF EXISTS "Admins can update their organization" ON organizations;

DROP POLICY IF EXISTS "Users can view members of their organization" ON users;
DROP POLICY IF EXISTS "Admins can manage users in their organization" ON users;
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;

DROP POLICY IF EXISTS "Users can view ideas in their organization" ON ideas;
DROP POLICY IF EXISTS "Users can create ideas in their organization" ON ideas;
DROP POLICY IF EXISTS "Users can update their own ideas" ON ideas;
DROP POLICY IF EXISTS "Users can delete their own ideas" ON ideas;

DROP POLICY IF EXISTS "Users can view forecasts for ideas in their organization" ON sales_forecasts;
DROP POLICY IF EXISTS "Users can create forecasts for ideas in their organization" ON sales_forecasts;
DROP POLICY IF EXISTS "Users can update their own forecasts" ON sales_forecasts;

DROP POLICY IF EXISTS "Users can view cost estimates for ideas in their organization" ON cost_estimates;
DROP POLICY IF EXISTS "Users can create cost estimates for ideas in their organization" ON cost_estimates;
DROP POLICY IF EXISTS "Users can update their own cost estimates" ON cost_estimates;

DROP POLICY IF EXISTS "Users can view ROI summaries for ideas in their organization" ON roi_summaries;
DROP POLICY IF EXISTS "Users can create ROI summaries for ideas in their organization" ON roi_summaries;

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS public.get_organization_id_for_current_user();
DROP FUNCTION IF EXISTS public.get_user_role_for_current_user();
DROP FUNCTION IF EXISTS public.is_admin_for_current_user();

-- Create helper functions to avoid infinite recursion
CREATE OR REPLACE FUNCTION public.get_organization_id_for_current_user()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT organization_id FROM public.users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.get_user_role_for_current_user()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM public.users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_admin_for_current_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role = 'admin' FROM public.users WHERE id = auth.uid()
$$;

-- Now recreate the fixed policies using the helper functions
-- RLS Policies for organizations
CREATE POLICY "Users can view their own organization" ON organizations
    FOR SELECT USING (
        id = public.get_organization_id_for_current_user()
    );

CREATE POLICY "Admins can update their organization" ON organizations
    FOR UPDATE USING (
        id = public.get_organization_id_for_current_user() AND public.is_admin_for_current_user()
    );

-- RLS Policies for users (FIXED - using helper functions)
CREATE POLICY "Users can view their own profile" ON users
    FOR SELECT USING (id = auth.uid());

CREATE POLICY "Users can view members of their organization" ON users
    FOR SELECT USING (
        organization_id = public.get_organization_id_for_current_user()
    );

CREATE POLICY "Users can update their own profile" ON users
    FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Admins can manage users in their organization" ON users
    FOR ALL USING (
        organization_id = public.get_organization_id_for_current_user() AND public.is_admin_for_current_user()
    );

-- RLS Policies for ideas
CREATE POLICY "Users can view ideas in their organization" ON ideas
    FOR SELECT USING (
        organization_id = public.get_organization_id_for_current_user()
    );

CREATE POLICY "Users can create ideas in their organization" ON ideas
    FOR INSERT WITH CHECK (
        organization_id = public.get_organization_id_for_current_user()
    );

CREATE POLICY "Users can update their own ideas" ON ideas
    FOR UPDATE USING (
        created_by = auth.uid() OR 
        (organization_id = public.get_organization_id_for_current_user() AND public.is_admin_for_current_user())
    );

CREATE POLICY "Users can delete their own ideas" ON ideas
    FOR DELETE USING (
        created_by = auth.uid() OR 
        (organization_id = public.get_organization_id_for_current_user() AND public.is_admin_for_current_user())
    );

-- RLS Policies for sales_forecasts
CREATE POLICY "Users can view forecasts for ideas in their organization" ON sales_forecasts
    FOR SELECT USING (
        idea_id IN (
            SELECT i.id FROM ideas i
            WHERE i.organization_id = public.get_organization_id_for_current_user()
        )
    );

CREATE POLICY "Users can create forecasts for ideas in their organization" ON sales_forecasts
    FOR INSERT WITH CHECK (
        idea_id IN (
            SELECT i.id FROM ideas i
            WHERE i.organization_id = public.get_organization_id_for_current_user()
        )
    );

CREATE POLICY "Users can update their own forecasts" ON sales_forecasts
    FOR UPDATE USING (
        contributor_id = auth.uid() OR
        idea_id IN (
            SELECT i.id FROM ideas i
            WHERE i.organization_id = public.get_organization_id_for_current_user() AND public.is_admin_for_current_user()
        )
    );

-- RLS Policies for cost_estimates
CREATE POLICY "Users can view cost estimates for ideas in their organization" ON cost_estimates
    FOR SELECT USING (
        idea_id IN (
            SELECT i.id FROM ideas i
            WHERE i.organization_id = public.get_organization_id_for_current_user()
        )
    );

CREATE POLICY "Users can create cost estimates for ideas in their organization" ON cost_estimates
    FOR INSERT WITH CHECK (
        idea_id IN (
            SELECT i.id FROM ideas i
            WHERE i.organization_id = public.get_organization_id_for_current_user()
        )
    );

CREATE POLICY "Users can update their own cost estimates" ON cost_estimates
    FOR UPDATE USING (
        created_by = auth.uid() OR
        idea_id IN (
            SELECT i.id FROM ideas i
            WHERE i.organization_id = public.get_organization_id_for_current_user() AND public.is_admin_for_current_user()
        )
    );

-- RLS Policies for roi_summaries
CREATE POLICY "Users can view ROI summaries for ideas in their organization" ON roi_summaries
    FOR SELECT USING (
        idea_id IN (
            SELECT i.id FROM ideas i
            WHERE i.organization_id = public.get_organization_id_for_current_user()
        )
    );

CREATE POLICY "Users can create ROI summaries for ideas in their organization" ON roi_summaries
    FOR INSERT WITH CHECK (
        idea_id IN (
            SELECT i.id FROM ideas i
            WHERE i.organization_id = public.get_organization_id_for_current_user()
        )
    ); 