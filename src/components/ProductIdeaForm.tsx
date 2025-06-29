'use client'

import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const productIdeaSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title must be less than 100 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters').max(1000, 'Description must be less than 1000 characters'),
  category: z.string().min(1, 'Category is required'),
  positioning_statement: z.string().min(10, 'Positioning statement must be at least 10 characters').max(500, 'Positioning statement must be less than 500 characters'),
  required_attributes: z.string().min(10, 'Required attributes must be at least 10 characters').max(1000, 'Required attributes must be less than 1000 characters'),
  competitor_overview: z.string().min(10, 'Competitor overview must be at least 10 characters').max(1000, 'Competitor overview must be less than 1000 characters'),
})

type ProductIdeaFormData = z.infer<typeof productIdeaSchema>

interface ProductIdeaFormProps {
  onComplete: (data: ProductIdeaFormData) => void
  initialData?: Partial<ProductIdeaFormData>
  isLoading?: boolean
}

const PRODUCT_CATEGORIES = [
  'Electronics',
  'Software',
  'Hardware',
  'Consumer Goods',
  'Industrial',
  'Healthcare',
  'Automotive',
  'Aerospace',
  'Food & Beverage',
  'Fashion',
  'Home & Garden',
  'Sports & Recreation',
  'Education',
  'Finance',
  'Other'
]

export default function ProductIdeaForm({ onComplete, initialData, isLoading = false }: ProductIdeaFormProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const totalSteps = 3

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    watch
  } = useForm<ProductIdeaFormData>({
    resolver: zodResolver(productIdeaSchema),
    defaultValues: initialData,
    mode: 'onChange'
  })

  const watchedValues = watch()

  const handleFormSubmit = (data: ProductIdeaFormData) => {
    if (currentStep === totalSteps) {
      onComplete(data)
    } else {
      nextStep()
    }
  }

  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const isStepValid = (step: number) => {
    switch (step) {
      case 1:
        return watchedValues.title && watchedValues.description && !errors.title && !errors.description
      case 2:
        return watchedValues.category && watchedValues.positioning_statement && !errors.category && !errors.positioning_statement
      case 3:
        return watchedValues.required_attributes && watchedValues.competitor_overview && !errors.required_attributes && !errors.competitor_overview
      default:
        return false
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
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
                <div className={`w-16 h-1 mx-2 ${
                  step < currentStep ? 'bg-primary-600' : 'bg-gray-300'
                }`} />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2 text-sm text-gray-600">
          <span>Basic Info</span>
          <span>Positioning</span>
          <span>Requirements</span>
        </div>
      </div>

      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-8">
        {/* Step 1: Basic Information */}
        {currentStep === 1 && (
          <div className="form-section">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Basic Product Information</h3>
            
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
              {errors.title && (
                <p className="form-error">{errors.title.message}</p>
              )}
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
                placeholder="Describe your product idea, its purpose, and key features"
              />
              {errors.description && (
                <p className="form-error">{errors.description.message}</p>
              )}
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
                {PRODUCT_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              {errors.category && (
                <p className="form-error">{errors.category.message}</p>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Positioning */}
        {currentStep === 2 && (
          <div className="form-section">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Product Positioning</h3>
            
            <div className="form-group">
              <label htmlFor="positioning_statement" className="form-label">
                Positioning Statement *
              </label>
              <textarea
                id="positioning_statement"
                rows={3}
                {...register('positioning_statement')}
                className={`input-field ${errors.positioning_statement ? 'border-danger-500' : ''}`}
                placeholder="For [target market], who [need/problem], our product is a [product category] that [key benefit]. Unlike [competitors], our product [key differentiator]."
              />
              {errors.positioning_statement && (
                <p className="form-error">{errors.positioning_statement.message}</p>
              )}
              <p className="text-sm text-gray-500 mt-1">
                Define how your product will be positioned in the market relative to competitors.
              </p>
            </div>
          </div>
        )}

        {/* Step 3: Requirements */}
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
                placeholder="List the key features, specifications, and requirements your product must have to succeed in the market"
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
                placeholder="Describe the competitive landscape, key competitors, their strengths and weaknesses, and your competitive advantages"
              />
              {errors.competitor_overview && (
                <p className="form-error">{errors.competitor_overview.message}</p>
              )}
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={prevStep}
            disabled={currentStep === 1}
            className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>

          <div className="flex space-x-4">
            {currentStep < totalSteps ? (
              <button
                type="button"
                onClick={nextStep}
                disabled={!isStepValid(currentStep)}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            ) : (
              <button
                type="submit"
                disabled={!isValid || isLoading}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Creating...' : 'Create Product Idea'}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  )
} 