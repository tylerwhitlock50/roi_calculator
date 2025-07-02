'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function SubmitIdeaPage() {
  const params = useParams<{ org_slug: string }>()
  const slug = params?.org_slug

  const [orgId, setOrgId] = useState<string | null>(null)
  const [orgName, setOrgName] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!slug) return
    supabase
      .from('organizations')
      .select('id, name')
      .eq('submission_slug', slug)
      .single()
      .then(({ data }) => {
        if (data) {
          setOrgId(data.id)
          setOrgName(data.name)
        }
        setLoading(false)
      })
  }, [slug])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgId) return
    setError(null)
    const { error } = await supabase.from('ideas').insert({
      organization_id: orgId,
      title: `${title} (submitted by: ${email})`,
      description,
      category: 'Uncategorized',
      positioning_statement: '',
      required_attributes: '',
      competitor_overview: '',
      created_by: null,
      submitter_email: email,
    })
    if (error) {
      setError('Could not submit idea')
    } else {
      setSubmitted(true)
    }
  }

  if (loading) return <p className="p-4">Loading...</p>
  if (!orgId) return <p className="p-4">Organization not found</p>
  if (submitted) return <div className="p-4">Thanks for submitting your idea!</div>

  return (
    <div className="max-w-xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold">Submit an Idea for {orgName}</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="form-label">Idea Title *</label>
          <input className="input-field" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div>
          <label className="form-label">Description *</label>
          <textarea className="input-field" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} required />
        </div>
        <div>
          <label className="form-label">Your Email *</label>
          <input type="email" className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        {error && <p className="text-danger-600 text-sm">{error}</p>}
        <button type="submit" className="btn-primary">Submit Idea</button>
      </form>
    </div>
  )
}
