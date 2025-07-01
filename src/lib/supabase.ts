import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types based on the schema from the PRD
export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          invite_code: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          invite_code: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          invite_code?: string
          created_at?: string
        }
      }
      users: {
        Row: {
          id: string
          email: string
          full_name: string
          organization_id: string
          role: 'admin' | 'member'
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          full_name: string
          organization_id: string
          role?: 'admin' | 'member'
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          organization_id?: string
          role?: 'admin' | 'member'
          is_active?: boolean
          created_at?: string
        }
      }
      ideas: {
        Row: {
          id: string
          organization_id: string
          title: string
          description: string
          category: string
          status: 'pending' | 'approved' | 'archived'
          positioning_statement: string
          required_attributes: string
          competitor_overview: string
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          title: string
          description: string
          category: string
          status?: 'pending' | 'approved' | 'archived'
          positioning_statement: string
          required_attributes: string
          competitor_overview: string
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          title?: string
          description?: string
          category?: string
          status?: 'pending' | 'approved' | 'archived'
          positioning_statement?: string
          required_attributes?: string
          competitor_overview?: string
          created_by?: string
          created_at?: string
        }
      }
      sales_forecasts: {
        Row: {
          id: string
          idea_id: string
          contributor_id: string
          contributor_role: string
          channel_or_customer: string
          monthly_volume_estimate: Record<string, number>
          created_at: string
        }
        Insert: {
          id?: string
          idea_id: string
          contributor_id: string
          contributor_role: string
          channel_or_customer: string
          monthly_volume_estimate: Record<string, number>
          created_at?: string
        }
        Update: {
          id?: string
          idea_id?: string
          contributor_id?: string
          contributor_role?: string
          channel_or_customer?: string
          monthly_volume_estimate?: Record<string, number>
          created_at?: string
        }
      }
      cost_estimates: {
        Row: {
          id: string
          idea_id: string
          bom_lines: Array<{
            item: string
            cost: number
            quantity: number
          }>
          tooling_cost: number
          engineering_hours: number
          marketing_budget: number
          ppc_budget: number
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          idea_id: string
          bom_lines: Array<{
            item: string
            cost: number
            quantity: number
          }>
          tooling_cost: number
          engineering_hours: number
          marketing_budget: number
          ppc_budget: number
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          idea_id?: string
          bom_lines?: Array<{
            item: string
            cost: number
            quantity: number
          }>
          tooling_cost?: number
          engineering_hours?: number
          marketing_budget?: number
          ppc_budget?: number
          created_by?: string
          created_at?: string
        }
      }
      roi_summaries: {
        Row: {
          id: string
          idea_id: string
          npv: number
          irr: number
          break_even_month: number
          payback_period: number
          assumptions: Record<string, any>
          created_at: string
        }
        Insert: {
          id?: string
          idea_id: string
          npv: number
          irr: number
          break_even_month: number
          payback_period: number
          assumptions: Record<string, any>
          created_at?: string
        }
        Update: {
          id?: string
          idea_id?: string
          npv?: number
          irr?: number
          break_even_month?: number
          payback_period?: number
          assumptions?: Record<string, any>
          created_at?: string
        }
      }
      project_categories: {
        Row: {
          id: string
          organization_id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          created_at?: string
        }
      }
    }
  }
}
