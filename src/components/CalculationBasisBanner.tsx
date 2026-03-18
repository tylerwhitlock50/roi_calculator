'use client'

import React from 'react'

export default function CalculationBasisBanner({
  title = 'Calculation basis',
  body,
}: {
  title?: string
  body: string
}) {
  return (
    <div className="rounded-[24px] border border-cyan-200 bg-cyan-50 px-5 py-4 text-sm text-cyan-950">
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-700">{title}</div>
      <p className="mt-2 leading-6">{body}</p>
    </div>
  )
}
