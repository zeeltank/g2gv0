'use client'

/**
 * The Event Bus console's four tables.
 *
 * Kept out of the page so the page is the data-loading and the tab switching, and these
 * are the rendering. Each one is dumb: it receives rows and draws them, and every
 * "unknown versus zero" decision has already been made by the server.
 */

import { eventLabel } from '@/lib/event-labels'
import type {
  CatalogueConsumer,
  ConsumerRow,
  EventCatalogue,
  EventRow,
  FailureRow,
} from '@/lib/platform/event-bus'

import { EmptyRow } from '../../_components/console-parts'

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-[11px] font-semibold tracking-wide whitespace-nowrap text-muted-foreground uppercase">
      {children}
    </th>
  )
}

function Shell({ children, minWidth }: { children: React.ReactNode; minWidth: string }) {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full ${minWidth} border-collapse text-left text-sm`}>{children}</table>
    </div>
  )
}

/**
 * The event stream.
 *
 * `eventLabel` turns `employee.role_assigned` into a sentence. It already exists for the
 * audit filter and already handles types absent from the catalogue — which matters here,
 * because this table shows what the tenant actually recorded, and several live types
 * predate the catalogue or were added after it.
 */
export function EventStreamTable({ rows }: { rows: EventRow[] }) {
  return (
    <Shell minWidth="min-w-[52rem]">
      <thead>
        <tr className="bg-muted/50">
          <Th>Event</Th>
          <Th>Entity</Th>
          <Th>Actor</Th>
          <Th>Delivery</Th>
          <Th>Occurred</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {rows.length === 0 && <EmptyRow colSpan={5}>No events match these filters.</EmptyRow>}

        {rows.map((row) => (
          <tr key={row.id} className="transition-colors hover:bg-muted/40">
            <td className="px-3 py-2.5 align-top">
              <p className="font-medium text-card-foreground">{eventLabel(row.type)}</p>
              <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{row.type}</p>
            </td>
            <td className="px-3 py-2.5 align-top text-xs whitespace-nowrap text-muted-foreground">
              {row.entity_type}
              {row.entity_id !== null && <span className="tabular-nums"> #{row.entity_id}</span>}
            </td>
            <td className="px-3 py-2.5 align-top text-xs whitespace-nowrap">
              {/* NULL actor means SYSTEM. That is a designed value, not a gap, so it
                  reads as "System" rather than "Unknown". */}
              {row.actor_id === null ? (
                <span className="text-muted-foreground">System</span>
              ) : (
                <span>{row.actor_name ?? `User #${row.actor_id}`}</span>
              )}
            </td>
            <td className="px-3 py-2.5 align-top text-xs whitespace-nowrap">
              <DeliveryPills delivery={row.delivery} />
            </td>
            <td className="px-3 py-2.5 align-top text-xs whitespace-nowrap tabular-nums text-muted-foreground">
              {new Date(row.occurred_at).toLocaleString()}
            </td>
          </tr>
        ))}
      </tbody>
    </Shell>
  )
}

/**
 * How far one event got.
 *
 * An event with no delivery rows at all is the interesting case: it means no consumer
 * handles that type, so it was recorded and nothing acted on it. That reads as "no
 * consumer" rather than as four zeroes, because four zeroes look like a pending state.
 */
function DeliveryPills({ delivery }: { delivery: EventRow['delivery'] }) {
  const total = delivery.done + delivery.pending + delivery.failed + delivery.skipped

  if (total === 0) {
    return (
      <span className="text-muted-foreground/60" title="No consumer handles this event type.">
        No consumer
      </span>
    )
  }

  return (
    <span className="flex flex-wrap gap-1">
      {delivery.done > 0 && <Pill tone="ok">{delivery.done} done</Pill>}
      {delivery.pending > 0 && <Pill tone="warn">{delivery.pending} pending</Pill>}
      {delivery.failed > 0 && <Pill tone="bad">{delivery.failed} failed</Pill>}
      {delivery.skipped > 0 && <Pill tone="mute">{delivery.skipped} skipped</Pill>}
    </span>
  )
}

