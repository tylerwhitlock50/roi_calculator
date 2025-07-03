'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Database } from '@/lib/supabase'
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, Tooltip } from 'recharts'
import { QRCodeSVG } from 'qrcode.react'
import { getSubmissionUrl } from '@/lib/getSubmissionUrl'

interface AdminDashboardProps {
  organizationId: string
}

type ActivityRate = {
  id: string
  activity_name: string
  rate_per_hour: number
  created_at: string
}

export default function AdminDashboard({ organizationId }: AdminDashboardProps) {
  const [users, setUsers] = useState<Database['public']['Tables']['users']['Row'][]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [submissions, setSubmissions] = useState<Database['public']['Tables']['idea_submissions']['Row'][]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const [categories, setCategories] = useState<string[]>([])
  const [activityRates, setActivityRates] = useState<ActivityRate[]>([])
  const [newActivityRate, setNewActivityRate] = useState({ name: '', rate: 0 })
  const [editingRate, setEditingRate] = useState<ActivityRate | null>(null)
  const [organizationInviteCode, setOrganizationInviteCode] = useState('')
  const [selectedSubmission, setSelectedSubmission] = useState<Database['public']['Tables']['idea_submissions']['Row'] | null>(null)
  const [convertingSubmission, setConvertingSubmission] = useState(false)

  useEffect(() => {
    loadUsers()
    loadProjects()
    loadCategories()
    loadActivityRates()
    loadSubmissions()
    loadInviteCode()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadUsers = async () => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('organization_id', organizationId)
    if (data) setUsers(data)
  }

  const loadProjects = async () => {
    const { data } = await supabase
      .from('ideas')
      .select('id,title,roi_summaries(irr,npv)')
      .eq('organization_id', organizationId)
    if (data) {
      setProjects(
        data.map((p: any) => ({
          id: p.id,
          title: p.title,
          irr: p.roi_summaries?.[0]?.irr ?? 0,
          npv: p.roi_summaries?.[0]?.npv ?? 0
        }))
      )
    }
  }

  const loadCategories = async () => {
    const { data } = await supabase
      .from('project_categories')
      .select('name')
      .eq('organization_id', organizationId)
    if (data) setCategories(data.map(c => c.name))
  }

  const loadActivityRates = async () => {
    const { data } = await supabase
      .from('activity_rates')
      .select('*')
      .eq('organization_id', organizationId)
      .order('activity_name')
    if (data) setActivityRates(data)
  }

  const loadSubmissions = async () => {
    const { data } = await supabase
      .from('idea_submissions')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
    if (data) setSubmissions(data)
  }

  const loadInviteCode = async () => {
    const { data } = await supabase
      .from('organizations')
      .select('invite_code')
      .eq('id', organizationId)
      .single()
    if (data) setOrganizationInviteCode(data.invite_code)
  }

  const inviteUser = async () => {
    if (!inviteEmail) return
    setLoading(true)
    const res = await fetch('/api/invite-user', {
      method: 'POST',
      body: JSON.stringify({ email: inviteEmail, organizationId })
    })
    setLoading(false)
    if (res.ok) {
      setInviteEmail('')
      loadUsers()
      alert('Invitation sent')
    } else {
      const j = await res.json()
      alert(j.error || 'Failed to invite')
    }
  }

  const deleteUser = async (id: string) => {
    if (!confirm('Delete this user?')) return
    await fetch('/api/delete-user', {
      method: 'POST',
      body: JSON.stringify({ userId: id })
    })
    loadUsers()
  }

  const addActivityRate = async () => {
    if (!newActivityRate.name || newActivityRate.rate <= 0) return
    const { error } = await supabase.from('activity_rates').insert({
      organization_id: organizationId,
      activity_name: newActivityRate.name,
      rate_per_hour: newActivityRate.rate
    })
    if (!error) {
      setNewActivityRate({ name: '', rate: 0 })
      loadActivityRates()
    } else {
      alert('Failed to add activity rate')
    }
  }

  const updateActivityRate = async () => {
    if (!editingRate || !editingRate.activity_name || editingRate.rate_per_hour <= 0) return
    const { error } = await supabase.from('activity_rates').update({
      activity_name: editingRate.activity_name,
      rate_per_hour: editingRate.rate_per_hour
    }).eq('id', editingRate.id)
    if (!error) {
      setEditingRate(null)
      loadActivityRates()
    } else {
      alert('Failed to update activity rate')
    }
  }

  const deleteActivityRate = async (id: string) => {
    if (!confirm('Delete this activity rate?')) return
    const { error } = await supabase.from('activity_rates').delete().eq('id', id)
    if (!error) {
      loadActivityRates()
    } else {
      alert('Failed to delete activity rate')
    }
  }

  const convertSubmissionToIdea = async (submission: Database['public']['Tables']['idea_submissions']['Row']) => {
    if (!confirm('Convert this submission to an internal idea?')) return
    
    setConvertingSubmission(true)
    
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert('You must be logged in to convert submissions')
        return
      }

      // Create the idea
      const { error: ideaError } = await supabase.from('ideas').insert({
        organization_id: submission.organization_id,
        title: submission.title,
        description: submission.description,
        category: submission.category,
        positioning_statement: submission.positioning_statement,
        required_attributes: submission.required_attributes,
        competitor_overview: submission.competitor_overview,
        created_by: user.id,
        status: 'pending'
      })

      if (ideaError) {
        console.error('Error creating idea:', ideaError)
        alert('Failed to convert submission to idea')
        return
      }

      // Delete the submission
      const { error: deleteError } = await supabase
        .from('idea_submissions')
        .delete()
        .eq('id', submission.id)

      if (deleteError) {
        console.error('Error deleting submission:', deleteError)
        alert('Idea created but failed to delete original submission')
      } else {
        alert('Submission successfully converted to idea!')
      }

      // Reload data
      loadSubmissions()
      loadProjects()
      setSelectedSubmission(null)
    } catch (error) {
      console.error('Error converting submission:', error)
      alert('An error occurred while converting the submission')
    } finally {
      setConvertingSubmission(false)
    }
  }

  const deleteSubmission = async (id: string) => {
    if (!confirm('Delete this submission? This action cannot be undone.')) return
    
    const { error } = await supabase
      .from('idea_submissions')
      .delete()
      .eq('id', id)
    
    if (error) {
      console.error('Error deleting submission:', error)
      alert('Failed to delete submission')
    } else {
      loadSubmissions()
      setSelectedSubmission(null)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Submitted Ideas</h2>
      <div className="mb-4">
        <label className="form-label">Idea submission URL</label>
        <div className="flex items-center space-x-2">
          <input
            className="input-field flex-1"
            type="text"
            readOnly
            value={getSubmissionUrl(organizationInviteCode || '')}
          />
          <button
            onClick={() => navigator.clipboard.writeText(getSubmissionUrl(organizationInviteCode || ''))}
            className="btn-secondary text-sm"
          >
            Copy
          </button>
        </div>
        {organizationInviteCode && (
          <div className="mt-2">
            <QRCodeSVG value={getSubmissionUrl(organizationInviteCode)} size={128} />
          </div>
        )}
      </div>
      {submissions.length === 0 ? (
        <p className="text-gray-500">No submissions yet.</p>
      ) : (
        <div className="space-y-4 mb-6">
          {submissions.map(s => (
            <div key={s.id} className="border rounded-lg p-4 bg-white shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{s.title}</h3>
                  {s.submitter_email && (
                    <p className="text-sm text-gray-500">From: {s.submitter_email}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    Submitted: {new Date(s.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setSelectedSubmission(selectedSubmission?.id === s.id ? null : s)}
                    className="btn-secondary text-sm"
                  >
                    {selectedSubmission?.id === s.id ? 'Hide Details' : 'View Details'}
                  </button>
                  <button
                    onClick={() => convertSubmissionToIdea(s)}
                    disabled={convertingSubmission}
                    className="btn-primary text-sm"
                  >
                    {convertingSubmission ? 'Converting...' : 'Convert to Idea'}
                  </button>
                  <button
                    onClick={() => deleteSubmission(s.id)}
                    className="text-red-600 text-sm hover:text-red-800"
                  >
                    Delete
                  </button>
                </div>
              </div>
              
              <p className="text-gray-700 mb-2">{s.description}</p>
              
              {selectedSubmission?.id === s.id && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-3">
                  <div>
                    <h4 className="font-medium text-sm text-gray-700">Category</h4>
                    <p className="text-sm">{s.category}</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-sm text-gray-700">Positioning Statement</h4>
                    <p className="text-sm">{s.positioning_statement}</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-sm text-gray-700">Required Attributes</h4>
                    <p className="text-sm">{s.required_attributes}</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-sm text-gray-700">Competitor Overview</h4>
                    <p className="text-sm">{s.competitor_overview}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <h2 className="text-2xl font-bold">Organization Users</h2>

      <div className="flex space-x-2 items-center">
        <input
          className="input-field"
          type="email"
          placeholder="user@example.com"
          value={inviteEmail}
          onChange={e => setInviteEmail(e.target.value)}
        />
        <button onClick={inviteUser} className="btn-primary" disabled={loading}>
          Invite
        </button>
      </div>

      <ul className="divide-y divide-gray-200">
        {users.map(u => (
          <li key={u.id} className="py-2 flex justify-between">
            <span>{u.email}</span>
            <button onClick={() => deleteUser(u.id)} className="text-red-600 text-sm">Delete</button>
          </li>
        ))}
      </ul>

      <h2 className="text-2xl font-bold pt-8">Project Categories</h2>
      <div className="flex space-x-2 items-center mb-4">
        <input
          className="input-field"
          type="text"
          placeholder="New category"
          value={newCategory}
          onChange={e => setNewCategory(e.target.value)}
        />
        <button
          onClick={async () => {
            if (!newCategory) return
            await supabase.from('project_categories').insert({ name: newCategory, organization_id: organizationId })
            setNewCategory('')
            loadCategories()
          }}
          className="btn-primary"
        >
          Add
        </button>
      </div>
      <ul className="list-disc pl-5">
        {categories.map(c => (
          <li key={c}>{c}</li>
        ))}
      </ul>

      <h2 className="text-2xl font-bold pt-8">Activity Rates</h2>
      <div className="flex space-x-2 items-center mb-4">
        <input
          className="input-field"
          type="text"
          placeholder="Activity name"
          value={newActivityRate.name}
          onChange={e => setNewActivityRate(prev => ({ ...prev, name: e.target.value }))}
        />
        <input
          className="input-field w-32"
          type="number"
          min="0"
          step="0.01"
          placeholder="Rate/hr"
          value={newActivityRate.rate}
          onChange={e => setNewActivityRate(prev => ({ ...prev, rate: parseFloat(e.target.value) || 0 }))}
        />
        <button onClick={addActivityRate} className="btn-primary">
          Add Rate
        </button>
      </div>
      
      <div className="space-y-2">
        {activityRates.map(rate => (
          <div key={rate.id} className="flex items-center justify-between p-3 border rounded">
            {editingRate?.id === rate.id ? (
              <div className="flex space-x-2 items-center flex-1">
                <input
                  className="input-field flex-1"
                  type="text"
                  value={editingRate.activity_name}
                  onChange={e => setEditingRate(prev => prev ? { ...prev, activity_name: e.target.value } : null)}
                />
                <input
                  className="input-field w-32"
                  type="number"
                  min="0"
                  step="0.01"
                  value={editingRate.rate_per_hour}
                  onChange={e => setEditingRate(prev => prev ? { ...prev, rate_per_hour: parseFloat(e.target.value) || 0 } : null)}
                />
                <button onClick={updateActivityRate} className="btn-secondary text-sm">Save</button>
                <button onClick={() => setEditingRate(null)} className="btn text-sm">Cancel</button>
              </div>
            ) : (
              <>
                <div>
                  <span className="font-medium">{rate.activity_name}</span>
                  <span className="text-gray-500 ml-2">${rate.rate_per_hour}/hr</span>
                </div>
                <div className="flex space-x-2">
                  <button onClick={() => setEditingRate(rate)} className="btn-secondary text-sm">Edit</button>
                  <button onClick={() => deleteActivityRate(rate.id)} className="text-red-600 text-sm">Delete</button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <h2 className="text-2xl font-bold pt-8">Project ROI</h2>
      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
          <ScatterChart>
            <XAxis dataKey="npv" name="NPV" />
            <YAxis dataKey="irr" name="IRR" tickFormatter={v => `${(v*100).toFixed(1)}%`} />
            <Tooltip formatter={(value: any) => typeof value === 'number' ? value.toFixed(2) : value} />
            <Scatter data={projects} fill="#8884d8" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
