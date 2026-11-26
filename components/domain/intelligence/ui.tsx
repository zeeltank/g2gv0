'use client'

import type { ComponentProps, ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft, ChevronRight, CircleDashed, CircleHelp, DatabaseZap, GraduationCap, Hourglass, Layers, ListChecks, Lock, Radar, RefreshCw, ShieldCheck, ShieldOff, TrendingUp, Unplug, UserPlus, Users } from 'lucide-react'
import { AVAILABILITY, type AvailabilityIcon, type AvailabilityState } from '@/lib/intelligence-center/availability'
import { NO_ROUTE_TEXT } from '@/lib/intelligence-center/coverage-registry'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { IntelligenceFailure } from '@/services/intelligence/errors'
import type { InsightSeverity } from '@/services/intelligence/types'
import type { DomainAccent, DomainIcon } from '@/lib/intelligence-center/domains'
import { HOME_HREF } from '@/lib/intelligence-center/domains'
import { CONDITION_LABEL, type Condition, type Snapshot, lastUpdated } from '@/lib/intelligence-center/derive'
import { formatAsOf, provisionalNotice, safeDeepLink, severityLabel, suppressedNotice } from '@/lib/intelligence-center/model'
import { ACCENT_TILE, CHIP_BASE, CONDITION_CHIP, LINK_CLASS, NOTICE, SEVERITY_CHIP, SURFACE } from '@/lib/intelligence-center/tones'
import { useIntelligence } from './intelligence-provider'

/* ── links ────────────────────────────────────────────────────────────── */

type AnchorProps = Omit<ComponentProps<typeof Link>, 'href'>

/**
 * The ONLY way a link is drawn on the Intelligence screens. The target goes through safeDeepLink (an in-app path or nothing), so a mistaken or tampered
 * value can never send a person to another site: when it is refused the text is shown without a link rather than as a dead one.
 */
export function IntelLink({ to, children, className, ...rest }: { to: string | null | undefined; children: ReactNode; className?: string } & AnchorProps) {
  const link = safeDeepLink(to)
  if (!link) return <span className={className}>{children}</span>
  return (
    <Link href={link} className={className} {...rest}>
      {children}
    </Link>
  )
}

/**
 * A screen of the product that a row or a finding points at. When there is a verified, safe route it is a link; when there is none it is NOT a link and
 * says so in fixed words (never a dead link, never a guessed address). The same presentation everywhere a screen may be missing.
 */
export function ScreenLink({ route, children, className }: { route: string | null | undefined; children: ReactNode; className?: string }) {
  const link = safeDeepLink(route)
  if (!link) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" data-route-unverified>
        {NO_ROUTE_TEXT}
      </span>
    )
  }
  return (
    <Link href={link} className={className ?? LINK_CLASS}>
      {children}
    </Link>
  )
}

export interface Crumb {
  label: string
  /** Absent on the page you are on. */
  to?: string
}

