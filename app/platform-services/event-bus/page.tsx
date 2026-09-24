'use client'

/**
 * The Event Bus console.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THIS EXISTS TO ANSWER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `EventRecorder` has been writing `g2g_event` since M6 and ten consumers have been
 * draining it every five minutes. Nothing has ever read the ledger back, so when a
 * consumer stalls, every screen downstream of it goes quietly stale and the first
 * symptom is somebody asking why a number looks wrong. Four views, each answering a
 * question the others cannot:
 *
 *   Stream     what was recorded, and how far each event got
 *   Consumers  who is listening, and whether they are keeping up
 *   Failures   what broke, and the message the consumer reported
 *   Catalogue  which events exist at all — including the ones nobody consumes,
 *              which produce no ledger rows and are therefore invisible in the
 *              other three precisely when they are most wrong
 *
 * ── READ-ONLY, AND THAT IS DELIBERATE ───────────────────────────────────────
 *
 * No replay, no redrive. A projector is pure and re-running it is harmless; a reactor
 * enrols people on courses, issues certificates and sends notifications, so replaying
 * one does those things again. `events:project` and `events:react` are separate commands
 * for exactly that reason, and a button here would hand that distinction to whoever
 * clicks it.
 */

import { useCallback, useEffect, useState } from 'react'

import { Tabs } from '@/components/shared/business/shared'
import { describePlatformError } from '@/lib/platform/client'
import {
  fetchConsumers,
  fetchEventBusSummary,
  fetchEventCatalogue,
  fetchEventStream,
  fetchEventTypes,
  fetchFailures,
  type ConsumerRow,
  type EventBusSummary,
  type EventCatalogue,
  type EventRow,
  type FailureRow,
  type StreamFilters,
} from '@/lib/platform/event-bus'

import {
  KpiRow,
  Pager,
  PanelError,
  PanelLoading,
  RefreshButton,
  StaleNotice,
} from '../_components/console-parts'
import { ServiceShell } from '../_components/ServiceShell'
import {
  CatalogueView,
  ConsumerTable,
  EventStreamTable,
  FailureTable,
} from './_components/tables'

type TabId = 'stream' | 'consumers' | 'failures' | 'catalogue'

const TABS: { id: TabId; label: string }[] = [
  { id: 'stream', label: 'Stream' },
  { id: 'consumers', label: 'Consumers' },
  { id: 'failures', label: 'Failures' },
  { id: 'catalogue', label: 'Catalogue' },
]

const PER_PAGE = 25

export default function EventBusPage() {
  const [tab, setTab] = useState<TabId>('stream')

  return (
    <ServiceShell slug="event-bus">
      <div className="mt-6 space-y-4">
        <SummaryPanel />

        <Tabs tabs={TABS} active={tab} onChange={(id) => setTab(id as TabId)} />

        {/* Each panel loads its own data on mount and not before. Fetching all four up
            front would spend four requests to show one, and the catalogue in particular
            is a page most visits never open. */}
        {tab === 'stream' && <StreamPanel />}
        {tab === 'consumers' && <ConsumersPanel />}
        {tab === 'failures' && <FailuresPanel />}
        {tab === 'catalogue' && <CataloguePanel />}
      </div>
    </ServiceShell>
  )
}

/**
 * A small loader shared by the four panels.
 *
 * Keeps `data`, `error` and `loading` as three independent facts rather than a union,
 * because the combination that matters most is "we have data AND the last refresh
 * failed" — the case where the list must stay on screen with a note rather than be
 * replaced by an error.
 */
