'use client'

import type { LucideIcon } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'

/**
 * A temporary placeholder for a Sales menu leaf whose real list view hasn't
 * shipped yet (Phase 0 wires up the whole Sales menu/routing tree before
 * Phases 1-4 build each entity) - an honest "not built yet" screen, not a
 * broken route or fake data. Each call site is deleted once that phase's
 * real list view replaces it.
 */
export function ComingSoonView({ title, description, icon: Icon }: { title: string; description: string; icon: LucideIcon }) {
  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
      </div>
      <EmptyState icon={<Icon className="size-10" aria-hidden="true" />} title="Coming soon" description={description} />
    </div>
  )
}
