'use client'

/**
 * The small parts of the Approvals tab: the chips, the notices, the coverage bar and the loading placeholder.
 *
 * The look follows the repo's tone rule (lib/org-accounts/tones.ts): the WORD carries the meaning, the text is `text-foreground` (or `text-muted-foreground` on the
 * muted surface) on a solid theme surface, and only the border takes the status colour. An icon is decoration and is hidden from a screen reader.
 */

import type { ReactNode } from 'react'
import { Check, CircleAlert, CircleDashed, PencilLine, PowerOff, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CHIP_BASE, CHIP_TONE, NOTICE_TONE } from '@/lib/org-accounts/tones'
import { cn } from '@/lib/utils'
import type { WorkflowStatus } from '@/lib/platform/workflow'
import {
  COVERAGE_TONE,
  COVERAGE_WORD,
  FLOW_STATUS_TONE,
  FLOW_STATUS_WORD,
  type Coverage,
} from '@/lib/platform/workflow-approvals'

const STATUS_ICON = { draft: PencilLine, active: Check, disabled: PowerOff } as const

/** The status of an approval flow: Draft, On or Off. The word is the meaning; the border and the icon only help. */
export function FlowStatusChip({ status }: { status: WorkflowStatus }) {
  const Icon = STATUS_ICON[status]

  return (
    <span className={cn(CHIP_BASE, CHIP_TONE[FLOW_STATUS_TONE[status]])} data-flow-status={status}>
      <Icon className="size-3" aria-hidden="true" />
      {FLOW_STATUS_WORD[status]}
    </span>
  )
}

const COVERAGE_ICON: Record<Coverage, typeof Check> = { on: Check, 'no-flow': CircleDashed, 'none-on': CircleDashed, 'not-in-use': CircleDashed }

/** Where an approval stands: a flow is on, none is, or the product does not use the approval yet. */
export function CoverageChip({ coverage }: { coverage: Coverage }) {
  const Icon = COVERAGE_ICON[coverage]

  return (
    <span className={cn(CHIP_BASE, CHIP_TONE[COVERAGE_TONE[coverage]], coverage === 'no-flow' && 'border-dashed')} data-coverage={coverage}>
      <Icon className="size-3" aria-hidden="true" />
      {COVERAGE_WORD[coverage]}
    </span>
  )
}

/**
 * A short message on a solid surface. A result the person just caused is announced politely (`status`); a problem is announced at once (`alert`).
 * `children` may hold a button.
 */
export function Notice({ tone, children, className }: { tone: 'success' | 'error' | 'caution'; children: ReactNode; className?: string }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex flex-wrap items-start gap-x-3 gap-y-2 rounded-lg border px-3 py-2 text-sm',
        tone === 'caution' ? 'border-amber-500 bg-card text-foreground' : NOTICE_TONE[tone],
        className,
      )}
    >
      {tone === 'success' && <Check className="mt-0.5 size-4 flex-none" aria-hidden="true" />}
      {tone !== 'success' && <CircleAlert className="mt-0.5 size-4 flex-none" aria-hidden="true" />}
      <div className="min-w-0 flex-1 break-words">{children}</div>
    </div>
  )
}

/** A load that failed: what went wrong, and the button that asks again. With a list already on screen the list stays, and the notice says it may be out of date. */
export function LoadFailed({ message, onRetry, withData }: { message: string; onRetry: () => void; withData: boolean }) {
  return (
    <Notice tone={withData ? 'caution' : 'error'}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 break-words">{withData ? `${message} The list below may be out of date.` : message}</p>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw aria-hidden="true" />
          Try again
        </Button>
      </div>
    </Notice>
  )
}

/**
 * One segment for each approval that works: filled when a flow is on, outlined when nobody signs it off. It repeats, as a shape, what the sentence above it
 * says in words, and is hidden from a screen reader for that reason.
 */
export function CoverageBar({ covered }: { covered: readonly boolean[] }) {
  if (covered.length === 0) return null

  return (
    <div className="flex w-full max-w-md gap-1" aria-hidden="true" data-coverage-bar>
      {covered.map((on, index) => (
        <span key={index} className={cn('h-1.5 flex-1 rounded-full', on ? 'bg-primary' : 'bg-muted')} />
      ))}
    </div>
  )
}

/** Placeholder rows while the first load runs, announced once as "Loading approvals…". */
export function ApprovalsSkeleton() {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <p className="text-sm text-muted-foreground">Loading approvals…</p>
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
    </div>
  )
}

/**
 * Makes the error text a shared `Field` draws dark enough to read. The shared Field paints it `text-destructive`, which is 3.97:1 on the surface
 * (lib/org-accounts/tones.ts, FIELD_ERROR_TEXT); the scaffold is not ours to change, so the form that holds the fields asks for the darker red.
 */
export const FIELD_ERROR_FIX = "[&_[id$='-error']]:text-red-700 dark:[&_[id$='-error']]:text-red-300"