function usePanel<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [token, setToken] = useState(0)

  /*
   * State is set only from the promise callbacks. A synchronous `setLoading(true)` in
   * the effect body triggers a second render pass before the first has committed, which
   * is what `react-hooks/set-state-in-effect` is warning about — so the flag is raised
   * in `reload()` and in the handlers that change `deps` instead.
   */
  useEffect(() => {
    let cancelled = false

    load()
      .then((next) => {
        if (cancelled) return
        setData(next)
        setError(null)
        setLoading(false)
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        setError(describePlatformError(cause))
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, ...deps])

  const reload = useCallback(() => {
    setLoading(true)
    setToken((value) => value + 1)
  }, [])

  return { data, loading, error, reload, setLoading }
}

function SummaryPanel() {
  const { data, loading, error, reload } = usePanel<EventBusSummary>(fetchEventBusSummary, [])

  if (error && !data) return <PanelError message={error} onRetry={reload} />
  if (loading && !data) return <PanelLoading label="Reading the event store…" />
  if (!data) return null

  // The store's tables are absent on a database that has not run the M6 migration. That
  // is a deployment fact, not an error, and it reads as one.
  if (!data.installed) {
    return (
      <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm leading-6 text-muted-foreground">
        <span className="font-medium text-foreground">The event store is not installed here.</span>{' '}
        `g2g_event` does not exist on this database, so there is nothing to report.
      </div>
    )
  }

  return (
    <>
      {error && <StaleNotice message={error} onRetry={reload} />}
      <KpiRow tiles={data.tiles} />
    </>
  )
}

function StreamPanel() {
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<StreamFilters>({})
  const [types, setTypes] = useState<string[]>([])

  const { data, loading, error, reload } = usePanel(
    () => fetchEventStream(filters, page, PER_PAGE),
    [page, filters.event_type, filters.entity_type, filters.from, filters.to],
  )

  useEffect(() => {
    fetchEventTypes()
      .then((next) => setTypes(next.event_types))
      // Silent: the filter degrades to "All events", which is the default anyway. An
      // error banner over a working table would overstate what went wrong.
      .catch(() => {})
  }, [])

  const setFilter = (key: keyof StreamFilters, value: string) => {
    setPage(1)
    setFilters((current) => ({ ...current, [key]: value || undefined }))
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filters.event_type ?? ''}
          onChange={(event) => setFilter('event_type', event.target.value)}
          aria-label="Event type"
          className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
        >
          <option value="">All events</option>
          {types.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={filters.from ?? ''}
          onChange={(event) => setFilter('from', event.target.value)}
          aria-label="From date"
          className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
        />
        <input
          type="date"
          value={filters.to ?? ''}
          onChange={(event) => setFilter('to', event.target.value)}
          aria-label="To date"
          className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
        />

        <div className="ml-auto">
          <RefreshButton onClick={reload} busy={loading} />
        </div>
      </div>

      {error && !data && <PanelError message={error} onRetry={reload} />}
      {error && data && <StaleNotice message={error} onRetry={reload} />}
      {loading && !data && !error && <PanelLoading label="Loading events…" />}

      {data && (
        <div className="rounded-lg border border-border bg-card">
          <EventStreamTable rows={data.rows} />
          <Pager page={data.page} perPage={data.per_page} total={data.total} onPage={setPage} />
        </div>
      )}
    </div>
  )
}

function ConsumersPanel() {
  const { data, loading, error, reload } = usePanel<{ rows: ConsumerRow[] }>(fetchConsumers, [])

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <RefreshButton onClick={reload} busy={loading} />
      </div>

      {error && !data && <PanelError message={error} onRetry={reload} />}
      {error && data && <StaleNotice message={error} onRetry={reload} />}
      {loading && !data && !error && <PanelLoading label="Loading consumers…" />}

      {data && (
        <div className="rounded-lg border border-border bg-card">
          <ConsumerTable rows={data.rows} />
        </div>
      )}
    </div>
  )
}

function FailuresPanel() {
  const [page, setPage] = useState(1)
  const { data, loading, error, reload } = usePanel<
    { rows: FailureRow[]; total: number; page: number; per_page: number; has_more: boolean }
  >(() => fetchFailures(page, PER_PAGE), [page])

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <RefreshButton onClick={reload} busy={loading} />
      </div>

      {error && !data && <PanelError message={error} onRetry={reload} />}
      {error && data && <StaleNotice message={error} onRetry={reload} />}
      {loading && !data && !error && <PanelLoading label="Loading failures…" />}

      {data && (
        <div className="rounded-lg border border-border bg-card">
          <FailureTable rows={data.rows} />
          <Pager page={data.page} perPage={data.per_page} total={data.total} onPage={setPage} />
        </div>
      )}
    </div>
  )
}

function CataloguePanel() {
  const { data, loading, error, reload } = usePanel<EventCatalogue>(fetchEventCatalogue, [])

  return (
    <div className="space-y-3">
      {error && !data && <PanelError message={error} onRetry={reload} />}
      {error && data && <StaleNotice message={error} onRetry={reload} />}
      {loading && !data && !error && <PanelLoading label="Loading the catalogue…" />}

      {data && <CatalogueView catalogue={data} />}
    </div>
  )
}
