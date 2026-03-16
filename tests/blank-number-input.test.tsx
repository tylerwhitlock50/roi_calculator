// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import React, { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import BlankNumberInput, { blankableNumberToNumber, parseBlankableNumber } from '@/components/BlankNumberInput'

describe('BlankNumberInput', () => {
  it('keeps the field blank when the value is empty', () => {
    render(
      <BlankNumberInput
        aria-label="Test number"
        className="input-field"
        value=""
        onChange={() => undefined}
      />
    )

    expect(screen.getByLabelText('Test number')).toHaveValue(null)
  })

  it('parses typed numbers without forcing a leading zero', () => {
    function Harness() {
      const [value, setValue] = useState<number | ''>('')

      return (
        <BlankNumberInput
          aria-label="Test number"
          className="input-field"
          value={value}
          onChange={setValue}
        />
      )
    }

    render(<Harness />)

    const input = screen.getByLabelText('Test number')
    fireEvent.change(input, { target: { value: '1' } })

    expect(input).toHaveValue(1)
  })

  it('normalizes empty values to zero for saves', () => {
    expect(parseBlankableNumber('')).toBe('')
    expect(parseBlankableNumber('12.5')).toBe(12.5)
    expect(blankableNumberToNumber('')).toBe(0)
    expect(blankableNumberToNumber(12.5)).toBe(12.5)
  })
})
