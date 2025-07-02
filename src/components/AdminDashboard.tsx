'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Database } from '@/lib/supabase'
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, Tooltip } from 'recharts'

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
  const [inviteEmail, setInviteEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const [categories, setCategories] = useState<string[]>([])
  const [activityRates, setActivityRates] = useState<ActivityRate[]>([])
  const [newActivityRate, setNewActivityRate] = useState({ name: '', rate: 0 })
  const [editingRate, setEditingRate] = useState<ActivityRate | null>(null)

  useEffect(() => {
    loadUsers()
    loadProjects()
    loadCategories()
    loadActivityRates()
  }, [])

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

  return (
    <div className="space-y-6">
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
