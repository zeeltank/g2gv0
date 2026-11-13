'use client'

// The parts of a signal row (status chip, date badge, product chip, evidence) moved to components/domain/signals/signal-parts.tsx when Company
// Opportunities took over the Signal Review abilities (docs/agentic-crm/slices/S15-product-portfolio-merge.md, P1-A). This file stays only so the Signal
// Review screen keeps compiling until step 1.7 removes that screen; delete it with the rest of the Review screen.
export * from '@/components/domain/signals/signal-parts'
