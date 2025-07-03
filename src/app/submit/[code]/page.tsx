'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ProductIdeaForm from '@/components/ProductIdeaForm'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'

export default function SubmitPage() {
  const params = useParams<{ code: string }>()
  const code = params?.code
  const [orgId, setOrgId] = useState<string | null>(null)
  const [orgName, setOrgName] = useState<string>('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!code) {
      setLoading(false)
      setError('No invite code provided')
      return
    }
    
    const loadOrg = async () => {
      try {
        const { data, error: dbError } = await supabase
          .from('organizations')
          .select('id,name')
          .eq('invite_code', code)
          .single()
        
        if (dbError) {
          console.error('Database error:', dbError)
          setError(`Database error: ${dbError.message}`)
          setLoading(false)
          return
        }
        
        if (data) {
          setOrgId(data.id)
          setOrgName(data.name)
        } else {
          setError('Invalid invite code - no organization found')
        }
      } catch (err) {
        console.error('Unexpected error:', err)
        setError('An unexpected error occurred')
      } finally {
        setLoading(false)
      }
    }
    
    loadOrg()
  }, [code])

  if (loading) {
    return <div className="p-6">Loading...</div>
  }

  if (error) {
    return <div className="p-6 text-red-600">Error: {error}</div>
  }

  if (!code) {
    return <div className="p-6">Invalid submission link.</div>
  }

  if (!orgId) {
    return <div className="p-6">Invalid submission link - organization not found.</div>
  }

  if (submitted) {
    return <div className="p-6">Thank you for your idea!</div>
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-grow max-w-2xl mx-auto p-4 sm:p-6">
        <h1 className="text-2xl font-bold mb-4">Submit an Idea for {orgName}</h1>
        <ProductIdeaForm
          organizationId={orgId}
          includeEmail
          onComplete={async (data) => {
            await supabase.from('idea_submissions').insert({
              ...data,
              organization_id: orgId
            })
            setSubmitted(true)
          }}
        />
      </main>
      <SiteFooter />
    </div>
  )
}
