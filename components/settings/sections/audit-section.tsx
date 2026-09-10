'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Loader2, ScrollText, ShieldCheck } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useLaravelContext } from '@/hooks/use-agentic'
import { isLaravelContextReady } from '@/lib/laravel-context'
import { organizationSettingsService, type AuditEntry } from '@/services/organization/settings'
import { eventLabel, eventArea } from '@/lib/event-labels'
import { Field, SectionBlock } from './section-primitives'

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

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Alert>
        <ShieldCheck className="size-4" aria-hidden="true" />
        <AlertDescription>
          This is a read-only record. Nothing on this screen can change or remove an entry — that
          is what makes it worth having.
        </AlertDescription>
      </Alert>

      <SectionBlock title="Filter" description="Narrow the record down before reading it.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="What happened">
            <Select
              value={filters.type}
              onChange={(value) => setFilters((f) => ({ ...f, type: String(value) }))}
              placeholder="Anything"
              /*
               * Grouped by area and sorted, because a flat list of every event
               * an organisation has ever recorded is not something anybody can
               * scan. The prefix is used as the group name — `task.*` under
               * Tasks — so a module's events stay together even when the label
               * map has never heard of them.
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
            />
          </Field>

          <Field label="From">
            <Input
              type="date"
              value={filters.from}
              onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
            />
          </Field>

          <Field label="To">
            <Input
              type="date"
              value={filters.to}
              onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
            />
          </Field>
        </div>
      </SectionBlock>

      <SectionBlock
        title="What changed"
        description={
          loading
            ? 'Reading the record…'
            : `${total.toLocaleString()} ${total === 1 ? 'entry' : 'entries'}${
                entries.length < total ? `, showing the ${entries.length} most recent` : ''
              }.`
        }
      >
        {loading && (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-14 animate-pulse rounded-lg bg-muted/40" />
            ))}
          </div>
        )}

        {!loading && entries.length === 0 && !error && (
          <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center">
            <ScrollText className="mx-auto size-5 text-muted-foreground" aria-hidden="true" />
            <p className="mt-2 text-sm font-medium text-foreground">Nothing recorded yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {filters.type || filters.from || filters.to
                ? 'Nothing matches those filters. Try widening them.'
                : 'Changes appear here as people make them.'}
            </p>
          </div>
        )}

        {!loading && entries.length > 0 && (
          <>
            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
              {entries.map((entry) => (
                <li key={entry.id} className="bg-background px-4 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">
                      {eventLabel(entry.type)}
                    </p>
                    <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {entry.occurred_at
                        ? new Date(entry.occurred_at).toLocaleString()
                        : 'Time not recorded'}
                    </p>
                  </div>

                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {/*
                      An actor whose account has since been removed reads as
                      "a removed account" rather than as blank. The entry
                      deliberately outlives the person — that is the point of a
                      trail — so it must still say something true about them.
                    */}
                    {entry.actor_name
                      ? entry.actor_name
                      : entry.actor_id
                        ? 'A removed account'
                        : 'The system'}
                    {entry.entity_type && (
                      <>
                        {' · '}
                        {entry.entity_type}
                        {entry.entity_id ? ` #${entry.entity_id}` : ''}
                      </>
                    )}
                  </p>

                  {entry.detail && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{entry.detail}</p>
                  )}
                </li>
              ))}
            </ul>

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
