'use client'

import type { ReactNode } from 'react'
import { Loader2, Sparkles } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Chrome of the assistant's workspace: the "Working with ..." line and the Ask / Create / Analyse /
 * Actions tabs. Same markup, spacing and accent as the LMS K12 assistant
 * (`app/components/ai-workspace/WorkspaceChrome.tsx`); only the data behind them is G2G's.
 */

export type WorkspaceTab = 'ask' | 'create' | 'analyse' | 'actions'

const TAB_LABELS: Record<WorkspaceTab, string> = {
  ask: 'Ask',
  create: 'Create',
  analyse: 'Analyse',
  actions: 'Actions',
}

export const WORKSPACE_TABS: WorkspaceTab[] = ['ask', 'create', 'analyse', 'actions']

export interface WorkspaceContextInfo {
  /** What the assistant is looking at: the page title, or the module when the page has none. */
  subject: string
  moduleLabel: string | null
  /** Search, filters and row counts read off the page. */
  details: string[]
}

export function WorkspaceTabs({
  tabs = WORKSPACE_TABS,
  active,
  onChange,
}: {
  tabs?: WorkspaceTab[]
  active: WorkspaceTab
  onChange: (tab: WorkspaceTab) => void
}) {
  if (tabs.length <= 1) return null

  return (
    <div
      role="tablist"
      aria-label="AI workspace"
      className="flex items-center gap-1 overflow-x-auto border-b border-border/70 bg-background/60 px-3 py-2"
    >
      {tabs.map((tab) => {
        const isActive = tab === active
        return (
          <button
            key={tab}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onChange(tab)}
            className={cn(
              'shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all',
              isActive
                ? 'bg-[#0D6EFD] text-white shadow-[0_8px_18px_rgba(13,110,253,0.18)]'
                : 'text-muted-foreground hover:bg-blue-50/70 hover:text-[#0D6EFD] dark:hover:bg-blue-500/10'
            )}
          >
            {TAB_LABELS[tab]}
          </button>
        )
      })}
    </div>
  )
}

export function ContextBanner({
  context,
  loading,
}: {
  context: WorkspaceContextInfo | null
  loading?: boolean
}) {
  if (!context) {
    return loading ? (
      <div className="flex items-center gap-2 border-b border-border/60 bg-blue-50/40 px-5 py-2 dark:bg-blue-500/5">
        <Loader2 className="size-3.5 shrink-0 animate-spin text-[#0D6EFD]" aria-hidden />
        <p className="text-[11px] font-medium text-muted-foreground">Reading this page…</p>
      </div>
    ) : null
  }

  return (
    <div className="border-b border-border/60 bg-blue-50/40 px-5 py-2 dark:bg-blue-500/5">
      <p className="flex items-center gap-2 truncate text-[11px] font-medium text-muted-foreground">
        <Sparkles className="size-3.5 shrink-0 text-[#0D6EFD]" aria-hidden />
        <span className="truncate">
          Working with <span className="font-semibold text-foreground">{context.subject}</span>
          {context.moduleLabel && context.moduleLabel !== context.subject ? (
            <span className="text-muted-foreground"> · {context.moduleLabel}</span>
          ) : null}
        </span>
      </p>
      {context.details.length ? (
        <p className="mt-0.5 truncate pl-[22px] text-[11px] text-muted-foreground">{context.details.join(' · ')}</p>
      ) : null}
    </div>
  )
}

/** A suggestion button, the same shape as the suggested-prompt rows in the Ask tab. */
export function SuggestionButton({
  label,
  description,
  disabled,
  onClick,
  title,
}: {
  label: string
  description?: string | null
  disabled?: boolean
  onClick: () => void
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="group w-full rounded-2xl border border-border/80 bg-background px-3.5 py-2.5 text-left shadow-[0_1px_0_rgba(15,23,42,0.03)] transition-all hover:-translate-y-0.5 hover:border-[#0D6EFD]/20 hover:bg-blue-50/70 hover:shadow-[0_10px_24px_rgba(13,110,253,0.08)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 dark:hover:bg-blue-500/10"
    >
      <span className="text-sm font-medium text-foreground/80 group-hover:text-[#0D6EFD]">{label}</span>
      {description ? (
        <span className="mt-0.5 block text-[11px] leading-5 text-muted-foreground">{description}</span>
      ) : null}
    </button>
  )
}

export function TabEmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border px-4 py-6 text-center">
      <p className="text-xs leading-5 text-muted-foreground">{message}</p>
    </div>
  )
}

export function TabSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </section>
  )
}
