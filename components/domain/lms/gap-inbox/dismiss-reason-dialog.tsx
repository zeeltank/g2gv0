'use client'

/**
 * Dismiss confirmation — reason is mandatory on the server
 * (`POST /competency/course-requests/{id}/dismiss` requires `reason`, max 191
 * chars) and this dialog never lets Confirm go through without one, so the
 * UI cannot even attempt the request the server would 422 on.
 *
 * Shared between the single-row action and the bulk "Dismiss selected"
 * action — `label` says which.
 */

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

const MAX_REASON_LENGTH = 191

export function DismissReasonDialog({
  open,
  onOpenChange,
  label,
  busy,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** e.g. "Team Supervision" or "3 selected requests". */
  label: string
  busy: boolean
  onConfirm: (reason: string) => void
}) {
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (!open) return
    queueMicrotask(() => setReason(''))
  }, [open])

  const trimmed = reason.trim()

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Dismiss {label}?</AlertDialogTitle>
          <AlertDialogDescription>
            This says no course will be created for this gap. Anyone affected keeps their gap open
            and unassigned — it can always be reopened later, or will resolve on its own if their
            rating rises past the requirement.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-1.5">
          <label className="text-sm font-bold text-foreground">
            Reason <span className="text-destructive">*</span>
          </label>
          <Textarea
            autoFocus
            value={reason}
            maxLength={MAX_REASON_LENGTH}
            onChange={(event) => setReason(event.target.value)}
            placeholder="E.g. covered by an external certification we don't track here"
            className="min-h-[72px]"
          />
          <p className="text-right text-[11px] text-muted-foreground">
            {trimmed.length} / {MAX_REASON_LENGTH}
          </p>
        </div>

        <AlertDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            className="gap-2"
            disabled={busy || trimmed.length === 0}
            onClick={() => onConfirm(trimmed)}
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            Dismiss
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
