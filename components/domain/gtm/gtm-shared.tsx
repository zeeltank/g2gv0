'use client'

import type { ReactNode } from 'react'
import { useAuth } from '@/components/auth/gtg-auth'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { ApiError } from '@/services/core'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

/** True once the session carries a token and tenant - never fire a GTM request before that. */
export function useGtmReady(): boolean {
  const { user } = useAuth()
  return isLaravelContextReady(getLaravelContext(user))
}

/** The server's own words where it gave them; a 403 gets an explanation of what it means. */
export function errMsg(e: unknown, fallback = 'Something went wrong'): string {
  if (e instanceof ApiError) {
    // A 403 the server explained (e.g. a second approver is required) keeps its own words.
    if (e.status === 403 && e.message && !/unauthori[sz]ed|forbidden|permission|access denied|profile/i.test(e.message)) return e.detail ? `${e.message} — ${e.detail}` : e.message
    if (e.status === 403) return 'You do not have permission for this. GTM is limited to Administrators (edit) and Executives (view).'
    return e.detail ? `${e.message} — ${e.detail}` : e.message
  }
  return e instanceof Error ? e.message : fallback
}

export function fmtDate(value?: string | null, withTime = false): string {
  if (!value) return '—'
  const d = new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z')
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}

/** Only Administrators can change GTM data (Executives read). The server enforces it; this just hides controls that would be refused. */
export function useGtmCanWrite(): boolean {
  const { user } = useAuth()
  return user?.role === 'administrator'
}

export function GtmPageHeader({ title, description, actions, readOnlyActions }: { title: string; description: string; actions?: ReactNode; readOnlyActions?: boolean }) {
  const canWrite = useGtmCanWrite()
  const shown = readOnlyActions || canWrite ? actions : undefined
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
      </div>
      {shown && <div className="flex items-center gap-2">{shown}</div>}
    </div>
  )
}

/** Counted from database rows. */
export function MeasuredTag() {
  return <Badge variant="outline" className="text-[10px] uppercase tracking-wide">Measured</Badge>
}

/** Produced by a model - an opinion, not a count. */
export function EstimateTag() {
  return <Badge variant="outline" className="border-amber-400 text-[10px] uppercase tracking-wide text-amber-600">AI estimate</Badge>
}

export function StatTile({
  label, value, hint, tag, tone,
}: { label: string; value: ReactNode; hint?: string; tag?: ReactNode; tone?: 'warn' }) {
  return (
    <div className={cn('rounded-lg border border-border bg-card p-4', tone === 'warn' && 'border-amber-300')}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {tag}
      </div>
      <div className="mt-2 text-2xl font-semibold text-foreground">{value}</div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
