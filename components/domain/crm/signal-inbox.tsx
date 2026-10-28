'use client'

/**
 * Phase 2 — Social Listening: Signal Inbox.
 *
 * Displays ingested signals with classification badges, linked account info,
 * relevance scores, and review actions (accept/reject/dismiss/promote).
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle, Building2, CheckCircle2, ChevronDown, ChevronUp,
  ExternalLink, Loader2, Radio, Sparkles, TrendingUp, User, XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { getLaravelContext } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'
import type { SignalClassification, SignalInboxItem, SignalStatus } from '@/types/crm'

// ── Constants ──────────────────────────────────────────────────────────────

type FilterTab = SignalClassification | SignalStatus | 'all'

const TABS: Array<{ id: FilterTab; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'buying_signal', label: 'Buying Signals' },
  { id: 'brand_mention', label: 'Brand Mentions' },
  { id: 'competitor_move', label: 'Competitor Moves' },
]

const STATUS_TABS: Set<FilterTab> = new Set(['pending', 'accepted'])

// ── Helpers ────────────────────────────────────────────────────────────────

function classificationStyle(c: SignalClassification): { label: string; cls: string } {
  switch (c) {
    case 'buying_signal':   return { label: 'Buying Signal', cls: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' }
    case 'brand_mention':   return { label: 'Brand Mention', cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' }
    case 'competitor_move': return { label: 'Competitor Move', cls: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' }
    case 'industry_trend':  return { label: 'Industry Trend', cls: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' }
    case 'irrelevant':      return { label: 'Irrelevant', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' }
    default:                return { label: 'Unclassified', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' }
  }
}

function statusStyle(s: SignalStatus): { label: string; cls: string } {
  switch (s) {
    case 'accepted':  return { label: 'Accepted', cls: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' }
    case 'rejected':  return { label: 'Rejected', cls: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' }
    case 'dismissed': return { label: 'Dismissed', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' }
    case 'promoted':  return { label: 'Promoted', cls: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300' }
    default:          return { label: 'Pending', cls: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' }
  }
}

function formatDate(raw: string | null): string {
  if (!raw) return '—'
  return new Date(raw.replace(' ', 'T')).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

function RelevanceBar({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-muted-foreground">—</span>
  const pct = Math.round(score * 100)
  const color = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-400'
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground" title={`Relevance: ${pct}%`}>
      <span className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
        <span className={cn('block h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </span>
      {pct}%
    </span>
  )
}

// ── Row ────────────────────────────────────────────────────────────────────

interface RowProps {
  item: SignalInboxItem
  onReview: (id: string, status: 'accepted' | 'rejected' | 'dismissed') => void
  onPromote: (id: string, to: 'lead' | 'opportunity') => void
  busy: boolean
}

function SignalRow({ item, onReview, onPromote, busy }: RowProps) {
  const [expanded, setExpanded] = useState(false)
  const cls = classificationStyle(item.classification)
  const st = statusStyle(item.status)
  const isPending = item.status === 'pending'

  return (
    <div className="border-b last:border-0">
      <button
        className="w-full text-left px-4 py-3 hover:bg-muted/40 transition-colors"
        onClick={() => setExpanded(e => !e)}
        type="button"
      >
        <div className="flex items-start gap-3">
          <Radio className="size-4 mt-0.5 text-muted-foreground shrink-0" aria-hidden />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span className={cn('inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium', cls.cls)}>
                {cls.label}
              </span>
              <span className={cn('inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium', st.cls)}>
                {st.label}
              </span>
              {item.classificationReason && (
                <span
                  className="inline-flex items-center gap-0.5 text-purple-500"
                  title={`AI classified: ${item.classificationReason}`}
                >
                  <Sparkles className="size-3" aria-hidden />
                  <span className="sr-only">AI classified</span>
                </span>
              )}
              {item.sourceName && (
                <span className="text-xs text-muted-foreground">{item.sourceName}</span>
              )}
            </div>
            <p className="text-sm font-medium leading-snug line-clamp-1">
              {item.title}
            </p>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {item.linkedAccountName && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Building2 className="size-3" aria-hidden />
                  {item.linkedAccountName}
                </span>
              )}
              <RelevanceBar score={item.relevanceScore} />
              <span className="text-xs text-muted-foreground">{formatDate(item.publishedAt)}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isPending && !busy && (
              <>
                <button
                  className="p-1 rounded text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                  title="Accept"
                  onClick={e => { e.stopPropagation(); onReview(item.id, 'accepted') }}
                  type="button"
                >
                  <CheckCircle2 className="size-4" />
                </button>
                <button
                  className="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                  title="Reject"
                  onClick={e => { e.stopPropagation(); onReview(item.id, 'rejected') }}
                  type="button"
                >
                  <XCircle className="size-4" />
                </button>
              </>
            )}
            {busy && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
            {expanded ? <ChevronUp className="size-4 text-muted-foreground ml-1" /> : <ChevronDown className="size-4 text-muted-foreground ml-1" />}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 bg-muted/20 border-t space-y-3">
          {item.body && (
            <p className="text-sm text-muted-foreground whitespace-pre-line">{item.body}</p>
          )}
          {item.classificationReason && (
            <p className="text-xs text-muted-foreground italic">
              <span className="font-medium not-italic text-foreground">Why: </span>
              {item.classificationReason}
            </p>
          )}
          {item.linkedAccountName && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Linked account: </span>
              {item.linkedAccountName}
              {item.linkedAccountConfidence !== null && (
                <> ({Math.round((item.linkedAccountConfidence ?? 0) * 100)}% confidence)</>
              )}
            </p>
          )}
          {item.sourceUrl && (
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink className="size-3" />
              View source
            </a>
          )}
          {isPending && (
            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => onReview(item.id, 'dismissed')}
              >
                Dismiss
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => onPromote(item.id, 'lead')}
              >
                <User className="size-3 mr-1" />
                Promote to Lead
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => onPromote(item.id, 'opportunity')}
              >
                <TrendingUp className="size-3 mr-1" />
                Promote to Opportunity
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export function SignalInbox() {
  const context = useMemo(() => getLaravelContext(), [])

  const [tab, setTab] = useState<FilterTab>('all')
  const [items, setItems] = useState<SignalInboxItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async (tab: FilterTab, page: number) => {
    setLoading(true)
    setError('')
    try {
      const isStatus = STATUS_TABS.has(tab)
      const res = await crmService.getSignalInbox(context, {
        ...(tab !== 'all' && isStatus ? { status: tab as string } : {}),
        ...(tab !== 'all' && !isStatus ? { classification: tab as string } : {}),
        page,
      })
      setItems(res.data.items)
      setTotalPages(res.data.pagination.last_page)
    } catch {
      setError('Failed to load signals.')
    } finally {
      setLoading(false)
    }
  }, [context])

  useEffect(() => {
    load(tab, page)
  }, [load, tab, page])

  function switchTab(t: FilterTab) {
    setTab(t)
    setPage(1)
  }

  async function handleReview(id: string, status: 'accepted' | 'rejected' | 'dismissed') {
    setBusyId(id)
    try {
      await crmService.reviewSignal(context, id, status)
      await load(tab, page)
    } catch {
      // silently reload; item will stay pending if server rejected
    } finally {
      setBusyId(null)
    }
  }

  async function handlePromote(id: string, to: 'lead' | 'opportunity') {
    setBusyId(id)
    try {
      await crmService.promoteSignal(context, id, to)
      await load(tab, page)
    } catch {
      // noop
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Signal Inbox</h2>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => switchTab(t.id)}
            className={cn(
              'px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors',
              tab === t.id
                ? 'border-primary text-primary font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 rounded-md bg-muted animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 text-destructive text-sm p-3">
          <AlertCircle className="size-4" />
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <Radio className="size-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No signals found for this filter.</p>
        </div>
      ) : (
        <div className="border rounded-md overflow-hidden bg-card">
          {items.map(item => (
            <SignalRow
              key={item.id}
              item={item}
              onReview={handleReview}
              onPromote={handlePromote}
              busy={busyId === item.id}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
