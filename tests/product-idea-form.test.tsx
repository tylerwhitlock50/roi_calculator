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
})
