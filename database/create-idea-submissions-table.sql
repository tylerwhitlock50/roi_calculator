-- Create the idea_submissions table for anonymous submissions
-- This table is separate from the ideas table to keep anonymous submissions distinct

CREATE TABLE IF NOT EXISTS idea_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    positioning_statement TEXT NOT NULL,
    required_attributes TEXT NOT NULL,
    competitor_overview TEXT NOT NULL,
    submitter_email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_idea_submissions_organization_id ON idea_submissions(organization_id);
CREATE INDEX IF NOT EXISTS idx_idea_submissions_created_at ON idea_submissions(created_at);

-- Enable RLS
ALTER TABLE idea_submissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for idea_submissions
CREATE POLICY "Anyone can submit ideas" ON idea_submissions
    FOR INSERT WITH CHECK ( true );

CREATE POLICY "Org users can view submissions" ON idea_submissions
    FOR SELECT USING (
        organization_id = public.get_organization_id_for_current_user()
    );

CREATE POLICY "Admins can delete submissions" ON idea_submissions
    FOR DELETE USING (
        organization_id = public.get_organization_id_for_current_user() AND public.is_admin_for_current_user()
    ); 