import React from 'react'

export type BlankableNumber = number | ''

export function parseBlankableNumber(value: string): BlankableNumber {
  if (value === '') {
    return ''
  }

  const parsed = Number(value)

  return Number.isNaN(parsed) ? '' : parsed
}

export function blankableNumberToNumber(value: BlankableNumber): number {
  return value === '' ? 0 : value
}

export function blankableNumberToNullableNumber(value: BlankableNumber): number | null {
  return value === '' ? null : value
}

type BlankNumberInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> & {
  value: BlankableNumber
  onChange: (value: BlankableNumber) => void
}

export default function BlankNumberInput({ value, onChange, ...props }: BlankNumberInputProps) {
  return (
    <input
      {...props}
      type="number"
      value={value}
      onChange={(event) => onChange(parseBlankableNumber(event.target.value))}
    />
  )
}
