import { supabase } from './supabase'

export async function debugDatabaseConnection() {
  console.log('=== Database Connection Debug ===')
  
  try {
    // Test 1: Basic connection
    console.log('1. Testing basic connection...')
    const { data: testData, error: testError } = await supabase
      .from('users')
      .select('count')
      .limit(1)
    
    if (testError) {
      console.error('❌ Basic connection failed:', testError)
      return false
    }
    console.log('✅ Basic connection successful')
    
    // Test 2: Get current user
    console.log('2. Testing current user...')
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError) {
      console.error('❌ User auth failed:', userError)
      return false
    }
    
    if (!user) {
      console.log('⚠️ No authenticated user found')
      return false
    }
    
    console.log('✅ User authenticated:', user.email)
    
    // Test 3: Query user profile
    console.log('3. Testing user profile query...')
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, email, organization_id, role')
      .eq('id', user.id)
      .maybeSingle()
    
    if (profileError) {
      console.error('❌ Profile query failed:', profileError)
      return false
    }
    
    if (!profile) {
      console.log('⚠️ No user profile found - user may need to be created')
      return false
    }
    
    console.log('✅ User profile found:', profile)
    
    // Test 4: Test organization query if user has one
    if (profile.organization_id) {
      console.log('4. Testing organization query...')
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('id', profile.organization_id)
        .maybeSingle()
      
      if (orgError) {
        console.error('❌ Organization query failed:', orgError)
        return false
      }
      
      if (org) {
        console.log('✅ Organization found:', org)
      } else {
        console.log('⚠️ Organization not found (may be deleted)')
      }
    } else {
      console.log('4. Skipping organization query - user has no organization')
    }
    
    console.log('=== Debug Complete ===')
    return true
    
  } catch (error) {
    console.error('❌ Debug failed with exception:', error)
    return false
  }
}

export async function createTestUserProfile(userId: string) {
  console.log('Creating test user profile for:', userId)
  
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      throw new Error('No authenticated user')
    }
    
    const { error } = await supabase
      .from('users')
      .insert({
        id: userId,
        email: user.email || '',
        full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Test User',
        organization_id: null,
        role: 'member'
      })
    
    if (error) {
      console.error('Error creating test profile:', error)
      return false
    }
    
    console.log('✅ Test user profile created successfully')
    return true
    
  } catch (error) {
    console.error('Error in createTestUserProfile:', error)
    return false
  }
}

export async function debugOrganizations() {
  console.log('=== Debugging Organizations ===')
  
  // Check all organizations
  const { data: orgs, error: orgError } = await supabase
    .from('organizations')
    .select('id, name, invite_code, created_at')
    .order('created_at', { ascending: false })
  
  if (orgError) {
    console.error('Error fetching organizations:', orgError)
    return
  }
  
  console.log('All organizations:', orgs)
  
  // Check specific invite code
  const testCode = 'ORG-C236D9BA'
  const { data: specificOrg, error: specificError } = await supabase
    .from('organizations')
    .select('id, name, invite_code')
    .eq('invite_code', testCode)
    .single()
  
  console.log(`Looking for invite code "${testCode}":`, { data: specificOrg, error: specificError })
  
  return { orgs, specificOrg }
} 