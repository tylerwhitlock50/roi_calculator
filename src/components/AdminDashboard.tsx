'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Database } from '@/lib/supabase'
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, Tooltip } from 'recharts'

interface AdminDashboardProps {
  organizationId: string
}

export default function AdminDashboard({ organizationId }: AdminDashboardProps) {
  const [users, setUsers] = useState<Database['public']['Tables']['users']['Row'][]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const [categories, setCategories] = useState<string[]>([])

  useEffect(() => {
    loadUsers()
    loadProjects()
    loadCategories()
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
