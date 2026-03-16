// Debug script for organization checking
// Run with: node scripts/debug-org-check.js

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load environment variables from .env file manually
function loadEnvFile() {
  const envPath = path.join(__dirname, '..', '.env')
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8')
    const envVars = {}
    
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=')
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim()
        if (!value.startsWith('#')) {
          envVars[key.trim()] = value.replace(/^["']|["']$/g, '')
        }
      }
    })
    
    return envVars
  }
  return {}
}

const envVars = loadEnvFile()
const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables')
  console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkUserExists() {
  console.log('Checking if user exists in users table...')
  const start = Date.now()
  
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .limit(1)
      .single()
    
    const duration = Date.now() - start
    console.log(`User check took ${duration}ms`)
    
    if (error) {
      console.error('Error checking user:', error)
      return false
    }
    
    console.log('User exists:', !!data)
    return !!data
  } catch (error) {
    const duration = Date.now() - start
    console.error(`User check failed after ${duration}ms:`, error)
    return false
  }
}

async function testRPCFunctions() {
  console.log('\nTesting RPC functions...')
  
  // Test organization ID function
  console.log('Testing get_organization_id_for_current_user...')
  const orgStart = Date.now()
  try {
    const { data: orgId, error: orgError } = await supabase.rpc('get_organization_id_for_current_user')
    const orgDuration = Date.now() - orgStart
    console.log(`Organization ID check took ${orgDuration}ms`)
    
    if (orgError) {
      console.error('Organization ID error:', orgError)
    } else {
      console.log('Organization ID:', orgId)
    }
  } catch (error) {
    const orgDuration = Date.now() - orgStart
    console.error(`Organization ID check failed after ${orgDuration}ms:`, error)
  }
  
  // Test role function
  console.log('\nTesting get_user_role_for_current_user...')
  const roleStart = Date.now()
  try {
    const { data: role, error: roleError } = await supabase.rpc('get_user_role_for_current_user')
    const roleDuration = Date.now() - roleStart
    console.log(`Role check took ${roleDuration}ms`)
    
    if (roleError) {
      console.error('Role error:', roleError)
    } else {
      console.log('Role:', role)
    }
  } catch (error) {
    const roleDuration = Date.now() - roleStart
    console.error(`Role check failed after ${roleDuration}ms:`, error)
  }
}

async function testParallelRPC() {
  console.log('\nTesting parallel RPC calls...')
  const start = Date.now()
  
  try {
    const [{ data: orgId, error: orgError }, { data: role, error: roleError }] = await Promise.all([
      supabase.rpc('get_organization_id_for_current_user'),
      supabase.rpc('get_user_role_for_current_user')
    ])
    
    const duration = Date.now() - start
    console.log(`Parallel RPC calls took ${duration}ms`)
    
    console.log('Results:', { orgId, role, orgError, roleError })
  } catch (error) {
    const duration = Date.now() - start
    console.error(`Parallel RPC calls failed after ${duration}ms:`, error)
  }
}

async function testAuthStatus() {
  console.log('\nChecking authentication status...')
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error) {
      console.error('Auth error:', error)
      console.log('User is not authenticated')
    } else if (user) {
      console.log('User is authenticated:', user.email)
      console.log('User ID:', user.id)
    } else {
      console.log('No authenticated user found')
    }
  } catch (error) {
    console.error('Error checking auth status:', error)
  }
}

async function main() {
  console.log('Starting organization check debug...')
  console.log('Supabase URL:', supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'Not set')
  console.log('Supabase Key:', supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'Not set')
  
  await testAuthStatus()
  await checkUserExists()
  await testRPCFunctions()
  await testParallelRPC()
  
  console.log('\nDebug complete!')
}

main().catch(console.error) 