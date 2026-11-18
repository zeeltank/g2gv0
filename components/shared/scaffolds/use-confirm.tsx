'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

export interface ConfirmOptions {
  title: string
  /** The actual consequence, in plain words ("12 reports in this folder will be removed too"). */
  description: ReactNode
  confirmLabel: string
  /** The look of the confirm button: 'destructive' (the default) for something that removes, 'default' for a question that destroys nothing. */
  tone?: 'destructive' | 'default'
}

/**
 * Asks before something that cannot be undone, in place of window.confirm.
 *
 *   const { confirm, confirmDialog } = useConfirm()
 *   if (!(await confirm({ title: 'Archive Scholar Core?', description: '…', confirmLabel: 'Archive' }))) return
 *   …do it…
 *   return <>…{confirmDialog}</>
 *
 * `confirmDialog` must be rendered somewhere in the component, or the question never appears and `confirm` never settles.
 * The promise resolves true on the confirm button and false on Cancel, Escape and a click outside. A second question while one is open answers the
 * first with "no", and a component that unmounts with a question open answers it "no", so nothing is left waiting.
 */
export function useConfirm() {
  const [open, setOpen] = useState(false)
  // Kept after closing so the text does not vanish while the dialog fades out.
  const [content, setContent] = useState<ConfirmOptions | null>(null)
  const pending = useRef<((answer: boolean) => void) | null>(null)

  const settle = useCallback((answer: boolean) => {
    const resolve = pending.current
    pending.current = null
    setOpen(false)
    resolve?.(answer)
  }, [])

  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => {
    pending.current?.(false)
    pending.current = resolve
    setContent(options)
    setOpen(true)
  }), [])

  useEffect(() => () => {
    pending.current?.(false)
    pending.current = null
  }, [])

  const confirmDialog = (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => { if (!next) settle(false) }}
      title={content?.title ?? ''}
      description={content?.description ?? ''}
      confirmLabel={content?.confirmLabel ?? ''}
      tone={content?.tone}
      onConfirm={() => settle(true)}
    />
  )

  return { confirm, confirmDialog }
}
