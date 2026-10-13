'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { popIn } from '@/lib/motion/variants'
import { taskService } from '@/services/task'

interface Props {
  /** A date to pre-fill the new task's due date with — omit for "today". */
  defaultDueDate?: string
  onCreated: (taskId: string) => void
}

/**
 * The employee's own low-friction "type a title, hit Enter" create path —
 * CRM's bare board quick-add, reused here as the ONE fast-create
 * implementation so My Tasks and the Calendar's own quick-create popover
 * share it rather than each growing a slightly different copy.
 *
 * Deliberately not CreateTaskModal: this never collects an assignee,
 * department, job role or observer — it is always self-assigned, so there is
 * nothing here for anyone but the task's own creator to configure.
 */
export function QuickAddTaskBar({ defaultDueDate, onCreated }: Props) {
  const [title, setTitle] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    const trimmed = title.trim()
    if (!trimmed || submitting) return

    const context = getLaravelContext()
    if (!isLaravelContextReady(context)) {
      setError('Your ERP session is unavailable. Please sign in again.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const response = await taskService.quickAddMyTask(context, trimmed, defaultDueDate)
      setTitle('')
      onCreated(response.data.id)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create that task.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 rounded-xl border bg-card/40 p-2 transition-colors focus-within:border-primary/40">
        <Plus className="ml-1 size-4 shrink-0 text-muted-foreground" />
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void submit()
            }
          }}
          placeholder="Add a task for today… press Enter"
          className="h-9 flex-1 border-none bg-transparent shadow-none focus-visible:ring-0"
          disabled={submitting}
        />
        <AnimatePresence mode="wait" initial={false}>
          {submitting ? (
            <motion.div key="spinner" variants={popIn} initial="initial" animate="animate" exit="exit">
              <Spinner className="size-4" />
            </motion.div>
          ) : (
            <motion.div key="button" variants={popIn} initial="initial" animate="animate" exit="exit">
              <Button size="sm" onClick={() => void submit()} disabled={!title.trim()}>
                Add
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {error && <p className="px-1 text-xs text-destructive">{error}</p>}
    </div>
  )
}
