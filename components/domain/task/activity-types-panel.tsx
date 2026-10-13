'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { CalendarClock, CircleDot, Flag, ListTodo, SlidersHorizontal, X } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { drawerSlideInLeft } from '@/lib/motion/variants'
import type { CalendarEntryKind } from '@/types/task-management'

interface Props {
  open: boolean
  onClose: () => void
  /** Kinds currently hidden from the grid/list — everything else is shown. */
  hidden: Set<CalendarEntryKind>
  onToggle: (kind: CalendarEntryKind) => void
}

/**
 * TASK and EVENT have no single fixed color (a task's is per-project, an
 * event's per-owner, see calendar-event-mapping.ts) - showing one swatch for
 * either would just be wrong for most rows, so only the two kinds that
 * genuinely render with one representative default color get a dot here.
 */
const ROWS: Array<{ kind: CalendarEntryKind; label: string; icon: React.ElementType; dotClassName: string | null }> = [
  { kind: 'TASK', label: 'Tasks', icon: ListTodo, dotClassName: null },
  { kind: 'EVENT', label: 'Events', icon: CalendarClock, dotClassName: null },
  { kind: 'MILESTONE', label: 'Milestones', icon: Flag, dotClassName: 'bg-primary' },
  { kind: 'CHECKPOINT', label: 'Checkpoints', icon: CircleDot, dotClassName: 'bg-secondary-foreground' },
]

/**
 * A scoped-down, g2g-native Activity Types toggle - not CRM's full generic
 * "any module, any date field" admin system. This closes the concrete gap
 * that system left: MILESTONE/CHECKPOINT entries exist in the merged feed
 * (widened in 9.1) with no way to hide any of the four kinds at all.
 */
export function ActivityTypesPanel({ open, onClose, hidden, onToggle }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            variants={drawerSlideInLeft}
            initial="initial"
            animate="animate"
            exit="exit"
            className="fixed inset-y-0 left-0 z-50 w-72 overflow-y-auto border-r bg-card p-4 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold"><SlidersHorizontal className="size-4" /> Activity Types</h3>
              <button type="button" aria-label="Close" onClick={onClose} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">Show or hide each kind of entry on the calendar.</p>
            <div className="space-y-1">
              {ROWS.map(({ kind, label, icon: Icon, dotClassName }) => (
                <label key={kind} className="flex cursor-pointer items-center gap-2 rounded-lg p-2 hover:bg-muted/40">
                  <Checkbox checked={!hidden.has(kind)} onCheckedChange={() => onToggle(kind)} />
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm">{label}</span>
                  {dotClassName && <span className={`size-2.5 shrink-0 rounded-full ${dotClassName}`} />}
                </label>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
