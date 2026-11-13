'use client'

// The Runs panel (run health, AI cost, tokens, searches, the latest runs) moved to components/domain/signals/signal-runs-panel.tsx when Company
// Opportunities took over the Signal Review abilities (docs/agentic-crm/slices/S15-product-portfolio-merge.md, P1-A2): it opens from "Run health & cost" there.
// This file stays only so the Signal Review screen keeps compiling until step 1.7 removes that screen; delete it with the rest of the Review screen.
export * from '@/components/domain/signals/signal-runs-panel'
