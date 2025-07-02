'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import ProductIdeaForm from '@/components/ProductIdeaForm'

export default function SubmitPage({ params }: { params: { code: string } }) {
  const [orgId, setOrgId] = useState<string | null>(null)
  const [orgName, setOrgName] = useState<string>('')
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    const loadOrg = async () => {
      const { data } = await supabase
        .from('organizations')
        .select('id,name')
        .eq('invite_code', params.code)
        .single()
      if (data) {
        setOrgId(data.id)
        setOrgName(data.name)
      }
    }
    loadOrg()
  }, [params.code])

  if (!orgId) {
    return <div className="p-6">Invalid submission link.</div>
  }

  if (submitted) {
    return <div className="p-6">Thank you for your idea!</div>
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
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
    </div>
  )
}
