'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatPercentage, getROIStatus } from '@/lib/roi-calculations'
import { Database } from '@/lib/supabase'
import LoadingSpinner from '@/components/LoadingSpinner'
import Link from 'next/link'

type Idea = Database['public']['Tables']['ideas']['Row']
type ROISummary = Database['public']['Tables']['roi_summaries']['Row']

interface ProjectDashboardProps {
  onCreateNew: () => void
  onViewProject: (id: string) => void
}

interface ProjectWithROI {
  id: string
  organization_id: string
  title: string
  description: string
  category: string
  positioning_statement: string
  required_attributes: string
  competitor_overview: string
  created_by: string
  created_at: string
  roi_summary?: ROISummary | null
  created_by_user?: {
    full_name: string
  } | null
}

export default function ProjectDashboard({ onCreateNew, onViewProject }: ProjectDashboardProps) {
  const [projects, setProjects] = useState<ProjectWithROI[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [userRole, setUserRole] = useState<string | null>(null)
  const [organizationInviteCode, setOrganizationInviteCode] = useState<string | null>(null)
  const [showInviteCode, setShowInviteCode] = useState(false)

  useEffect(() => {
    loadProjects()
    checkUserRole()
  }, [])

  // Add click outside handler for invite code dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (showInviteCode && !target.closest('.invite-code-dropdown')) {
        setShowInviteCode(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showInviteCode])

  const checkUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Add timeout for the database query
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database query timeout')), 5000)
      )

      const queryPromise = supabase
        .from('users')
        .select('role, organization_id')
        .eq('id', user.id)
        .single()

      const { data: userData, error: userError } = await Promise.race([
        queryPromise,
        timeoutPromise
      ]) as any

      if (userError) {
        console.error('Error checking user role:', userError)
        return
      }

      if (userData?.role === 'admin' && userData?.organization_id) {
        setUserRole('admin')
        // Get the invite code for the organization
        const { data: orgData, error: orgError } = await supabase
          .from('organizations')
          .select('invite_code')
          .eq('id', userData.organization_id)
          .single()

        if (orgError) {
          console.error('Error fetching organization invite code:', orgError)
          return
        }

        if (orgData) {
          setOrganizationInviteCode(orgData.invite_code)
        }
      } else {
        setUserRole(userData?.role || null)
      }
    } catch (error) {
      console.error('Error checking user role:', error)
    }
  }

  const copyInviteCode = async () => {
    if (!organizationInviteCode) return
    
    try {
      await navigator.clipboard.writeText(organizationInviteCode)
      alert('Invite code copied to clipboard!')
    } catch (error) {
      console.error('Failed to copy invite code:', error)
      alert('Failed to copy invite code. Please copy it manually.')
    }
  }

  const loadProjects = async () => {
    try {
      setLoading(true)
      
      // Add a timeout for the database query
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database query timeout')), 10000)
      )
      
      // Fetch ideas with ROI summaries and user info
      const queryPromise = supabase
        .from('ideas')
        .select(`
          *,
          roi_summaries (*),
          created_by_user:users!ideas_created_by_fkey (full_name)
        `)
        .order('created_at', { ascending: false })

      const { data: ideas, error: ideasError } = await Promise.race([
        queryPromise,
        timeoutPromise
      ]) as any

      if (ideasError) {
        console.error('Error loading projects:', ideasError)
        return
      }

      // Transform the data to flatten ROI summary
      const projectsWithROI: ProjectWithROI[] = (ideas || []).map((idea: any) => ({
        ...idea,
        roi_summary: idea.roi_summaries?.[0] || null,
        created_by_user: idea.created_by_user
      }))

      setProjects(projectsWithROI)
    } catch (error) {
      console.error('Error loading projects:', error)
      // Don't show error to user for now, just log it
    } finally {
      setLoading(false)
    }
  }

  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         project.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = !categoryFilter || project.category === categoryFilter
    
    // Map database fields to ROIMetrics interface
    const roiMetrics = project.roi_summary
      ? {
          npv: project.roi_summary.npv || 0,
          irr: project.roi_summary.irr || 0,
          breakEvenMonth: project.roi_summary.break_even_month || 0,
          paybackPeriod: project.roi_summary.payback_period || 0,
          totalRevenue: 0, // Not stored in database, default to 0
          totalCosts: 0, // Not stored in database, default to 0
          contributionMarginPerUnit: 0,
          profitPerUnit: 0,
        }
      : {
          npv: 0,
          irr: 0,
          breakEvenMonth: 0,
          paybackPeriod: 0,
          totalRevenue: 0,
          totalCosts: 0,
          contributionMarginPerUnit: 0,
          profitPerUnit: 0,
        }
    
    const matchesStatus = !statusFilter || getROIStatus(roiMetrics) === statusFilter
    
    return matchesSearch && matchesCategory && matchesStatus
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'bg-success-100 text-success-800'
      case 'good': return 'bg-primary-100 text-primary-800'
      case 'fair': return 'bg-warning-100 text-warning-800'
      case 'poor': return 'bg-danger-100 text-danger-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const categories = Array.from(new Set(projects.map(p => p.category)))

  if (loading) {
    return (
      <LoadingSpinner 
        message="Loading projects..." 
        size="md"
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Product Projects</h2>
          <p className="text-gray-600">Manage and track your product ideas</p>
        </div>
        <div className="flex items-center space-x-4">
          {userRole === 'admin' && organizationInviteCode && (
            <div className="relative invite-code-dropdown">
              <button
                onClick={() => setShowInviteCode(!showInviteCode)}
                className="btn-secondary text-sm"
              >
                {showInviteCode ? 'Hide' : 'Show'} Invite Code
              </button>
              
              {showInviteCode && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-10">
                  <h4 className="font-medium text-gray-900 mb-2">Organization Invite Code</h4>
                  <p className="text-sm text-gray-600 mb-3">
                    Share this code with team members to let them join your organization.
                  </p>
                  <div className="flex items-center space-x-2 mb-3">
                    <input
                      type="text"
                      value={organizationInviteCode}
                      readOnly
                      className="flex-1 input-field bg-gray-50 text-sm"
                    />
                    <button
                      onClick={copyInviteCode}
                      className="btn-secondary px-3 py-2 text-sm"
                    >
                      Copy
                    </button>
                  </div>
                  <button
                    onClick={() => setShowInviteCode(false)}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          )}
          
          <button
            onClick={onCreateNew}
            className="btn-primary"
          >
            Create New Project
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="search" className="form-label">Search</label>
            <input
              id="search"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search projects..."
              className="input-field"
            />
          </div>
          
          <div>
            <label htmlFor="category" className="form-label">Category</label>
            <select
              id="category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="input-field"
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label htmlFor="status" className="form-label">ROI Status</label>
            <select
              id="status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input-field"
            >
              <option value="">All Statuses</option>
              <option value="excellent">Excellent</option>
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="poor">Poor</option>
            </select>
          </div>
        </div>
      </div>

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-gray-500">
            {projects.length === 0 ? (
              <>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No projects yet</h3>
                <p className="mb-4">Get started by creating your first product idea</p>
                <button onClick={onCreateNew} className="btn-primary">
                  Create Your First Project
                </button>
              </>
            ) : (
              <>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No projects match your filters</h3>
                <p>Try adjusting your search criteria</p>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => {
            // Map database fields to ROIMetrics interface for status calculation
            const roiMetrics = project.roi_summary
              ? {
                  npv: project.roi_summary.npv || 0,
                  irr: project.roi_summary.irr || 0,
                  breakEvenMonth: project.roi_summary.break_even_month || 0,
                  paybackPeriod: project.roi_summary.payback_period || 0,
                  totalRevenue: 0, // Not stored in database, default to 0
                  totalCosts: 0, // Not stored in database, default to 0
                  contributionMarginPerUnit: 0,
                  profitPerUnit: 0,
                }
              : {
                  npv: 0,
                  irr: 0,
                  breakEvenMonth: 0,
                  paybackPeriod: 0,
                  totalRevenue: 0,
                  totalCosts: 0,
                  contributionMarginPerUnit: 0,
                  profitPerUnit: 0,
                }
            
            const status = getROIStatus(roiMetrics)

            return (
              <Link key={project.id} href={`/products/${project.id}`} className="card hover:shadow-md transition-shadow cursor-pointer block no-underline">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">
                    {project.title}
                  </h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </span>
                </div>
                
                <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                  {project.description}
                </p>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Category:</span>
                    <span className="font-medium">{project.category}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-500">Created by:</span>
                    <span className="font-medium">{project.created_by_user?.full_name || 'Unknown'}</span>
                  </div>
                  
                  {project.roi_summary && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-500">NPV:</span>
                        <span className={`font-medium ${project.roi_summary.npv >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                          {formatCurrency(project.roi_summary.npv)}
                        </span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-gray-500">IRR:</span>
                        <span className={`font-medium ${project.roi_summary.irr >= 0.15 ? 'text-success-600' : project.roi_summary.irr >= 0.10 ? 'text-warning-600' : 'text-danger-600'}`}>
                          {formatPercentage(project.roi_summary.irr)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
                
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Created {new Date(project.created_at).toLocaleDateString()}</span>
                    <span className="text-primary-600 hover:text-primary-700">View Details →</span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
} 