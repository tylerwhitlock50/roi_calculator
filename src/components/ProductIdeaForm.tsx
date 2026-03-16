'use client'

import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { DEFAULT_CATEGORIES } from '@/lib/constants'

const productIdeaSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title must be less than 100 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters').max(1000, 'Description must be less than 1000 characters'),
  category: z.string().min(1, 'Category is required'),
  positioning_statement: z.string().min(10, 'Positioning statement must be at least 10 characters').max(500, 'Positioning statement must be less than 500 characters'),
  required_attributes: z.string().min(10, 'Required attributes must be at least 10 characters').max(1000, 'Required attributes must be less than 1000 characters'),
  competitor_overview: z.string().min(10, 'Competitor overview must be at least 10 characters').max(1000, 'Competitor overview must be less than 1000 characters'),
  submitter_email: z.string().email('Invalid email').optional().or(z.literal('')),
})

export type ProductIdeaFormData = z.infer<typeof productIdeaSchema>

interface ProductIdeaFormProps {
  onComplete: (data: ProductIdeaFormData) => void
  initialData?: Partial<ProductIdeaFormData>
  isLoading?: boolean
  includeEmail?: boolean
}

export default function ProductIdeaForm({
  onComplete,
  initialData,
  isLoading = false,
  includeEmail = false,
}: ProductIdeaFormProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const totalSteps = 3

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<ProductIdeaFormData>({
    resolver: zodResolver(productIdeaSchema),
    defaultValues: initialData,
    mode: 'onChange',
  })

  const watchedValues = watch()

  const handleFormSubmit = (data: ProductIdeaFormData) => {
    if (currentStep === totalSteps) {
      onComplete(data)
      return
    }

    setCurrentStep((value) => value + 1)
  }

  const isStepValid = (step: number) => {
    switch (step) {
      case 1:
        return (
          watchedValues.title &&
          watchedValues.description &&
          watchedValues.category &&
          !errors.title &&
          !errors.description &&
          !errors.category &&
          !errors.submitter_email
        )
      case 2:
        return watchedValues.positioning_statement && !errors.positioning_statement
      case 3:
        return watchedValues.required_attributes && watchedValues.competitor_overview && !errors.required_attributes && !errors.competitor_overview
      default:
        return false
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-0">
      <div className="mb-6 sm:mb-8">
        <div className="flex justify-center gap-x-8 sm:gap-x-12 max-w-xl mx-auto">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex items-center">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                step <= currentStep
                  ? 'bg-primary-600 border-primary-600 text-white'
                  : 'border-gray-300 text-gray-500'
              }`}>
                {step}
              </div>
              {step < 3 && (
                <div className={`w-12 sm:w-16 h-1 mx-2 ${
                  step < currentStep ? 'bg-primary-600' : 'bg-gray-300'
                }`} />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-center gap-x-8 sm:gap-x-32 mt-2 text-sm text-gray-600 max-w-xl mx-auto">
          <span>Basic Info</span>
          <span>Positioning</span>
          <span>Requirements</span>
        </div>
      </div>

      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6 sm:space-y-8">
        {currentStep === 1 && (
          <div className="form-section">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Basic Product Information</h3>

            {includeEmail && (
              <div className="form-group">
                <label htmlFor="submitter_email" className="form-label">
                  Your Email
                </label>
                <input
                  id="submitter_email"
                  type="email"
                  {...register('submitter_email')}
                  className={`input-field ${errors.submitter_email ? 'border-danger-500' : ''}`}
                  placeholder="you@example.com"
                />
                {errors.submitter_email && (
                  <p className="form-error">{errors.submitter_email.message}</p>
                )}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="title" className="form-label">
                Product Title *
              </label>
              <input
                id="title"
                type="text"
                {...register('title')}
                className={`input-field ${errors.title ? 'border-danger-500' : ''}`}
                placeholder="Enter a descriptive product title"
              />
              {errors.title && <p className="form-error">{errors.title.message}</p>}
            </div>

            <div className="form-group">
              <label htmlFor="description" className="form-label">
                Product Description *
              </label>
              <textarea
                id="description"
                rows={4}
                {...register('description')}
                className={`input-field ${errors.description ? 'border-danger-500' : ''}`}
                placeholder="Describe the product idea, its purpose, and key features."
              />
              {errors.description && <p className="form-error">{errors.description.message}</p>}
            </div>

            <div className="form-group">
              <label htmlFor="category" className="form-label">
                Product Category *
              </label>
              <select
                id="category"
                {...register('category')}
                className={`input-field ${errors.category ? 'border-danger-500' : ''}`}
              >
                <option value="">Select a category</option>
                {DEFAULT_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              {errors.category && <p className="form-error">{errors.category.message}</p>}
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="form-section">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Product Positioning</h3>

            <div className="form-group">
              <label htmlFor="positioning_statement" className="form-label">
                Positioning Statement *
              </label>
              <textarea
                id="positioning_statement"
                rows={4}
                {...register('positioning_statement')}
                className={`input-field ${errors.positioning_statement ? 'border-danger-500' : ''}`}
                placeholder="For [target market], who [need/problem], this product is a [category] that [key benefit]. Unlike [competitors], it [differentiator]."
              />
              {errors.positioning_statement && (
                <p className="form-error">{errors.positioning_statement.message}</p>
              )}
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="form-section">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Product Requirements & Competition</h3>

            <div className="form-group">
              <label htmlFor="required_attributes" className="form-label">
                Required Product Attributes *
              </label>
              <textarea
                id="required_attributes"
                rows={4}
                {...register('required_attributes')}
                className={`input-field ${errors.required_attributes ? 'border-danger-500' : ''}`}
                placeholder="List the key features, specs, and requirements the product must have."
              />
              {errors.required_attributes && (
                <p className="form-error">{errors.required_attributes.message}</p>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="competitor_overview" className="form-label">
                Competitor Overview *
              </label>
              <textarea
                id="competitor_overview"
                rows={4}
                {...register('competitor_overview')}
                className={`input-field ${errors.competitor_overview ? 'border-danger-500' : ''}`}
                placeholder="Summarize the competitive landscape, alternatives, and gaps this product can exploit."
              />
              {errors.competitor_overview && (
                <p className="form-error">{errors.competitor_overview.message}</p>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <button
            type="button"
            onClick={() => setCurrentStep((value) => Math.max(1, value - 1))}
            disabled={currentStep === 1 || isLoading}
            className="btn-secondary disabled:opacity-50"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={!isStepValid(currentStep) || isLoading}
            className="btn-primary w-full sm:w-auto disabled:opacity-50"
          >
            {currentStep === totalSteps ? (isLoading ? 'Saving...' : 'Save Idea') : 'Continue'}
          </button>
        </div>
      </form>
    </div>
  )
}
