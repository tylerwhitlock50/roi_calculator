'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatPercentage, getROIStatus } from '@/lib/roi-calculations'
import { Database } from '@/lib/supabase'
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

  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    try {
      setLoading(true)
      
      // Fetch ideas with ROI summaries and user info
      const { data: ideas, error: ideasError } = await supabase
        .from('ideas')
        .select(`
          *,
          roi_summaries (*),
          created_by_user:users!ideas_created_by_fkey (full_name)
        `)
        .order('created_at', { ascending: false })

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
    } finally {
      setLoading(false)
    }
  }

  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         project.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = !categoryFilter || project.category === categoryFilter
    
    // Map database fields to ROIMetrics interface
    const roiMetrics = project.roi_summary ? {
      npv: project.roi_summary.npv || 0,
      irr: project.roi_summary.irr || 0,
      breakEvenMonth: project.roi_summary.break_even_month || 0,
      paybackPeriod: project.roi_summary.payback_period || 0,
      totalRevenue: 0, // Not stored in database, default to 0
      totalCosts: 0    // Not stored in database, default to 0
    } : {
      npv: 0,
      irr: 0,
      breakEvenMonth: 0,
      paybackPeriod: 0,
      totalRevenue: 0,
      totalCosts: 0
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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Product Projects</h2>
          <p className="text-gray-600">Manage and track your product ideas</p>
        </div>
        <button
          onClick={onCreateNew}
          className="btn-primary"
        >
          Create New Project
        </button>
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
            const roiMetrics = project.roi_summary ? {
              npv: project.roi_summary.npv || 0,
              irr: project.roi_summary.irr || 0,
              breakEvenMonth: project.roi_summary.break_even_month || 0,
              paybackPeriod: project.roi_summary.payback_period || 0,
              totalRevenue: 0, // Not stored in database, default to 0
              totalCosts: 0    // Not stored in database, default to 0
            } : {
              npv: 0,
              irr: 0,
              breakEvenMonth: 0,
              paybackPeriod: 0,
              totalRevenue: 0,
              totalCosts: 0
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