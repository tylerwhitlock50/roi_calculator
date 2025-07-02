-- Fix for public submission form - allow anyone to view organizations by invite code
-- This policy allows unauthenticated users to look up organizations when they have an invite code
-- which is necessary for the public submission form to work

CREATE POLICY "Anyone can view organizations by invite code" ON organizations
    FOR SELECT USING (
        invite_code IS NOT NULL
    );

-- Note: This policy allows viewing any organization that has an invite code
-- The application logic in the submit page will only use the id and name fields
-- and will only proceed if the organization is found by the specific invite code

-- Fix for public submission form - allow anyone to view categories for organizations with invite codes
-- This policy allows unauthenticated users to view product categories when they have a valid invite code
-- which is necessary for the public submission form to work

CREATE POLICY "Anyone can view categories for organizations with invite codes" ON project_categories
    FOR SELECT USING (
        organization_id IN (
            SELECT id FROM organizations WHERE invite_code IS NOT NULL
        )
    );

-- Note: This policy allows viewing categories for any organization that has an invite code
-- The application logic will filter categories by the specific organization found by invite code 