'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, X } from 'lucide-react'
import { useEffect } from 'react'
import { toastSlideUp } from '@/lib/motion/variants'
import { cn } from '@/lib/utils'

export interface ToastProps {
  /** `null` renders nothing - the caller owns the message state, this component owns only its own lifetime/animation. */
  message: string | null
  tone?: 'info' | 'error'
  onDismiss: () => void
  durationMs?: number
}

/**
 * A small, self-dismissing transient notification - g2g had exactly one
 * toast-shaped precedent before this (`TaskReminderToast`), whose own
 * docblock states there was no reusable primitive to extend. This is that
 * primitive, generalized just enough for a second caller (Document Library's
 * upload success + Share dialog feedback) without becoming a global/context-
 * based system: no provider, no app-layout mount - each screen that wants one
 * owns one `useState<string | null>` and renders this once, same per-screen
 * mounting `TaskReminderToast` itself already uses rather than a global
 * toaster, since neither caller needs cross-screen stacking or queuing.
 */
export function Toast({ message, tone = 'info', onDismiss, durationMs = 5000 }: ToastProps) {
  useEffect(() => {
    if (!message) return
    const id = setTimeout(onDismiss, durationMs)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message, durationMs])

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 w-80">
      <AnimatePresence>
        {message && (
          <motion.div
            variants={toastSlideUp}
            initial="initial"
            animate="animate"
            exit="exit"
            className={cn(
              'pointer-events-auto flex items-start gap-2 rounded-xl border bg-card p-3 shadow-lg',
              tone === 'error' && 'border-destructive/30',
            )}
          >
            {tone === 'info' && <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />}
            <p className={cn('min-w-0 flex-1 text-sm', tone === 'error' ? 'text-destructive' : 'text-foreground')}>{message}</p>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={onDismiss}
              className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export interface ToastPayload {
  title?: string
  description?: string
  variant?: 'default' | 'success' | 'destructive' | 'info'
}

export function toast(payload: ToastPayload | string) {
  if (typeof window !== 'undefined') {
    const text = typeof payload === 'string'
      ? payload
      : (payload.title ? `${payload.title} - ${payload.description ?? ''}` : payload.description ?? '')
    window.dispatchEvent(new CustomEvent('gtg:toast', { detail: payload }))
  }
}
