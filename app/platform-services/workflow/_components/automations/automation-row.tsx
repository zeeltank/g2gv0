'use client'

import { Loader2, MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Switch } from '@/components/ui/switch'
import { needsApproval } from '@/lib/workflows/catalog'
import { plainWorkflowName } from '@/lib/workflows/labels'
import { rowSentence } from '@/lib/workflows/sentence'
import { lastOutcomeParts, rowMenu, switchPlan, workflowStatusChip } from '@/lib/workflows/status'
import { CHIP_BASE, chipClass } from '@/lib/workflows/tones'
import type { GtmWorkflow, WorkflowCatalog } from '@/services/gtm/workflows'

/**
 * One automation as one row: the sentence it stands for, an On/Off switch, its status in a word, whether it needs approval, how it went last time, and a
 * menu (Edit, Try it, Duplicate, Archive). The row decides nothing itself: what the switch and the menu may do comes from lib/workflows/status.ts.
 */
export function AutomationRow({ workflow, catalog, canWrite, pending, now, deferRendering, onToggle, onEdit, onTryIt, onDuplicate, onArchive }: {
  workflow: GtmWorkflow
  catalog: WorkflowCatalog
  canWrite: boolean
  /** A change to this row is being sent. */
  pending: boolean
  now: Date
  /** A long list lets the browser skip drawing the rows that are off screen. */
  deferRendering: boolean
  onToggle: (workflow: GtmWorkflow) => void
  onEdit: (workflow: GtmWorkflow) => void
  onTryIt: (workflow: GtmWorkflow) => void
  onDuplicate: (workflow: GtmWorkflow) => void
  onArchive: (workflow: GtmWorkflow) => void
}) {
  const needs = needsApproval(workflow, catalog)
  const sentence = rowSentence(workflow, catalog, needs)
  const chip = workflowStatusChip(workflow.status)
  const outcome = lastOutcomeParts(workflow.last_run, now)
  const plan = switchPlan(workflow, catalog, canWrite)
  const menu = rowMenu(workflow.status, canWrite)
  const hasMenu = menu.edit !== 'hidden' || menu.tryIt || menu.duplicate || menu.archive
  const reasonId = `automation-${workflow.id}-switch-reason`

  return (
    <li data-automation={workflow.id} className={`flex flex-wrap items-start gap-x-4 gap-y-3 p-4${deferRendering ? ' [content-visibility:auto] [contain-intrinsic-size:auto_96px]' : ''}`}>
      <div className="min-w-0 flex-1 basis-full space-y-2 sm:basis-0">
        <p className="break-words text-sm font-medium leading-6 text-foreground">{sentence}</p>
        {workflow.name.trim() !== '' && <p className="break-words text-xs text-muted-foreground">Called “{plainWorkflowName(workflow.name)}”</p>}
        <div className="flex flex-wrap items-center gap-2">
          <span className={`${CHIP_BASE} ${chipClass(chip.tone)}`}>{chip.word}</span>
          {needs && <span className={`${CHIP_BASE} ${chipClass('caution')}`}>Needs approval</span>}
        </div>
        <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {outcome.map((part) => <span key={part} className="break-words">{part}</span>)}
        </p>
      </div>

      <div className="flex items-center gap-2">
        {pending && <Loader2 className="size-4 animate-spin text-muted-foreground motion-reduce:animate-none" aria-hidden="true" />}
        {workflow.status !== 'archived' && (
          <>
            <Switch
              checked={plan.checked}
              disabled={pending || plan.disabledReason !== null}
              aria-label={workflow.name}
              aria-describedby={plan.disabledReason ? reasonId : undefined}
              aria-busy={pending || undefined}
              onChange={() => onToggle(workflow)}
            />
            {plan.disabledReason && <span id={reasonId} className="sr-only">{plan.disabledReason}</span>}
          </>
        )}
        {hasMenu && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" aria-label={`More actions for ${workflow.name}`} disabled={pending}>
                <MoreHorizontal className="size-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {menu.edit === 'enabled' && <DropdownMenuItem onSelect={() => onEdit(workflow)}>Edit</DropdownMenuItem>}
              {menu.edit === 'disabled' && <DropdownMenuItem disabled>Edit (turn it off first)</DropdownMenuItem>}
              {menu.tryIt && <DropdownMenuItem onSelect={() => onTryIt(workflow)}>Try it</DropdownMenuItem>}
              {menu.duplicate && <DropdownMenuItem onSelect={() => onDuplicate(workflow)}>Duplicate</DropdownMenuItem>}
              {menu.archive && <DropdownMenuSeparator />}
              {menu.archive && <DropdownMenuItem onSelect={() => onArchive(workflow)}>Archive</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </li>
  )
}
