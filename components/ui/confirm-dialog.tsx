'use client'

import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

/**
 * ASK BEFORE SOMETHING IRREVERSIBLE.
 *
 * Promoted from components/settings/sections/section-primitives.tsx (where
 * it originated and is still re-exported from, for every existing call
 * site) to a true shared `components/ui` primitive — the report builder
 * engine needs the exact same "confirm a destructive action" shape outside
 * the Settings area, and building a second copy there would be the kind of
 * drift this component existed to prevent in the first place.
 *
 * `description` is required rather than optional: "Are you sure?" adds a
 * click and no information — what a person needs is the actual consequence
 * ("12 reports in this folder will be removed too"), stated plainly.
 *
 * `tone` is the look of the confirm button: 'destructive' (the default, and what every question that removes something wants) or 'default' for a
 * question whose answer destroys nothing ("Create the CRM organisation?"), where a red button would mislead. Cancel is rendered through
 * AlertDialogCancel so the dialog has something to focus when it opens.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  busy,
  tone = 'destructive',
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmLabel: string
  busy?: boolean
  tone?: 'destructive' | 'default'
  onConfirm: () => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="w-[calc(100%-2rem)] max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
          <AlertDialogCancel asChild>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              disabled={busy}
            >
              Cancel
            </Button>
          </AlertDialogCancel>
          <Button
            variant={tone === 'default' ? 'default' : 'destructive'}
            className="w-full sm:w-auto"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
