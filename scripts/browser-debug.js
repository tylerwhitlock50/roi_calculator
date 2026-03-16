// Browser debug script for organization checking
// Copy and paste this into your browser console while on your app

async function debugOrganizationCheck() {
  console.log('🔍 Starting organization check debug...')
  
  // Get the supabase client from the window object (if available)
  const supabase = window.supabase || window.__SUPABASE__ || window.supabaseClient
  
  if (!supabase) {
    console.error('❌ Supabase client not found in window object')
    console.log('Make sure you\'re running this in the browser console of your app')
    return
  }
  
  console.log('✅ Supabase client found')
  
  // Check authentication status
  console.log('\n🔐 Checking authentication status...')
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error) {
      console.error('❌ Auth error:', error)
      console.log('User is not authenticated')
    } else if (user) {
      console.log('✅ User is authenticated:', user.email)
      console.log('User ID:', user.id)
    } else {
      console.log('⚠️ No authenticated user found')
    }
  } catch (error) {
    console.error('❌ Error checking auth status:', error)
  }
  
  // Check if user exists in users table
  console.log('\n👤 Checking if user exists in users table...')
  const userStart = Date.now()
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .limit(1)
      .single()
    
    const duration = Date.now() - userStart
    console.log(`⏱️ User check took ${duration}ms`)
    
    if (error) {
      console.error('❌ Error checking user:', error)
      console.log('User does not exist in users table')
    } else {
      console.log('✅ User exists in users table:', !!data)
    }
  } catch (error) {
    const duration = Date.now() - userStart
    console.error(`❌ User check failed after ${duration}ms:`, error)
  }
  
  // Test organization ID function
  console.log('\n🏢 Testing get_organization_id_for_current_user...')
  const orgStart = Date.now()
  try {
    const { data: orgId, error: orgError } = await supabase.rpc('get_organization_id_for_current_user')
    const orgDuration = Date.now() - orgStart
    console.log(`⏱️ Organization ID check took ${orgDuration}ms`)
    
    if (orgError) {
      console.error('❌ Organization ID error:', orgError)
    } else {
      console.log('✅ Organization ID:', orgId)
    }
  } catch (error) {
    const orgDuration = Date.now() - orgStart
    console.error(`❌ Organization ID check failed after ${orgDuration}ms:`, error)
  }
  
  // Test role function
  console.log('\n👑 Testing get_user_role_for_current_user...')
  const roleStart = Date.now()
  try {
    const { data: role, error: roleError } = await supabase.rpc('get_user_role_for_current_user')
    const roleDuration = Date.now() - roleStart
    console.log(`⏱️ Role check took ${roleDuration}ms`)
    
    if (roleError) {
      console.error('❌ Role error:', roleError)
    } else {
      console.log('✅ Role:', role)
    }
  } catch (error) {
    const roleDuration = Date.now() - roleStart
    console.error(`❌ Role check failed after ${roleDuration}ms:`, error)
  }
  
  // Test parallel RPC calls
  console.log('\n⚡ Testing parallel RPC calls...')
  const parallelStart = Date.now()
  try {
    const [{ data: orgId, error: orgError }, { data: role, error: roleError }] = await Promise.all([
      supabase.rpc('get_organization_id_for_current_user'),
      supabase.rpc('get_user_role_for_current_user')
    ])
    
    const duration = Date.now() - parallelStart
    console.log(`⏱️ Parallel RPC calls took ${duration}ms`)
    
    console.log('✅ Results:', { orgId, role, orgError, roleError })
  } catch (error) {
    const duration = Date.now() - parallelStart
    console.error(`❌ Parallel RPC calls failed after ${duration}ms:`, error)
  }
  
  // Test the getUserOrganization function
  console.log('\n🔄 Testing getUserOrganization function...')
  const funcStart = Date.now()
  try {
    // Import the function if available
    if (typeof window.getUserOrganization === 'function') {
      const result = await window.getUserOrganization()
      const duration = Date.now() - funcStart
      console.log(`⏱️ getUserOrganization took ${duration}ms`)
      console.log('✅ Result:', result)
    } else {
      console.log('⚠️ getUserOrganization function not available in window object')
    }
  } catch (error) {
    const duration = Date.now() - funcStart
    console.error(`❌ getUserOrganization failed after ${duration}ms:`, error)
  }
  
  console.log('\n🎉 Debug complete!')
}

// Auto-run the debug function
debugOrganizationCheck().catch(console.error)

// Also make it available globally
window.debugOrganizationCheck = debugOrganizationCheck 