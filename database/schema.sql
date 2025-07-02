-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create organizations table
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    invite_code TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create users table
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create project_categories table for custom categories
CREATE TABLE project_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create ideas table
CREATE TABLE ideas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','archived')),
    positioning_statement TEXT NOT NULL,
    required_attributes TEXT NOT NULL,
    competitor_overview TEXT NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create sales_forecasts table
CREATE TABLE sales_forecasts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    idea_id UUID NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    contributor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contributor_role TEXT NOT NULL,
    channel_or_customer TEXT NOT NULL,
    monthly_volume_estimate JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table of activity rates by organization
CREATE TABLE activity_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    activity_name TEXT NOT NULL,
    rate_per_hour DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create cost_estimates table
CREATE TABLE cost_estimates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    idea_id UUID NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    tooling_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
    engineering_hours INTEGER NOT NULL DEFAULT 0,
    marketing_budget DECIMAL(12,2) NOT NULL DEFAULT 0,
    marketing_cost_per_unit DECIMAL(12,2) NOT NULL DEFAULT 0,
    overhead_rate DECIMAL(5,4) NOT NULL DEFAULT 0,
    support_time_pct DECIMAL(5,4) NOT NULL DEFAULT 0,
    ppc_budget DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Detailed BOM parts associated with a cost estimate
CREATE TABLE bom_parts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cost_estimate_id UUID NOT NULL REFERENCES cost_estimates(id) ON DELETE CASCADE,
    item TEXT NOT NULL,
    unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
    quantity INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Labor line items tied to activity rates
CREATE TABLE labor_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cost_estimate_id UUID NOT NULL REFERENCES cost_estimates(id) ON DELETE CASCADE,
    activity_id UUID NOT NULL REFERENCES activity_rates(id) ON DELETE CASCADE,
    hours INTEGER NOT NULL DEFAULT 0,
    minutes INTEGER NOT NULL DEFAULT 0,
    seconds INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create roi_summaries table
CREATE TABLE roi_summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    idea_id UUID NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    npv DECIMAL(15,2) NOT NULL DEFAULT 0,
    irr DECIMAL(5,4) NOT NULL DEFAULT 0,
    break_even_month INTEGER NOT NULL DEFAULT 0,
    payback_period DECIMAL(5,2) NOT NULL DEFAULT 0,
    contribution_margin_per_unit DECIMAL(12,2) NOT NULL DEFAULT 0,
    profit_per_unit DECIMAL(12,2) NOT NULL DEFAULT 0,
    assumptions JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create helper functions to avoid infinite recursion in RLS policies
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

-- Enable Row Level Security on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE labor_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE roi_summaries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organizations
CREATE POLICY "Users can view their own organization" ON organizations
    FOR SELECT USING (
        id = public.get_organization_id_for_current_user()
    );

CREATE POLICY "Admins can update their organization" ON organizations
    FOR UPDATE USING (
        id = public.get_organization_id_for_current_user() AND public.is_admin_for_current_user()
    );

-- Allow authenticated users to create organizations (for the create_organization function)
CREATE POLICY "Authenticated users can create organizations" ON organizations
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL
    );

