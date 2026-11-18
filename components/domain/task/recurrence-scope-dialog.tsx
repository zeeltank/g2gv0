'use client'

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import type { RecurrenceScope } from '@/types/task-management'

interface Props {
  open: boolean
  /** "edit" or "delete" — only the wording changes, the three choices don't. */
  action: 'edit' | 'delete'
  onChoose: (scope: RecurrenceScope) => void
  onCancel: () => void
}

/**
 * This occurrence / this and following / all occurrences — CRM's own
 * edit/delete prompt for a recurring item, reused here as one dialog for
 * both tasks and events since the three choices mean the same thing either
 * way.
 */
export function RecurrenceScopeDialog({ open, action, onChoose, onCancel }: Props) {
  const verb = action === 'delete' ? 'Delete' : 'Save changes to'

  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!next) onCancel() }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>This is a repeating item</AlertDialogTitle>
          <AlertDialogDescription>
            {verb} just this occurrence, this one and every one after it, or the whole series?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
          <Button variant="outline" className="w-full justify-start" onClick={() => onChoose('this')}>
            {verb} this occurrence
          </Button>
          <Button variant="outline" className="w-full justify-start" onClick={() => onChoose('this_and_future')}>
            {verb} this and following occurrences
          </Button>
          <Button variant="destructive" className="w-full justify-start" onClick={() => onChoose('all')}>
            {verb} all occurrences
          </Button>
          <Button variant="ghost" className="w-full" onClick={onCancel}>Cancel</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
