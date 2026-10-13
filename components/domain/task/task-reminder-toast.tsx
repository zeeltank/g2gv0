'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Bell, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTaskReminders } from '@/hooks/use-task-reminders'
import { toastSlideUp } from '@/lib/motion/variants'

const SNOOZE_OPTIONS: Array<{ label: string; minutes: number }> = [
  { label: '5m', minutes: 5 },
  { label: '30m', minutes: 30 },
  { label: '1h', minutes: 60 },
]

/**
 * A small, self-contained reminder toast stack — g2g has no toast primitive
 * anywhere today to extend, so this is net-new, scoped to Task Management
 * screens only (mounted individually in task-workspace.tsx, my-tasks-view.tsx
 * and task-calendar-view.tsx — see useTaskReminders' own docblock for why
 * this only fires while one of those is open).
 */
export function TaskReminderToast() {
  const { reminders, markSeen, snooze } = useTaskReminders()

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
      <AnimatePresence initial={false}>
        {reminders.map((reminder) => (
          <motion.div
            key={reminder.delivery_id}
            layout
            variants={toastSlideUp}
            initial="initial"
            animate="animate"
            exit="exit"
            className="pointer-events-auto rounded-xl border bg-card p-3 shadow-lg"
          >
            <div className="flex items-start gap-2">
              <Bell className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{reminder.title}</p>
                <p className="text-xs text-muted-foreground">
                  {reminder.entry_type === 'TASK' ? 'Task due' : 'Event'} · {new Date(reminder.fire_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </p>
              </div>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => void markSeen(reminder.delivery_id)}
                className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-2 flex gap-1.5">
              {SNOOZE_OPTIONS.map((option) => (
                <Button
                  key={option.minutes}
                  variant="outline"
                  size="xs"
                  onClick={() => void snooze(reminder.delivery_id, option.minutes)}
                >
                  Snooze {option.label}
                </Button>
              ))}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
