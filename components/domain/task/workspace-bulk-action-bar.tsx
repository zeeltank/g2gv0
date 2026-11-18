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
  /**
   * My Tasks gets Delete only, no Change Owner - that screen's own design
   * already states the principle (a person's own work, not where someone
   * assigns work to others), and bulk-reassigning your own tasks away from
   * yourself contradicts it directly.
   */
  allowReassign: boolean
  onReassign: (assigneeId: string) => void
  onDelete: () => void
  onClear: () => void
}

/**
 * The Dashboard and My Tasks' shared bulk-action surface - a bottom-fixed
 * bar, not a toolbar row, so it never competes for space with the filters
 * above the table. Framer Motion is this module's own sanctioned exception
 * to g2g's usual CSS-transition-only convention (see lib/motion/variants.ts).
 */
export function WorkspaceBulkActionBar({ count, busy, people, allowReassign, onReassign, onDelete, onClear }: Props) {
  const [assigneeId, setAssigneeId] = useState('')

  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          key="workspace-bulk-action-bar"
          variants={toastSlideUp}
          initial="initial"
          animate="animate"
          exit="exit"
          className="fixed inset-x-0 bottom-4 z-40 mx-auto flex w-fit max-w-[calc(100%-2rem)] flex-wrap items-center gap-3 rounded-2xl border bg-card px-4 py-3 shadow-2xl"
        >
          <span className="whitespace-nowrap text-sm font-semibold">{count} selected</span>
          <div className="h-6 w-px bg-border" />

          {allowReassign && (
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
          )}

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
