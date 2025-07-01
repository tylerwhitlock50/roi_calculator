'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import AdminDashboard from '@/components/AdminDashboard'

export default function AdminPage() {
  const { user, userOrganization } = useAppStore()
  const [orgId, setOrgId] = useState<string | null>(null)

  useEffect(() => {
    if (userOrganization?.organization_id) {
      setOrgId(userOrganization.organization_id)
    }
  }, [userOrganization])

  if (!user || !orgId) return null

  return <AdminDashboard organizationId={orgId} />
}
