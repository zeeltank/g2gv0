'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, Loader2, ScrollText } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { DataTable } from '@/components/ui/data-table'
import { useLaravelContext } from '@/hooks/use-agentic'
import { isLaravelContextReady } from '@/lib/laravel-context'
import { organizationSettingsService, type AuditEntry } from '@/services/organization/settings'
import { eventLabel, eventArea } from '@/lib/event-labels'
import { entityLabel } from '@/lib/format-labels'
import { SectionBlock, SectionEmpty, SectionSkeleton } from './section-primitives'

/**
 * AUDIT — read-only, and that is the entire point.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DATA WAS ALREADY BEING RECORDED
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `EventRecorder` writes the event stream and `AuditLogProjector` projects it
 * into `g2g_audit_log`, which holds real rows on both databases today. What has
 * never existed is anything that reads it back — so the product has been
 * keeping a record nobody could look at.
 *
 * ── THERE IS NO WRITE PATH, AND THERE MUST NOT BE ───────────────────────────
 *
 * No edit, no delete, no "hide this entry". An audit trail that can be changed
 * from the product it audits is not one. The endpoint behind this screen is a
 * single GET.
 *
 * ── AN AUDITOR SEES THIS AND NOTHING ELSE ───────────────────────────────────
 *
 * The `auditor` role reaches this section and no other organisation section.
 * That is enforced on the server by the endpoint's own role check rather than
 * by the route group, because "may read the trail" and "may change a setting"
 * are two different questions with two different answers.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * TWO CARDS AND A LIST BECAME ONE CARD AND A TABLE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A trail is five columns of the same five facts, over and over: when, who,
 * what, what it touched, and the detail. It was rendered as a stack of prose
 * blocks — the event name and timestamp on one line, the actor and entity joined
 * by middots on the next, the detail on a third. Three lines and ~90px per entry,
 * with the timestamps right-aligned against a ragged left edge, so following one
 * person's actions down the page meant reading every entry to find them.
 *
 * As columns the same rows are scannable and about a third of the height. This is
 * the one screen in Settings where the data genuinely is a table, and it was the
 * only one not rendered as one.
 *
 * ── THE FILTERS LOST THEIR CARD ─────────────────────────────────────────────
 *
 * They had a `SectionBlock` of their own, titled "Filter", described as "Narrow
 * the record down before reading it" — a heading and a sentence of chrome around
 * three controls whose labels already say what they do. They now sit in one row
 * directly above the table they filter.
 *
 * Not the house `FilterBar`, deliberately: it hardcodes its select to `w-40`,
 * and these option labels read "Tasks · Task approved" — 160px truncates them to
 * the point where two events look identical. A filter you cannot read is worse
 * than a filter that costs one extra row.
 *
 * ── AND THE PERMANENT BANNER ────────────────────────────────────────────────
 *
 * "This is a read-only record" was a full-width Alert that fired on every visit,
 * above everything, for a screen with no buttons that could change anything. It
 * is a steady-state fact, so it is a badge on the title.
 */

