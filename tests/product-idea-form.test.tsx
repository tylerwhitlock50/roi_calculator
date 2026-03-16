// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import ProductIdeaForm from '@/components/ProductIdeaForm'

describe('ProductIdeaForm', () => {
  it('advances to the next step without requiring future-step fields', async () => {
    const onComplete = vi.fn()

    render(<ProductIdeaForm onComplete={onComplete} />)

    fireEvent.change(screen.getByLabelText('Product Title *'), {
      target: { value: 'Portable Press' },
    })
    fireEvent.change(screen.getByLabelText('Product Description *'), {
      target: { value: 'Compact benchtop press for short-run assembly work.' },
    })
    fireEvent.change(screen.getByLabelText('Product Category *'), {
      target: { value: 'Industrial Equipment' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => {
      expect(screen.getByText('Product Positioning')).toBeInTheDocument()
    })
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('keeps the positioning format visible while editing an existing statement', async () => {
    render(
      <ProductIdeaForm
        onComplete={vi.fn()}
        initialStep={2}
        initialData={{
          title: 'Portable Press',
          description: 'Compact benchtop press for short-run assembly work.',
          category: 'Industrial Equipment',
          positioning_statement: 'For factory teams who need quick fixture setup, this product is a portable press that shortens assembly changeovers.',
          required_attributes: 'Low footprint and stable force output.',
          competitor_overview: 'Competes with larger floor units.',
        }}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Use this positioning format')).toBeInTheDocument()
      expect(
        screen.getByText(/For \[target market\], who \[need\/problem\], this product is a \[category\]/)
      ).toBeInTheDocument()
      expect(screen.getByDisplayValue(/portable press that shortens assembly changeovers/i)).toBeInTheDocument()
    })
  })
})
