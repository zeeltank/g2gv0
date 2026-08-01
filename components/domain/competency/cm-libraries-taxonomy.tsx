'use client'

import { useState } from 'react'

import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useLibraryMeta } from '@/hooks/use-competency-libraries'
import type { LibraryTabId } from '@/services/competency'

import { LIBRARY_TABS, tabConfig } from './libraries/library-config'
import { LibraryTab } from './libraries/library-tab'

/**
 * Libraries & Taxonomy.
 *
 * The source libraries the competency model is built from - Job Role, Job Role
 * Task, Knowledge, Ability, Attitude, Behaviour and Invisible - behind one tab
 * strip, each with its own taxonomy editor.
 *
 * Skills/competencies are deliberately NOT a tab here. They live on
 * s_users_skills, which the Competency Library owns end to end: its form now
 * carries the full column set and its toolbar hosts the skill taxonomy editor.
 * Two screens writing one table is how a partial edit blanks a column the other
 * form never showed.
 */
export function CmLibrariesTaxonomy() {
  const [activeTab, setActiveTab] = useState<LibraryTabId>('jobrole')
  const { meta, loading: metaLoading } = useLibraryMeta()

  const config = tabConfig(activeTab)

  return (
    <div className="g2g-scrollbar flex h-full flex-col gap-6 overflow-y-auto p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Libraries &amp; Taxonomy</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Curate the skill, role and behavioural libraries the whole competency model draws on.
        </p>
      </div>

      {/* Tab strip */}
      <div
        className="g2g-scrollbar -mx-1 flex gap-1 overflow-x-auto border-b border-border px-1"
        role="tablist"
        aria-label="Library"
      >
        {LIBRARY_TABS.map((tab) => {
          const isActive = tab.id === activeTab
          const count = meta.counts?.[tab.id]

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                '-mb-px flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition-colors',
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              {metaLoading ? (
                <Skeleton className="h-4 w-8 rounded-full" />
              ) : count !== undefined ? (
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums',
                    isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                  )}
                >
                  {count.toLocaleString()}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      <p className="-mt-3 text-sm text-muted-foreground">{config.description}</p>

      {/* Only the active tab is mounted, so switching tabs never leaves eight
          list requests in flight. */}
      <LibraryTab key={activeTab} config={config} meta={meta} active />
    </div>
  )
}
