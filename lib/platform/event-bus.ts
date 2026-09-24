/**
 * Event Bus reads.
 *
 * These mirror the API; they do not define it. `app/Services/Platform/EventBusReader.php`
 * owns the contract, and this file is how TypeScript sees what comes back.
 *
 * ── `available` IS NOT DECORATION ───────────────────────────────────────────
 *
 * A `KpiTile` can be unanswerable. "Last drain pass" is: nothing records a scheduled
 * run, so there is no ledger to read it from. A tile that cannot be computed carries
 * `available: false` and a hint saying why, and the screen must render that as an absence
 * rather than as a zero — "0" there reads as "nothing is behind", which is the opposite
 * of "we do not know", and an operations screen that invents a reassuring number is
 * worse than one that admits a gap.
 *
 * The same rule applies to `ConsumerRow.counts_available` and every `| null` below.
 */

import { platformRequest, type PlatformPage } from './client'

export interface KpiTile {
  key: string
  label: string
  value: string
  tone: 'gray' | 'green' | 'amber' | 'red'
  /** False means the number could not be computed. Render the absence, never a zero. */
  available: boolean
  /** The table(s) this came from, shown as provenance. Null when unavailable. */
  source: string | null
  /** Why it is unavailable, where that needs saying. */
  hint: string | null
}

export interface EventBusSummary {
  installed: boolean
  generated_at?: string
  tiles: KpiTile[]
}

export interface EventRow {
  id: number
  event_uuid: string
  type: string
  entity_type: string
  entity_id: number | null
  /** Null means SYSTEM — a real value, not "unknown". The event store's own design. */
  actor_id: number | null
  actor_name: string | null
  correlation_id: string | null
  occurred_at: string
  recorded_at: string
  delivery: { done: number; pending: number; failed: number; skipped: number }
}

export interface ConsumerRow {
  name: string
  kind: 'P' | 'R'
  kind_label: 'Projector' | 'Reactor'
  events: string[]
  /** Whether the class the catalogue names actually exists. */
  resolves: boolean
  /**
   * The name this consumer writes into the delivery ledger, which is NOT `name`.
   * The catalogue is keyed by class (`AuditLogProjector`); the ledger by each class's
   * own constant (`audit_log_projector`). Shown as provenance.
   */
  ledger_key: string | null
  counts_available: boolean
  done: number | null
  pending: number | null
  failed: number | null
  skipped: number | null
  last_completed_at: string | null
}

export interface FailureRow {
  id: number
  consumer: string
  attempts: number
  last_error: string | null
  type: string
  entity_type: string
  entity_id: number | null
  occurred_at: string
}

export interface CatalogueConsumer {
  name: string
  kind: 'P' | 'R'
  kind_label: 'Projector' | 'Reactor'
  resolves: boolean
}

export interface EventCatalogue {
  shipped: { event: string; consumers: CatalogueConsumer[] }[]
  not_shipped: string[]
  not_notified: string[]
  /** The catalogue's own consistency check. Empty means coherent. */
  problems: string[]
}

export interface StreamFilters {
  /**
   * NOT `type`. `type=API` is this product's transport marker, so a filter named `type`
   * arrives already occupied and silently matches nothing. The server names it
   * `event_type` for the same reason the audit endpoint had to.
   */
  event_type?: string
  entity_type?: string
  from?: string
  to?: string
}

export function fetchEventBusSummary(): Promise<EventBusSummary> {
  return platformRequest<EventBusSummary>('/events/summary')
}

export function fetchEventStream(
  filters: StreamFilters,
  page: number,
  limit = 25,
): Promise<PlatformPage<EventRow>> {
  return platformRequest<PlatformPage<EventRow>>('/events/stream', { ...filters, page, limit })
}

export function fetchConsumers(): Promise<{ rows: ConsumerRow[] }> {
  return platformRequest<{ rows: ConsumerRow[] }>('/events/consumers')
}

export function fetchFailures(page: number, limit = 25): Promise<PlatformPage<FailureRow>> {
  return platformRequest<PlatformPage<FailureRow>>('/events/failures', { page, limit })
}

export function fetchEventCatalogue(): Promise<EventCatalogue> {
  return platformRequest<EventCatalogue>('/events/catalogue')
}

export function fetchEventTypes(): Promise<{ event_types: string[] }> {
  return platformRequest<{ event_types: string[] }>('/events/options')
}
