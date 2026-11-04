'use client'

import { useCallback, type ReactNode } from 'react'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { useConfirm } from './use-confirm'

const WIDTHS = { md: 'sm:max-w-md', lg: 'sm:max-w-xl', xl: 'sm:max-w-3xl' } as const

/**
 * A side drawer for creating or editing one record: a title, a scrolling body and a footer for the buttons.
 *
 * Every way of closing it goes through one guard: the X, Escape, a click outside, and a Cancel button in the footer (the footer can be a function that
 * receives the guarded close). While `dirty` is true the person is asked whether to throw the changes away; while `busy` (a save is running) it cannot
 * be closed at all. `onClose` is called only once closing is allowed, and the screen then sets its own `open` to false. After a successful save the
 * screen closes it by setting `open` to false itself, with `dirty` cleared, so no question is asked.
 */
export function RecordDrawer({ open, onClose, title, description, dirty = false, busy = false, width = 'lg', footer, children }: {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  /** The form holds changes that are not saved: closing asks first. */
  dirty?: boolean
  /** A save is running: the drawer cannot be closed until it finishes. */
  busy?: boolean
  width?: keyof typeof WIDTHS
  /** The buttons. A function receives the guarded close, for the Cancel button. */
  footer?: ReactNode | ((requestClose: () => void) => ReactNode)
  children: ReactNode
}) {
  const { confirm, confirmDialog } = useConfirm()

  const requestClose = useCallback(async () => {
    if (busy) return
    if (dirty) {
      const discard = await confirm({
        title: 'Discard your changes?',
        description: 'What you changed in this form has not been saved and will be lost.',
        confirmLabel: 'Discard changes',
      })
      if (!discard) return
    }
    onClose()
  }, [busy, dirty, confirm, onClose])

  const buttons = typeof footer === 'function' ? footer(() => void requestClose()) : footer

  return (
    <>
      <Sheet open={open} onOpenChange={(next) => { if (!next) void requestClose() }}>
        <SheetContent
          side="right"
          className={cn('flex w-full flex-col gap-0 p-0', WIDTHS[width])}
          {...(description ? {} : { 'aria-describedby': undefined })}
        >
          <SheetHeader className="mb-0 border-b border-border p-6 pr-12">
            <SheetTitle>{title}</SheetTitle>
            {description && <SheetDescription>{description}</SheetDescription>}
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-6">{children}</div>
          {buttons && <SheetFooter className="mt-0 border-t border-border p-4">{buttons}</SheetFooter>}
        </SheetContent>
      </Sheet>
      {confirmDialog}
    </>
  )
}
