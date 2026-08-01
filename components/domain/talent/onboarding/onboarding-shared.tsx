'use client'

/**
 * Shared presentation pieces for the Onboarding & Employee Lifecycle Center.
 *
 * Every label rendered here comes from the API (status_label, stage_label,
 * category_label, date_label, ...) rather than being re-derived on the client,
 * so the screen and the audit trail always read the same words.
 *
 * PaginationBar and ResultBanner are re-exported from the Performance module's
 * shared file rather than copied: both are domain-agnostic and already work, and
 * a second implementation would drift.
 */

import * as React from 'react'
import { Loader2 } from 'lucide-react'

import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { TableCell, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { PaginationBar, ResultBanner } from '@/components/domain/talent/performance/performance-shared'
import type {
  ConfirmationStatus,
  DocumentStatus,
  JourneyStage,
  JourneyStatus,
  StageStatus,
  TaskStatus,
} from '@/services/talent/onboarding'

export { PaginationBar, ResultBanner, StatusBadge }

/**
 * The design system's actual StatusBadge variants. NB: there is no
 * 'destructive' ('error' is the red one) and no 'info' - passing a name that is
 * not in this list makes the badge render grey with no warning.
 */
export type BadgeVariant =
  | 'default'
  | 'active'
  | 'success'
  | 'inactive'
  | 'pending'
  | 'warning'
  | 'error'
  | 'processing'
  | 'primary'

export function taskStatusVariant(status: TaskStatus): BadgeVariant {
  switch (status) {
    case 'completed':
      return 'success'
    case 'sent':
      return 'processing'
    case 'in_progress':
      return 'primary'
    case 'blocked':
      return 'error'
    default:
      return 'warning'
  }
}

export function journeyStatusVariant(status: JourneyStatus): BadgeVariant {
  switch (status) {
    case 'completed':
      return 'success'
    case 'in-progress':
      return 'processing'
    case 'on-hold':
      return 'warning'
    case 'cancelled':
      return 'error'
    default:
      return 'pending'
  }
}

export function journeyStageVariant(stage: JourneyStage): BadgeVariant {
  switch (stage) {
    case 'confirmed':
      return 'success'
    case 'probation':
      return 'warning'
    case 'exited':
      return 'error'
    case 'preboarding':
      return 'pending'
    default:
      return 'primary'
  }
}

export function documentStatusVariant(status: DocumentStatus): BadgeVariant {
  switch (status) {
    case 'verified':
      return 'success'
    case 'received':
      return 'active'
    case 'sent':
      return 'processing'
    case 'rejected':
      return 'error'
    default:
      return 'warning'
  }
}

export function confirmationVariant(status: ConfirmationStatus): BadgeVariant {
  switch (status) {
    case 'confirmed':
      return 'success'
    case 'extended':
      return 'warning'
    case 'terminated':
      return 'error'
    default:
      return 'pending'
  }
}

export function stageStatusVariant(status: StageStatus): BadgeVariant {
  switch (status) {
    case 'completed':
      return 'success'
    case 'in_progress':
      return 'processing'
    case 'skipped':
      return 'inactive'
    default:
      return 'pending'
  }
}

/** Circular initials avatar used by the task owner column and the sidebar. */
export function Initials({ value, className }: { value: string; className?: string }) {
  return (
    <div
      className={cn(
        'flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground',
        className,
      )}
    >
      {value}
    </div>
  )
}

/** Placeholder rows while a table loads, so the layout does not jump. */
export function TableSkeleton({ rows = 5, columns }: { rows?: number; columns: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <TableRow key={rowIndex}>
          {Array.from({ length: columns }).map((__, cellIndex) => (
            <TableCell key={cellIndex} className="py-3">
              <Skeleton className="h-4 w-full max-w-[140px]" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

/** Single-row message inside a table body (empty state / load failure). */
export function TableMessageRow({
  colSpan,
  title,
  description,
  action,
  tone = 'muted',
}: {
  colSpan: number
  title: string
  description?: string
  action?: React.ReactNode
  tone?: 'muted' | 'error'
}) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="py-12 text-center">
        <div className="flex flex-col items-center gap-2">
          <span className={cn('text-sm font-semibold', tone === 'error' ? 'text-destructive' : 'text-foreground')}>
            {title}
          </span>
          {description && <span className="text-xs text-muted-foreground">{description}</span>}
          {action}
        </div>
      </TableCell>
    </TableRow>
  )
}

export function InlineSpinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-4 animate-spin', className)} />
}

/** 'all' is the screen's "no filter" token; the API treats it as absent. */
export const ALL = 'all'

/** Strips the 'all' sentinel so it never reaches the query string. */
export function activeFilter(value: string | undefined) {
  return !value || value === ALL ? undefined : value
}
