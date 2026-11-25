'use client'

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { LaravelContext } from '@/lib/laravel-context'
import { PersonPanel } from './people/person-panel'

/**
 * Opens one person in a drawer on the right, over the list it was opened from (All people). The panel is T2's Person panel (the same one the company's People tab
 * shows), so there is one screen for a person, not two. `personId` null keeps the drawer closed. The panel carries its own header, so the drawer's title is read by a
 * screen reader only.
 */
export function PersonDrawer({ context, personId, onClose, onChanged }: {
  context: LaravelContext
  personId: number | null
  onClose: () => void
  onChanged?: () => void
}) {
  return (
    <Sheet open={personId !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-3xl">
        <SheetHeader className="sr-only">
          <SheetTitle>Person</SheetTitle>
          <SheetDescription>The person&apos;s details, deals, notes and files.</SheetDescription>
        </SheetHeader>
        {personId !== null && <PersonPanel context={context} personId={personId} onClose={onClose} onChanged={onChanged} showCompany />}
      </SheetContent>
    </Sheet>
  )
}
