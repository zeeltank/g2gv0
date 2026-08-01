'use client'

/**
 * Shared presentation pieces for the Performance & Rewards Center.
 *
 * Kept in one place so the reviews table, the five domain tabs, the kanban board
 * and the sidebar all render a rating, a stage, a status and a pagination bar
 * identically. Every label shown here comes from the API (stage_label,
 * status_label, overall_rating_label, ...) rather than being re-derived.
 */

import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { TableCell, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type {
  CalibrationStatus,
  DecisionStatus,
  GoalStatus,
  ReviewStage,
  ReviewStatus,
} from '@/services/talent/performance'

/**
 * The design system's actual StatusBadge variants. NB: there is no
 * 'destructive' ('error' is the red one) and no 'info' - passing a name that is
 * not in this list makes the badge render grey with no warning.
 */
type BadgeVariant =
  | 'default'
  | 'active'
  | 'success'
  | 'inactive'
  | 'pending'
  | 'warning'
  | 'error'
  | 'processing'
  | 'primary'

export function stageVariant(stage: ReviewStage): BadgeVariant {
  switch (stage) {
    case 'self_review':
      return 'primary'
    case 'manager_review':
      return 'processing'
    case 'calibration':
      return 'warning'
    case 'final_review':
    case 'completed':
      return 'success'
    default:
      return 'default'
  }
}

export function reviewStatusVariant(status: ReviewStatus): BadgeVariant {
  switch (status) {
    case 'completed':
      return 'success'
    case 'in_progress':
      return 'primary'
    case 'pending':
      return 'warning'
    default:
      return 'default'
  }
}

export function decisionStatusVariant(status: DecisionStatus | 'paid'): BadgeVariant {
  switch (status) {
    case 'approved':
      return 'success'
    // Paid is a further step past approved, so it gets its own colour.
    case 'paid':
      return 'processing'
    case 'pending_approval':
      return 'warning'
    case 'rejected':
      return 'error'
    case 'draft':
      return 'default'
    default:
      return 'default'
  }
}

export function goalStatusVariant(status: GoalStatus): BadgeVariant {
  switch (status) {
    case 'achieved':
      return 'success'
    case 'active':
      return 'primary'
    case 'partially_achieved':
      return 'warning'
    case 'missed':
      return 'error'
    default:
      return 'default'
  }
}

export function calibrationStatusVariant(status: CalibrationStatus): BadgeVariant {
  switch (status) {
    case 'completed':
      return 'success'
    case 'locked':
      return 'processing'
    case 'in_progress':
      return 'primary'
    case 'scheduled':
      return 'warning'
    default:
      return 'default'
  }
}

/** The coloured dot + label the Overall Rating column shows. */
export function RatingCell({ rating, label }: { rating: number | null; label: string | null }) {
  if (rating === null) {
    return <span className="text-sm text-foreground/50">—</span>
  }

  return (
    <div className="flex items-center gap-1.5">
      <span
        className={cn(
          'size-2 shrink-0 rounded-full',
          rating >= 4 ? 'bg-success' : rating >= 3 ? 'bg-primary' : 'bg-warning',
        )}
      />
      <span className="text-sm font-medium text-foreground">{label ?? rating.toFixed(1)}</span>
    </div>
  )
}

/** Avatar initials + name + employee number, used in every table's first column. */
export function EmployeeCell({
  name,
  initials,
  employeeNo,
  secondary,
}: {
  name: string
  initials: string
  employeeNo?: string | null
  secondary?: string | null
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-muted text-xs font-bold text-muted-foreground">
        {initials}
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-semibold text-foreground">{name}</span>
        <span className="truncate text-xs text-muted-foreground">{secondary ?? employeeNo ?? '—'}</span>
      </div>
    </div>
  )
}

/** Money, in the currency the API returned. */
export function formatMoney(amount: number | null, currency = 'INR') {
  if (amount === null || amount === undefined) return '—'

  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toLocaleString()}`
  }
}

export function formatPct(value: number | null) {
  if (value === null || value === undefined) return '—'
  return `${value % 1 === 0 ? value : value.toFixed(1)}%`
}

/** Skeleton rows, so a loading table keeps the page height stable. */
export function TableLoadingRows({ columns, rows = 5 }: { columns: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <TableRow key={rowIndex}>
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <TableCell key={columnIndex}>
              <Skeleton className="h-4 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

/** A single full-width row for the empty / error case inside a table body. */
export function TableMessageRow({
  columns,
  title,
  description,
  action,
  tone = 'muted',
}: {
  columns: number
  title: string
  description?: string
  action?: React.ReactNode
  tone?: 'muted' | 'error'
}) {
  return (
    <TableRow>
      <TableCell colSpan={columns} className="py-12 text-center">
        <p className={cn('text-sm font-semibold', tone === 'error' ? 'text-destructive' : 'text-foreground')}>
          {title}
        </p>
        {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
        {action && <div className="mt-4 flex justify-center">{action}</div>}
      </TableCell>
    </TableRow>
  )
}

/** Sortable column header. Clicking toggles direction, as the design implies. */
export function SortableHead({
  label,
  column,
  activeColumn,
  direction,
  onSort,
}: {
  label: string
  column: string
  activeColumn: string
  direction: 'asc' | 'desc'
  onSort: (column: string) => void
}) {
  const isActive = activeColumn === column

  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className={cn(
        'flex items-center gap-1 text-left font-semibold transition-colors',
        isActive ? 'text-primary' : 'text-foreground hover:text-primary',
      )}
    >
      {label}
      <span className={cn('text-[10px]', isActive ? 'opacity-100' : 'opacity-30')}>
        {isActive && direction === 'asc' ? '▲' : '▼'}
      </span>
    </button>
  )
}

const PER_PAGE_OPTIONS = [
  { label: '10 per page', value: '10' },
  { label: '25 per page', value: '25' },
  { label: '50 per page', value: '50' },
  { label: '100 per page', value: '100' },
]

/**
 * Server-driven pagination bar. Page numbers are windowed around the current
 * page so a 25-page result does not render 25 buttons.
 */
export function PaginationBar({
  page,
  perPage,
  total,
  lastPage,
  onPageChange,
  onPerPageChange,
}: {
  page: number
  perPage: number
  total: number
  lastPage: number
  onPageChange: (page: number) => void
  onPerPageChange: (perPage: number) => void
}) {
  const from = total === 0 ? 0 : (page - 1) * perPage + 1
  const to = Math.min(page * perPage, total)

  const pages = React.useMemo(() => {
    const window: number[] = []
    const start = Math.max(1, Math.min(page - 2, lastPage - 4))
    const end = Math.min(lastPage, start + 4)

    for (let index = start; index <= end; index += 1) {
      window.push(index)
    }

    return window
  }, [page, lastPage])

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t bg-muted/5 p-4 sm:flex-row">
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">
          Showing {from} to {to} of {total} entries
        </span>
        <div className="w-[130px]">
          <Select
            value={String(perPage)}
            options={PER_PAGE_OPTIONS}
            onChange={(value) => onPerPageChange(Number(value))}
            aria-label="Rows per page"
          />
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="mr-1 size-4" /> Previous
        </Button>

        {pages[0] > 1 && <span className="px-1 text-muted-foreground">…</span>}

        {pages.map((pageNumber) => (
          <Button
            key={pageNumber}
            variant={pageNumber === page ? 'default' : 'ghost'}
            size="sm"
            className={cn('h-8 w-8', pageNumber === page ? '' : 'text-muted-foreground')}
            onClick={() => onPageChange(pageNumber)}
          >
            {pageNumber}
          </Button>
        ))}

        {pages[pages.length - 1] < lastPage && <span className="px-1 text-muted-foreground">…</span>}

        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          disabled={page >= lastPage}
          onClick={() => onPageChange(page + 1)}
        >
          Next <ChevronRight className="ml-1 size-4" />
        </Button>
      </div>
    </div>
  )
}

/** The small counters each domain tab shows above its table. */
export function SummaryStrip({ items }: { items: Array<{ label: string; value: string | number }> }) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border bg-muted/20 px-4 py-3">
      {items.map((item) => (
        <div key={item.label} className="flex items-baseline gap-2">
          <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
          <span className="text-sm font-bold text-foreground">{item.value}</span>
        </div>
      ))}
    </div>
  )
}

/** Inline banner for a mutation result, so an API guard message is never lost. */
export function ResultBanner({
  result,
  onDismiss,
}: {
  result: { ok: boolean; message: string } | null
  onDismiss: () => void
}) {
  if (!result) return null

  return (
    <div
      role="status"
      className={cn(
        'flex items-start justify-between gap-3 rounded-lg border px-4 py-2.5 text-sm',
        result.ok
          ? 'border-success/30 bg-success/10 text-success'
          : 'border-destructive/30 bg-destructive/10 text-destructive',
      )}
    >
      <span>{result.message}</span>
      <button type="button" onClick={onDismiss} className="text-xs font-semibold underline">
        Dismiss
      </button>
    </div>
  )
}

export { StatusBadge }