-- Allow users to view their organization's invite code (for admin sharing)
CREATE POLICY "Admins can view their organization invite code" ON organizations
    FOR SELECT USING (
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

-- RLS Policies for project_categories
ALTER TABLE project_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view categories in their organization" ON project_categories
    FOR SELECT USING (
        organization_id = public.get_organization_id_for_current_user()
    );

CREATE POLICY "Admins can manage categories" ON project_categories
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

-- RLS Policies for bom_parts
CREATE POLICY "Users can view BOM parts for ideas in their organization" ON bom_parts
    FOR SELECT USING (
        cost_estimate_id IN (
            SELECT ce.id FROM cost_estimates ce
            JOIN ideas i ON ce.idea_id = i.id
            WHERE i.organization_id = public.get_organization_id_for_current_user()
        )
    );

CREATE POLICY "Users can create BOM parts for ideas in their organization" ON bom_parts
    FOR INSERT WITH CHECK (
        cost_estimate_id IN (
            SELECT ce.id FROM cost_estimates ce
            JOIN ideas i ON ce.idea_id = i.id
            WHERE i.organization_id = public.get_organization_id_for_current_user()
        )
    );

CREATE POLICY "Users can update their own BOM parts" ON bom_parts
    FOR UPDATE USING (
        cost_estimate_id IN (
            SELECT ce.id FROM cost_estimates ce
            JOIN ideas i ON ce.idea_id = i.id
            WHERE i.organization_id = public.get_organization_id_for_current_user()
              AND (ce.created_by = auth.uid() OR public.is_admin_for_current_user())
        )
    );

-- RLS Policies for labor_entries
CREATE POLICY "Users can view labor entries for ideas in their organization" ON labor_entries
    FOR SELECT USING (
        cost_estimate_id IN (
            SELECT ce.id FROM cost_estimates ce
            JOIN ideas i ON ce.idea_id = i.id
            WHERE i.organization_id = public.get_organization_id_for_current_user()
        )
    );

CREATE POLICY "Users can create labor entries for ideas in their organization" ON labor_entries
    FOR INSERT WITH CHECK (
        cost_estimate_id IN (
            SELECT ce.id FROM cost_estimates ce
            JOIN ideas i ON ce.idea_id = i.id
            WHERE i.organization_id = public.get_organization_id_for_current_user()
        )
    );

CREATE POLICY "Users can update their own labor entries" ON labor_entries
    FOR UPDATE USING (
        cost_estimate_id IN (
            SELECT ce.id FROM cost_estimates ce
            JOIN ideas i ON ce.idea_id = i.id
            WHERE i.organization_id = public.get_organization_id_for_current_user()
              AND (ce.created_by = auth.uid() OR public.is_admin_for_current_user())
        )
    );

-- RLS Policies for activity_rates
CREATE POLICY "Users can view activity rates for their organization" ON activity_rates
    FOR SELECT USING (
        organization_id = public.get_organization_id_for_current_user()
    );

CREATE POLICY "Admins can manage activity rates" ON activity_rates
    FOR ALL USING (
        organization_id = public.get_organization_id_for_current_user() AND public.is_admin_for_current_user()
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

-- Function to create a user profile after signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, full_name, organization_id, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        NULL, -- Will be set when user joins an organization
        'member'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create user profile
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to generate invite codes
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TEXT AS $$
BEGIN
    RETURN 'ORG-' || upper(substring(md5(random()::text) from 1 for 8));
END;
$$ LANGUAGE plpgsql;

-- Function to create organization with invite code
CREATE OR REPLACE FUNCTION create_organization(org_name TEXT)
RETURNS UUID AS $$
DECLARE
    org_id UUID;
    invite_code TEXT;
BEGIN
    invite_code := generate_invite_code();
    
    INSERT INTO organizations (name, invite_code)
    VALUES (org_name, invite_code)
    RETURNING id INTO org_id;
    
    RETURN org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to join organization by invite code
CREATE OR REPLACE FUNCTION join_organization(invite_code TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    org_id UUID;
BEGIN
    SELECT id INTO org_id FROM organizations WHERE invite_code = join_organization.invite_code;
    
    IF org_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    UPDATE users 
    SET organization_id = org_id
    WHERE id = auth.uid();
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate ROI metrics
CREATE OR REPLACE FUNCTION calculate_roi_metrics(idea_uuid UUID)
RETURNS TABLE(
    npv DECIMAL(15,2),
    irr DECIMAL(5,4),
    break_even_month INTEGER,
    payback_period DECIMAL(5,2)
) AS $$
DECLARE
    total_revenue DECIMAL(15,2) := 0;
    total_costs DECIMAL(15,2) := 0;
    monthly_cash_flows DECIMAL(15,2)[];
    discount_rate DECIMAL(5,4) := 0.10; -- 10% default discount rate
    month_count INTEGER := 0;
    cumulative_cash_flow DECIMAL(15,2) := 0;
    break_even_found BOOLEAN := FALSE;
BEGIN
    -- Calculate total revenue from sales forecasts
    SELECT COALESCE(SUM(
        (value::DECIMAL(15,2) * 12) -- Convert monthly to annual
    ), 0) INTO total_revenue
    FROM sales_forecasts sf,
    jsonb_each_text(sf.monthly_volume_estimate) AS months(month, value)
    WHERE sf.idea_id = idea_uuid;
    
    -- Calculate total costs from cost estimates
    SELECT COALESCE(SUM(
        tooling_cost + 
        (engineering_hours * 100) + -- Assume $100/hour engineering cost
        marketing_budget + 
        ppc_budget
    ), 0) INTO total_costs
    FROM cost_estimates
    WHERE idea_id = idea_uuid;
    
    -- Simple NPV calculation (simplified for MVP)
    -- In a real implementation, you'd want more sophisticated cash flow modeling
    npv := total_revenue - total_costs;
    
    -- Simple IRR calculation (simplified)
    IF total_costs > 0 THEN
        irr := (total_revenue / total_costs - 1) * 100;
    ELSE
        irr := 0;
    END IF;
    
    -- Break-even calculation (simplified)
    IF total_revenue > 0 THEN
        break_even_month := CEIL(total_costs / (total_revenue / 12));
    ELSE
        break_even_month := 0;
    END IF;
    
    -- Payback period (simplified)
    IF total_revenue > 0 THEN
        payback_period := total_costs / (total_revenue / 12);
    ELSE
        payback_period := 0;
    END IF;
    
    RETURN QUERY SELECT npv, irr, break_even_month, payback_period;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes for better performance
CREATE INDEX idx_users_organization_id ON users(organization_id);
CREATE INDEX idx_ideas_organization_id ON ideas(organization_id);
CREATE INDEX idx_ideas_created_by ON ideas(created_by);
CREATE INDEX idx_sales_forecasts_idea_id ON sales_forecasts(idea_id);
CREATE INDEX idx_activity_rates_org_id ON activity_rates(organization_id);
CREATE INDEX idx_cost_estimates_idea_id ON cost_estimates(idea_id);
CREATE INDEX idx_bom_parts_cost_estimate_id ON bom_parts(cost_estimate_id);
CREATE INDEX idx_labor_entries_cost_estimate_id ON labor_entries(cost_estimate_id);
CREATE INDEX idx_labor_entries_activity_id ON labor_entries(activity_id);
CREATE INDEX idx_roi_summaries_idea_id ON roi_summaries(idea_id);
CREATE INDEX idx_organizations_invite_code ON organizations(invite_code);
CREATE INDEX idx_project_categories_org_id ON project_categories(organization_id);

