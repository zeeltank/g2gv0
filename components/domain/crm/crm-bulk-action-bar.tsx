'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Trash2, UserCog, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SearchableSelect, type SearchableOption } from '@/components/ui/searchable-select'
import { Spinner } from '@/components/ui/spinner'
import { toastSlideUp } from '@/lib/motion/variants'

interface Props {
  count: number
  busy: boolean
  people: SearchableOption[]
  onReassign: (assigneeId: string) => void
  onDelete: () => void
  onClear: () => void
}

/**
 * The shared bulk-action surface for all 4 CRM list views (Leads, Contacts,
 * Organizations, Campaigns) - same fixed-bottom-bar shape as Task
 * Management's WorkspaceBulkActionBar, modeled on it rather than imported:
 * that bar is still hand-rolled per its own two callers too, so there's no
 * existing generic actions-array convention in this app to adopt instead.
 */
export function CrmBulkActionBar({ count, busy, people, onReassign, onDelete, onClear }: Props) {
  const [assigneeId, setAssigneeId] = useState('')

  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          key="crm-bulk-action-bar"
          variants={toastSlideUp}
          initial="initial"
          animate="animate"
          exit="exit"
          className="fixed inset-x-0 bottom-4 z-40 mx-auto flex w-fit max-w-[calc(100%-2rem)] flex-wrap items-center gap-3 rounded-2xl border bg-card px-4 py-3 shadow-2xl"
        >
          <span className="whitespace-nowrap text-sm font-semibold">{count} selected</span>
          <div className="h-6 w-px bg-border" />

          <div className="flex items-center gap-2">
            <SearchableSelect
              value={assigneeId}
              onChange={setAssigneeId}
              options={people}
              placeholder="Change owner to…"
              searchPlaceholder="Search people…"
              className="w-56"
              aria-label="Change owner to"
            />
            <Button
              size="sm"
              disabled={!assigneeId || busy}
              onClick={() => { onReassign(assigneeId); setAssigneeId('') }}
            >
              <UserCog className="mr-2 size-4" />Reassign
            </Button>
          </div>

          <Button size="sm" variant="outline" className="text-destructive" disabled={busy} onClick={onDelete}>
            <Trash2 className="mr-2 size-4" />Delete
          </Button>

          {busy && <Spinner className="size-4" />}

          <Button size="sm" variant="ghost" aria-label="Clear selection" onClick={onClear} disabled={busy}>
            <X className="size-4" />
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