export function AuditSection() {
  const resolveContext = useLaravelContext()

  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [types, setTypes] = useState<string[]>([])
  const [total, setTotal] = useState(0)
  const [cursor, setCursor] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [filters, setFilters] = useState({ type: '', from: '', to: '' })

  const load = useCallback(
    async (append = false, from?: number) => {
      const context = resolveContext()

      if (!isLaravelContextReady(context)) {
        setLoading(false)
        return
      }

      if (append) setLoadingMore(true)
      else setLoading(true)

      setError(null)

      try {
        const response = await organizationSettingsService.audit(context, {
          ...(filters.type ? { type: filters.type } : {}),
          ...(filters.from ? { from: filters.from } : {}),
          ...(filters.to ? { to: filters.to } : {}),
          ...(from ? { cursor: from } : {}),
        })

        setEntries((current) =>
          append ? [...current, ...response.data.entries] : response.data.entries,
        )
        setTotal(response.data.total)
        setCursor(response.data.next_cursor)

        // The filter offers what this organisation has actually produced, so it
        // is only worth replacing on a full load.
        if (!append) setTypes(response.data.types)
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : 'The audit trail could not be loaded. It is available to administrators and auditors.',
        )
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [resolveContext, filters],
  )

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
  }, [load])

  /*
   * `Column.id` is typed `keyof T`, so each column borrows a real field name off
   * the entry. All five here are genuine fields; every one passes a `render`, so
   * the borrowed value is never printed raw.
   */
  const columns = useMemo(
    () => [
      {
        id: 'occurred_at' as const,
        header: 'When',
        render: (_value: unknown, entry: AuditEntry) => (
          // `tabular-nums` and `whitespace-nowrap`: a column of timestamps that
          // reflows or jitters is unreadable, and this is the column people scan.
          <span className="block whitespace-nowrap text-xs tabular-nums text-muted-foreground">
            {entry.occurred_at
              ? new Date(entry.occurred_at).toLocaleString()
              : 'Not recorded'}
          </span>
        ),
      },
      {
        id: 'actor_name' as const,
        header: 'Who',
        render: (_value: unknown, entry: AuditEntry) => (
          <span className="block max-w-[11rem] truncate text-sm text-foreground">
            {/*
              An actor whose account has since been removed reads as "a removed
              account" rather than as blank. The entry deliberately outlives the
              person — that is the point of a trail — so it must still say
              something true about them.
            */}
            {entry.actor_name
              ? entry.actor_name
              : entry.actor_id
                ? 'A removed account'
                : 'The system'}
          </span>
        ),
      },
      {
        id: 'type' as const,
        header: 'What happened',
        render: (_value: unknown, entry: AuditEntry) => (
          <div className="max-w-[14rem]">
            <p className="truncate text-sm font-medium text-foreground" title={entry.type}>
              {eventLabel(entry.type)}
            </p>
            {/*
              The area, small and muted under the event. It was part of the
              dropdown label but nowhere on the rows themselves, so a filtered
              view gave no reminder of what had been filtered to.
            */}
            <p className="truncate text-xs text-muted-foreground">{eventArea(entry.type)}</p>
          </div>
        ),
      },
      {
        id: 'entity_type' as const,
        header: 'What it touched',
        render: (_value: unknown, entry: AuditEntry) =>
          entry.entity_type ? (
            <span className="block max-w-[12rem] truncate text-sm text-foreground">
              {entityLabel(entry.entity_type)}
              {entry.entity_id ? (
                <span className="text-muted-foreground tabular-nums"> #{entry.entity_id}</span>
              ) : null}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        id: 'detail' as const,
        header: 'Detail',
        render: (_value: unknown, entry: AuditEntry) =>
          entry.detail ? (
            // Clamped rather than truncated: two lines of a detail is usually
            // the whole of it, and `title` carries the rest.
            <span
              className="line-clamp-2 max-w-[20rem] text-xs text-muted-foreground"
              title={entry.detail}
            >
              {entry.detail}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
    ],
    [],
  )

  const filtered = Boolean(filters.type || filters.from || filters.to)

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <SectionBlock
        title="What changed"
        description={
          loading
            ? 'Reading the record…'
            : `${total.toLocaleString()} ${total === 1 ? 'entry' : 'entries'}${
                entries.length < total ? `, showing the ${entries.length} most recent` : ''
              }.`
        }
        badge="Read only"
        badgeTitle="Nothing on this screen can change or remove an entry — that is what makes it worth having."
      >
        {/*
          THE FILTERS, IN A ROW, IN THE SAME CARD AS THE TABLE.

          They had a card of their own with a heading and a sentence of
          description. Labels are inline and small here: "From" above a date
          field needs no explanation, and the card title already says what is
          being filtered.
        */}
        <div className="mb-4 flex flex-wrap items-end gap-3 border-b border-border pb-4">
          <label className="flex min-w-[15rem] flex-1 flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">What happened</span>
            <Select
              value={filters.type}
              onChange={(value) => setFilters((f) => ({ ...f, type: String(value) }))}
              placeholder="Anything"
              /*
               * Grouped by area and sorted, because a flat list of every event an
               * organisation has ever recorded is not something anybody can
               * scan. The prefix is used as the group name - `task.*` under Tasks
               * - so a module's events stay together even when the label map has
               * never heard of them.
               */
              options={[
                { value: '', label: 'Anything' },
                ...[...types]
                  .sort((a, b) =>
                    eventArea(a) === eventArea(b)
                      ? eventLabel(a).localeCompare(eventLabel(b))
                      : eventArea(a).localeCompare(eventArea(b)),
                  )
                  .map((type) => ({
                    value: type,
                    label: `${eventArea(type)} · ${eventLabel(type)}`,
                  })),
              ]}
              aria-label="Filter by what happened"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">From</span>
            <Input
              type="date"
              value={filters.from}
              onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
              className="w-[10rem]"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">To</span>
            <Input
              type="date"
              value={filters.to}
              onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
              className="w-[10rem]"
            />
          </label>

          {/*
            Only once something is filtered. A permanently visible Clear button
            that does nothing most of the time is the kind of dead control that
            makes a screen feel broken.
          */}
          {filtered && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilters({ type: '', from: '', to: '' })}
            >
              Clear
            </Button>
          )}
        </div>

        {loading && <SectionSkeleton rows={5} />}

        {!loading && entries.length === 0 && !error && (
          <SectionEmpty
            icon={<ScrollText className="size-6" aria-hidden="true" />}
            title={filtered ? 'Nothing matches those filters' : 'Nothing recorded yet'}
            description={
              filtered
                ? 'Try widening the date range, or choose Anything.'
                : 'Changes appear here as people make them.'
            }
          />
        )}

        {!loading && entries.length > 0 && (
          <>
            {/*
              The overflow is here, not on the page: `DataTable` renders a bare
              table inside a bordered div with no overflow of its own.
            */}
            <div className="-mx-1 overflow-x-auto px-1 pb-1">
              <DataTable
                columns={columns}
                data={entries}
                getRowId={(entry: AuditEntry) => String(entry.id)}
                density="compact"
                className="min-w-[52rem]"
              />
            </div>

            {cursor !== null && (
              <div className="mt-4 flex justify-center">
                <Button
                  variant="outline"
                  onClick={() => load(true, cursor)}
                  disabled={loadingMore}
                >
                  {loadingMore && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                  {loadingMore ? 'Loading…' : 'Show more'}
                </Button>
              </div>
            )}
          </>
        )}
      </SectionBlock>
    </div>
  )
}
