'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { ProtectedLayout } from '@/components/auth/protected-layout'
import { GtgAppShell } from '@/components/shell/gtg-app-shell'
import { SALES_PRODUCTS } from '@/lib/sales-training/deck'

/** Sales Training: pick a product, then play its branching scenario. */
export default function SalesTrainingIndexPage() {
  return (
    <ProtectedLayout>
      <GtgAppShell>
        <div className="mx-auto max-w-5xl space-y-6 p-6">
          <div>
            <h1 className="text-2xl font-bold">Sales Training</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Branching sales scenarios. Choose a product, read the verified product facts, then practise the sale with a fictional customer.
              Every decision has its own consequence.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {SALES_PRODUCTS.map((p) => (
              <Link key={p.key} href={`/module/lms/learning/sales-training/${p.key}`} className="group rounded-xl border border-border bg-card p-5 shadow-sm transition hover:shadow-md" style={{ borderTop: `5px solid ${p.accent}` }}>
                <h2 className="text-xl font-bold" style={{ color: p.accent }}>{p.name}</h2>
                <p className="mt-2 min-h-[3rem] text-sm text-muted-foreground">{p.tagline}</p>
                <span className="mt-4 inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white" style={{ background: p.accent }}>
                  Start training <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
                </span>
              </Link>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Customers and quotes are fictional training content. Product facts come from the G2G v1 documentation and the product portfolio; where those have no data (pricing, ROI, testimonials) the scenarios say so.</p>
        </div>
      </GtgAppShell>
    </ProtectedLayout>
  )
}
