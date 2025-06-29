'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface OrganizationSetupProps {
  onComplete: () => void
}

export default function OrganizationSetup({ onComplete }: OrganizationSetupProps) {
  const [mode, setMode] = useState<'create' | 'join' | 'view-invite'>('create')
  const [orgName, setOrgName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [createdInviteCode, setCreatedInviteCode] = useState('')
  const [organizationName, setOrganizationName] = useState('')

  // Check if user is already in an organization and is admin
  useEffect(() => {
    const checkUserOrganization = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('organization_id, role')
          .eq('id', user.id)
          .single()

        if (userError) {
          console.error('Error checking user organization:', userError)
          // Don't set error here as it might be expected for new users
          return
        }

        if (userData?.organization_id && userData?.role === 'admin') {
          // User is admin, show invite code view
          const { data: orgData, error: orgError } = await supabase
            .from('organizations')
            .select('name, invite_code')
            .eq('id', userData.organization_id)
            .single()

          if (orgError) {
            console.error('Error fetching organization data:', orgError)
            return
          }

          if (orgData) {
            setOrganizationName(orgData.name)
            setCreatedInviteCode(orgData.invite_code)
            setMode('view-invite')
          }
        }
      } catch (error) {
        console.error('Error checking user organization:', error)
      }
    }

    checkUserOrganization()
  }, [])

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgName.trim()) {
      setError('Organization name is required')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Call the create_organization function
      const { data, error } = await supabase.rpc('create_organization', {
        org_name: orgName.trim()
      })

      if (error) {
        console.error('Error creating organization:', error)
        setError('Failed to create organization. Please try again.')
        return
      }

      // Update the current user to be an admin of this organization
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          organization_id: data,
          role: 'admin'
        })
        .eq('id', (await supabase.auth.getUser()).data.user?.id)

      if (updateError) {
        console.error('Error updating user:', updateError)
        setError('Organization created but failed to assign you as admin.')
        return
      }

      // Get the invite code for display
      const { data: orgData } = await supabase
        .from('organizations')
        .select('invite_code')
        .eq('id', data)
        .single()

      if (orgData) {
        setCreatedInviteCode(orgData.invite_code)
        setOrganizationName(orgName.trim())
        setMode('view-invite')
      } else {
        alert('Organization created successfully! You are now the admin.')
        onComplete()
      }
    } catch (error) {
      console.error('Error:', error)
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleJoinOrganization = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteCode.trim()) {
      setError('Invite code is required')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Call the join_organization function
      const { data, error } = await supabase.rpc('join_organization', {
        invite_code: inviteCode.trim()
      })

      if (error) {
        console.error('Error joining organization:', error)
        setError('Invalid invite code or failed to join organization.')
        return
      }

      if (!data) {
        setError('Invalid invite code. Please check and try again.')
        return
      }

      alert('Successfully joined organization!')
      onComplete()
    } catch (error) {
      console.error('Error:', error)
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const copyInviteCode = async () => {
    try {
      await navigator.clipboard.writeText(createdInviteCode)
      alert('Invite code copied to clipboard!')
    } catch (error) {
      console.error('Failed to copy invite code:', error)
      alert('Failed to copy invite code. Please copy it manually.')
    }
  }

  if (mode === 'view-invite') {
    return (
      <div className="max-w-md mx-auto">
        <div className="card">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Organization Invite Code</h2>
          <p className="text-gray-600 mb-6">
            Share this invite code with team members to let them join <strong>{organizationName}</strong>.
          </p>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Invite Code
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={createdInviteCode}
                readOnly
                className="flex-1 input-field bg-white"
              />
              <button
                onClick={copyInviteCode}
                className="btn-secondary px-4 py-2"
              >
                Copy
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <button
              onClick={onComplete}
              className="btn-primary w-full"
            >
              Continue to Dashboard
            </button>
            
            <button
              onClick={() => setMode('join')}
              className="btn-secondary w-full"
            >
              Join Another Organization
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="card">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Organization Setup</h2>
        <p className="text-gray-600 mb-6">
          You need to be part of an organization to use the Product ROI Tool. 
          Create a new organization or join an existing one using an invite code.
        </p>

        {/* Mode Toggle */}
        <div className="flex rounded-lg border border-gray-200 p-1 mb-6">
          <button
            type="button"
            onClick={() => setMode('create')}
            className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
              mode === 'create'
                ? 'bg-primary-600 text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Create Organization
          </button>
          <button
            type="button"
            onClick={() => setMode('join')}
            className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
              mode === 'join'
                ? 'bg-primary-600 text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Join Organization
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-danger-50 border border-danger-200 rounded-md">
            <p className="text-sm text-danger-600">{error}</p>
          </div>
        )}

        {mode === 'create' ? (
          <form onSubmit={handleCreateOrganization} className="space-y-4">
            <div>
              <label htmlFor="orgName" className="form-label">
                Organization Name *
              </label>
              <input
                id="orgName"
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="input-field"
                placeholder="Enter your organization name"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Organization'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleJoinOrganization} className="space-y-4">
            <div>
              <label htmlFor="inviteCode" className="form-label">
                Invite Code *
              </label>
              <input
                id="inviteCode"
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                className="input-field"
                placeholder="Enter the invite code"
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                Ask your organization admin for the invite code
              </p>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full disabled:opacity-50"
            >
              {loading ? 'Joining...' : 'Join Organization'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
} 