const PILL: Record<string, string> = {
  ok: 'border-border bg-muted text-muted-foreground',
  warn: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  bad: 'border-destructive/30 bg-destructive/10 text-destructive',
  mute: 'border-dashed border-border bg-transparent text-muted-foreground',
}

function Pill({ tone, children }: { tone: keyof typeof PILL | string; children: React.ReactNode }) {
  return (
    <span className={`rounded-full border px-1.5 py-0.5 text-[10px] whitespace-nowrap ${PILL[tone]}`}>
      {children}
    </span>
  )
}

/**
 * Consumers, with what the ledger says each has done.
 *
 * `ledger_key` is shown because it is NOT the consumer's name — the catalogue is keyed
 * by class (`AuditLogProjector`) and the ledger by that class's own constant
 * (`audit_log_projector`). Anyone querying the table by hand needs the second one, and
 * the mismatch is exactly what made the first build of this screen report zeroes against
 * a healthy bus.
 */
export function ConsumerTable({ rows }: { rows: ConsumerRow[] }) {
  return (
    <Shell minWidth="min-w-[50rem]">
      <thead>
        <tr className="bg-muted/50">
          <Th>Consumer</Th>
          <Th>Kind</Th>
          <Th>Events</Th>
          <Th>Delivered</Th>
          <Th>Last run</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {rows.length === 0 && <EmptyRow colSpan={5}>The catalogue declares no consumers.</EmptyRow>}

        {rows.map((row) => (
          <tr key={row.name} className="transition-colors hover:bg-muted/40">
            <td className="px-3 py-2.5 align-top">
              <p className="font-medium text-card-foreground">{row.name}</p>
              <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                {row.ledger_key ?? 'no ledger key'}
              </p>
              {/* A declared consumer whose class is missing is a configuration fault,
                  and it is the one thing on this screen worth shouting about. */}
              {!row.resolves && (
                <p className="mt-1 text-[11px] font-medium text-destructive">
                  Declared in the catalogue, but the class does not exist.
                </p>
              )}
            </td>
            <td className="px-3 py-2.5 align-top text-xs whitespace-nowrap text-muted-foreground">
              {row.kind_label}
            </td>
            <td className="px-3 py-2.5 align-top text-xs tabular-nums text-muted-foreground">
              {row.events.length}
            </td>
            <td className="px-3 py-2.5 align-top text-xs whitespace-nowrap">
              {row.counts_available ? (
                <span className="flex flex-wrap gap-1">
                  <Pill tone="ok">{row.done ?? 0} done</Pill>
                  {(row.pending ?? 0) > 0 && <Pill tone="warn">{row.pending} pending</Pill>}
                  {(row.failed ?? 0) > 0 && <Pill tone="bad">{row.failed} failed</Pill>}
                  {(row.skipped ?? 0) > 0 && <Pill tone="mute">{row.skipped} skipped</Pill>}
                </span>
              ) : (
                <span className="text-muted-foreground/60" title="The ledger key could not be resolved.">
                  Unknown
                </span>
              )}
            </td>
            <td className="px-3 py-2.5 align-top text-xs whitespace-nowrap tabular-nums text-muted-foreground">
              {row.last_completed_at ? (
                new Date(row.last_completed_at).toLocaleString()
              ) : (
                <span className="text-muted-foreground/60">Never</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </Shell>
  )
}

export function FailureTable({ rows }: { rows: FailureRow[] }) {
  return (
    <Shell minWidth="min-w-[50rem]">
      <thead>
        <tr className="bg-muted/50">
          <Th>Consumer</Th>
          <Th>Event</Th>
          <Th>Attempts</Th>
          <Th>Error</Th>
          <Th>Occurred</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {rows.length === 0 && (
          <EmptyRow colSpan={5}>No failed deliveries. Every event has reached its consumers.</EmptyRow>
        )}

        {rows.map((row) => (
          <tr key={row.id} className="transition-colors hover:bg-muted/40">
            <td className="px-3 py-2.5 align-top font-mono text-xs text-card-foreground">
              {row.consumer}
            </td>
            <td className="px-3 py-2.5 align-top text-xs">
              {eventLabel(row.type)}
              <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{row.type}</p>
            </td>
            <td className="px-3 py-2.5 align-top text-xs tabular-nums">{row.attempts}</td>
            <td className="px-3 py-2.5 align-top">
              {/* The message the consumer reported, verbatim and wrapped rather than
                  truncated — it is the only thing on the row that says what to fix. */}
              <p className="max-w-lg font-mono text-[11px] leading-5 break-words text-destructive">
                {row.last_error ?? 'No error message was recorded.'}
              </p>
            </td>
            <td className="px-3 py-2.5 align-top text-xs whitespace-nowrap tabular-nums text-muted-foreground">
              {new Date(row.occurred_at).toLocaleString()}
            </td>
          </tr>
        ))}
      </tbody>
    </Shell>
  )
}

/**
 * The catalogue: which events exist and who listens.
 *
 * The view the delivery ledger cannot give you. An event nobody consumes produces no
 * delivery rows, so it is invisible everywhere else on this screen — precisely when it
 * is most worth knowing about.
 */
export function CatalogueView({ catalogue }: { catalogue: EventCatalogue }) {
  return (
    <div className="space-y-4">
      {catalogue.problems.length > 0 && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm font-medium text-destructive">
            The catalogue is not coherent ({catalogue.problems.length})
          </p>
          <ul className="mt-2 space-y-1">
            {catalogue.problems.map((problem) => (
              <li key={problem} className="text-xs leading-5 text-foreground">
                {problem}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Shell minWidth="min-w-[42rem]">
        <thead>
          <tr className="bg-muted/50">
            <Th>Event</Th>
            <Th>Consumers</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {catalogue.shipped.map((entry) => (
            <tr key={entry.event} className="transition-colors hover:bg-muted/40">
              <td className="px-3 py-2.5 align-top">
                <p className="font-medium text-card-foreground">{eventLabel(entry.event)}</p>
                <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{entry.event}</p>
              </td>
              <td className="px-3 py-2.5 align-top">
                <div className="flex flex-wrap gap-1.5">
                  {entry.consumers.map((consumer) => (
                    <ConsumerChip key={consumer.name} consumer={consumer} />
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </Shell>

      <div className="grid gap-4 sm:grid-cols-2">
        <CatalogueList
          title="Declared but not shipped"
          blurb="Named in the catalogue with no consumer built yet. These record nothing."
          items={catalogue.not_shipped}
        />
        <CatalogueList
          title="Shipped but not notified"
          blurb="Consumed, but nobody is told when they happen."
          items={catalogue.not_notified}
        />
      </div>
    </div>
  )
}

function ConsumerChip({ consumer }: { consumer: CatalogueConsumer }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
        consumer.resolves
          ? 'border-border bg-muted text-muted-foreground'
          : 'border-destructive/30 bg-destructive/10 text-destructive'
      }`}
      title={consumer.resolves ? consumer.kind_label : 'This class does not exist.'}
    >
      <span className="font-mono">{consumer.name}</span>
      <span className="opacity-60">{consumer.kind}</span>
    </span>
  )
}

function CatalogueList({
  title,
  blurb,
  items,
}: {
  title: string
  blurb: string
  items: string[]
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-card-foreground">
        {title} ({items.length})
      </h3>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{blurb}</p>
      {items.length > 0 && (
        <ul className="mt-2 space-y-1">
          {items.map((item) => (
            <li key={item} className="font-mono text-[11px] text-muted-foreground">
              {item}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
