-- Test script for invite code functionality
-- Run this in Supabase SQL Editor to test the invite code system

-- Test 1: Create an organization
SELECT create_organization('Test Organization 1') as org_id;

-- Test 2: Get the invite code for the created organization
SELECT name, invite_code FROM organizations WHERE name = 'Test Organization 1';

-- Test 3: Test the join_organization function (this will fail if no user is authenticated)
-- SELECT join_organization('ORG-12345678');

-- Test 4: Check if the generate_invite_code function works
SELECT generate_invite_code() as new_invite_code;

-- Test 5: Verify the functions exist
SELECT 
    routine_name, 
    routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('create_organization', 'join_organization', 'generate_invite_code');

-- Test 6: Check RLS policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'organizations'; 