/** Intelligence > Domain > Area > Finding. The last crumb is the current page. */
export function Breadcrumbs({ items }: { items: readonly Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" data-breadcrumb>
      <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        {items.map((crumb, index) => {
          const last = index === items.length - 1
          return (
            <li key={`${crumb.label}-${index}`} className="flex items-center gap-1">
              {last || !crumb.to ? (
                <span aria-current={last ? 'page' : undefined} className={cn('max-w-[28ch] truncate', last && 'font-medium text-foreground')}>{crumb.label}</span>
              ) : (
                <IntelLink to={crumb.to} className="max-w-[28ch] truncate rounded-sm underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {crumb.label}
                </IntelLink>
              )}
              {!last && <ChevronRight className="size-3.5" aria-hidden="true" />}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <IntelLink to={to} className={LINK_CLASS} data-back-link>
      <ArrowLeft className="size-3.5" aria-hidden="true" />
      {children}
    </IntelLink>
  )
}

/* ── chips ────────────────────────────────────────────────────────────── */

const AVAILABILITY_ICONS: Record<AvailabilityIcon, typeof Lock> = {
  'circle-dashed': CircleDashed,
  hourglass: Hourglass,
  'database-zap': DatabaseZap,
  lock: Lock,
  unplug: Unplug,
  'circle-help': CircleHelp,
  'shield-off': ShieldOff,
}

/** Each availability condition has its own icon as well as its own words and border, so no two can be mistaken for one another. */
const CONDITION_ICON: Partial<Record<Condition, AvailabilityIcon>> = {
  partial: AVAILABILITY.partial.icon,
  not_enough_data: AVAILABILITY.not_enough_data.icon,
  data_unavailable: AVAILABILITY.data_unavailable.icon,
  access_restricted: AVAILABILITY.access_restricted.icon,
  not_connected: AVAILABILITY.not_connected.icon,
  not_assessed: AVAILABILITY.not_assessed.icon,
  excluded: AVAILABILITY.excluded.icon,
}

export function AvailabilityIconMark({ icon, className }: { icon: AvailabilityIcon; className?: string }) {
  const Icon = AVAILABILITY_ICONS[icon]
  return <Icon className={cn('size-3.5 shrink-0', className)} aria-hidden="true" data-icon={icon} />
}

export function ConditionChip({ condition, className }: { condition: Condition; className?: string }) {
  const icon = CONDITION_ICON[condition]
  return (
    <span className={cn(CHIP_BASE, CONDITION_CHIP[condition], className)} data-chip="condition" data-condition={condition}>
      {icon && <AvailabilityIconMark icon={icon} className="mr-1 inline" />}
      {CONDITION_LABEL[condition]}
    </span>
  )
}

export function SeverityChip({ severity }: { severity: InsightSeverity }) {
  return (
    <span className={cn(CHIP_BASE, SEVERITY_CHIP[severity])} data-chip="severity">
      {severityLabel(severity)}
    </span>
  )
}

const ICONS: Record<DomainIcon, typeof Users> = {
  users: Users,
  'user-plus': UserPlus,
  'graduation-cap': GraduationCap,
  'list-checks': ListChecks,
  'trending-up': TrendingUp,
  radar: Radar,
  'shield-check': ShieldCheck,
  layers: Layers,
}

export function DomainIconTile({ icon, accent, size = 'md' }: { icon: DomainIcon; accent: DomainAccent; size?: 'md' | 'lg' }) {
  const Icon = ICONS[icon] ?? Layers
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center rounded-lg shadow-[inset_0_1px_0_rgb(255_255_255/0.6)]', ACCENT_TILE[accent], size === 'lg' ? 'size-12' : 'size-10')} aria-hidden="true">
      <Icon className={size === 'lg' ? 'size-6' : 'size-5'} />
    </span>
  )
}

/**
 * THE one presentation of an availability state (partial, not enough data, data unavailable, access restricted, not connected, not yet assessed,
 * excluded): its icon, its own words from availability.ts, and what it means. Every page that has to say "this is not a finding" uses this, so the seven
 * never look different from one page to the next. `detail` replaces the standard meaning when the server gave a more specific reason.
 */
export function AvailabilityPanel({ state, detail, children, stateAttr, className }: { state: AvailabilityState; detail?: string | null; children?: ReactNode; stateAttr?: string; className?: string }) {
  const entry = AVAILABILITY[state]
  return (
    <div className={cn(SURFACE, 'space-y-2 border-dashed p-4', className)} data-intelligence-state={stateAttr ?? state.replace(/_/g, '-')} data-availability={state}>
      <p className="flex items-center gap-2 text-sm font-medium">
        <AvailabilityIconMark icon={entry.icon} className="text-indigo-700" />
        {entry.label}
      </p>
      <p className="text-sm text-muted-foreground">{detail && detail.trim() !== '' ? detail : entry.meaning}</p>
      {children}
    </div>
  )
}

/** A small count with its word, never a bare number. Tabular numerals so a column of counts lines up. */
export function Count({ value, label }: { value: number; label: string }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="text-lg font-semibold tabular-nums">{value.toLocaleString('en-GB')}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </span>
  )
}

/* ── page furniture ───────────────────────────────────────────────────── */

export function Section({ title, description, children, id, action }: { title: string; description?: string; children: ReactNode; id?: string; action?: ReactNode }) {
  const headingId = id ? `${id}-heading` : undefined
  return (
    <section aria-labelledby={headingId} id={id} className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id={headingId} className="text-base font-semibold text-foreground">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

/** The updated line and the Refresh button, shared by every Intelligence page. */
export function RefreshBar({ snapshot }: { snapshot: Snapshot | null }) {
  const { state, refresh } = useIntelligence()
  const refreshing = state.status === 'ready' && state.refreshing
  const cooling = state.status === 'ready' && state.cooling
  const updated = snapshot ? lastUpdated(snapshot) : null
  return (
    <div className="flex flex-wrap items-center gap-2">
      {snapshot && (
        <span className="text-xs text-muted-foreground" data-updated>
          Last updated {updated ? formatAsOf(updated) : 'time not recorded'}
        </span>
      )}
      <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing || cooling} aria-busy={refreshing} title={cooling ? 'Available again in a few seconds' : undefined}>
        <RefreshCw className={cn('size-3.5', refreshing && 'animate-spin motion-reduce:animate-none')} aria-hidden="true" />
        {refreshing ? 'Refreshing' : 'Refresh'}
      </Button>
    </div>
  )
}

export function ProvisionalPill({ snapshot }: { snapshot: Snapshot | null }) {
  return (
    <p className={cn(NOTICE.provisional, 'inline-block rounded-full py-1')} data-provisional-banner title={provisionalNotice(snapshot?.meta)}>
      Provisional thresholds
    </p>
  )
}

export function SuppressedLine({ snapshot }: { snapshot: Snapshot }) {
  const note = suppressedNotice(snapshot.meta)
  const truncated = snapshot.truncated
  if (!note && !truncated) return null
  return (
    <div className="space-y-1 text-xs text-muted-foreground">
      {note && <p>{note}</p>}
      {truncated && <p data-truncated>This view shows the first {snapshot.insights.length.toLocaleString('en-GB')} findings of {snapshot.total?.toLocaleString('en-GB') ?? 'more'}. The rest are not loaded here.</p>}
    </div>
  )
}

/* ── states ───────────────────────────────────────────────────────────── */

export function LoadingState() {
  return (
    <div role="status" aria-label="Loading intelligence" data-intelligence-state="loading" className="space-y-4">
      <h1 className="sr-only">Loading Intelligence</h1>
      <Skeleton className="h-24 w-full rounded-xl" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((n) => <Skeleton key={n} className="h-44 w-full rounded-xl" />)}
      </div>
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  )
}

export function FailureState({ failure, retry }: { failure: IntelligenceFailure; retry: () => void }) {
  const denied = failure.kind === 'forbidden'
  const off = failure.kind === 'unavailable'
  const signedOut = failure.kind === 'unauthenticated'
  const limited = failure.kind === 'rate_limited'
  const title = denied
    ? 'Intelligence is not available for your account'
    : off
      ? 'Intelligence is switched off right now'
      : signedOut
        ? 'Please sign in again'
        : limited
          ? 'Too many requests'
          : 'Intelligence could not be shown'
  const detail = denied
    ? 'Your role or rights do not include it. If you think they should, ask an administrator; nothing is wrong with your account.'
    : limited
      ? 'Too many requests were made just now. Try again in a minute.'
      : failure.message
  return (
    <div
      role={denied ? 'status' : 'alert'}
      data-intelligence-state={denied ? 'denied' : off ? 'unavailable' : 'error'}
      className={cn(SURFACE, 'px-6 py-10 text-center')}
    >
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{detail}</p>
      {failure.retryable && (
        <Button className="mt-4" variant="outline" onClick={retry}>
          <RefreshCw className="size-4" aria-hidden="true" />
          Try again
        </Button>
      )}
    </div>
  )
}

/** "That page does not exist": for an unknown domain or area. Always a way home. */
export function NotFoundState({ title, detail, backTo, backLabel }: { title: string; detail: string; backTo: string; backLabel: string }) {
  return (
    <div role="status" data-intelligence-state="not-found" className={cn(SURFACE, 'px-6 py-10 text-center')}>
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{detail}</p>
      <div className="mt-4">
        <BackLink to={backTo}>{backLabel}</BackLink>
      </div>
    </div>
  )
}

/**
 * The shell every Intelligence page sits in: the frame, the loading / failure states, and (once loaded) the page itself, given the shared snapshot.
 * `crumbs` is shown above everything, including while loading and on failure, so a way back always exists.
 */
export function IntelligencePage({
  crumbs,
  page,
  children,
}: {
  crumbs: readonly Crumb[]
  /** Which page this is, for tests and for the page's own landmark. */
  page: string
  children: (snapshot: Snapshot) => ReactNode
}) {
  const { state, retry } = useIntelligence()
  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 p-4 sm:p-6" data-intelligence-center data-page={page}>
      {crumbs.length > 1 ? <Breadcrumbs items={crumbs} /> : null}
      {state.status === 'loading' && <LoadingState />}
      {state.status === 'error' && (
        <div className="space-y-4">
          <FailureState failure={state.failure} retry={retry} />
          {state.failure.kind !== 'forbidden' && <BackLink to={HOME_HREF}>Back to Intelligence</BackLink>}
        </div>
      )}
      {state.status === 'ready' && (
        <>
          {state.refreshFailure && (
            <p role="alert" className={NOTICE.info} data-refresh-failed>
              Refreshing failed: {state.refreshFailure.message} The findings below are from the last successful load.
            </p>
          )}
          {children(state.snapshot)}
        </>
      )}
    </div>
  )
}
