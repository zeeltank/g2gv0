'use client'

import { useCallback, useEffect, useId, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { NativeSelect } from '@/components/shared/scaffolds'
import { NOTICE_TONE } from '@/lib/org-accounts/tones'
import { canConfirmMove, movedSentence } from '@/lib/portfolio/removal-model'
import { productRecordService } from '@/services/product-master/record-service'
import type { PmMoveResult, PmRemovalTarget } from '@/services/product-master/record-types'

/** One Sub-product (or item) to move: its id for the request and its name for the sentence. */
export interface MoveSubject {
  id: number
  name: string
}

type Read = { phase: 'loading' } | { phase: 'failed'; error: string } | { phase: 'ready'; targets: PmRemovalTarget[] }

const messageOf = (cause: unknown, fallback: string) => (cause instanceof Error && cause.message.trim() !== '' ? cause.message : fallback)
const MOST_NAMES = 5

/** "Fee module", "Fee module and Reports", "Fee module, Reports and 3 more": the names the dialog says it is moving. */
export function namesText(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  if (names.length <= MOST_NAMES) return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  return `${names.slice(0, MOST_NAMES - 1).join(', ')} and ${names.length - (MOST_NAMES - 1)} more`
}

/**
 * Move one or several Sub-products under another Product (S15 follow-up, contract D-6). The dialog is open while it is mounted. The Products it offers are the
 * `targets` of the removal read of the first Sub-product (`GET /product-master/{id}/removal`): the organisation's active Products. Confirm stays disabled until a
 * Product is chosen; the move is one request for all of them and all or nothing on the server. Moving a Sub-product to the Product it is already under is not an
 * error: the sentence says so. A real dialog: titled and described, focus kept inside, Escape closes it, and it says in words when it is loading, working or has failed.
 */
export function MoveSubProductsDialog({ subjects, onClose, onMoved }: {
  subjects: readonly MoveSubject[]
  onClose: () => void
  /** Called after the move went through, with the sentence to show and what the server answered. */
  onMoved: (message: string, result: PmMoveResult) => void
}) {
  const baseId = useId()
  const [read, setRead] = useState<Read>({ phase: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [targetId, setTargetId] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const firstId = subjects[0]?.id ?? null
  const ids = subjects.map((subject) => subject.id)

  useEffect(() => {
    if (firstId === null) return
    let live = true
    productRecordService.removalPreview(firstId)
      .then((response) => { if (live) setRead({ phase: 'ready', targets: response.data.targets }) })
      .catch((cause: unknown) => { if (live) setRead({ phase: 'failed', error: messageOf(cause, 'The Products to move to could not be read.') }) })
    return () => { live = false }
  }, [firstId, attempt])

  const retry = useCallback(() => { setRead({ phase: 'loading' }); setAttempt((n) => n + 1) }, [])

  const targets = read.phase === 'ready' ? read.targets : []
  const valid = canConfirmMove(ids, targetId, targets)
  const names = subjects.map((subject) => subject.name)

  const confirm = async () => {
    if (!valid || busy || targetId === null) return
    setBusy(true)
    setFailure('')
    try {
      const response = await productRecordService.move({ subProductIds: ids, toProductId: targetId })
      onMoved(movedSentence(response.data, targets.find((target) => target.id === targetId)?.name ?? 'the other Product'), response.data)
    } catch (cause) {
      setFailure(messageOf(cause, 'They could not be moved. Nothing was changed.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(next) => { if (!next && !busy) onClose() }}>
      <DialogContent className="max-w-md" aria-busy={busy || read.phase === 'loading'}>
        <DialogHeader>
          <DialogTitle>{subjects.length === 1 ? `Move ${names[0]} to another Product` : `Move ${subjects.length} sub-products to another Product`}</DialogTitle>
          <DialogDescription>
            {namesText(names)} will sit under the Product you choose. The leads, campaigns, opportunities and documents that point at {subjects.length === 1 ? 'it' : 'them'} stay as they are.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {read.phase === 'loading' && (
            <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden="true" />Reading the Products…</p>
          )}
          {read.phase === 'failed' && (
            <div role="alert" className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm ${NOTICE_TONE.error}`}>
              <span>{read.error}</span>
              <Button type="button" size="sm" variant="outline" onClick={retry}>Try again</Button>
            </div>
          )}
          {read.phase === 'ready' && targets.length === 0 && (
            <p role="status" className="text-sm text-foreground">There is no other Product to move to. Add a Product first.</p>
          )}
          {read.phase === 'ready' && targets.length > 0 && (
            <div className="space-y-1.5">
              <label htmlFor={`${baseId}-target`} className="text-sm font-medium text-foreground">Move to</label>
              <NativeSelect id={`${baseId}-target`} value={targetId === null ? '' : String(targetId)} disabled={busy} onChange={(event) => setTargetId(event.target.value === '' ? null : Number(event.target.value))}>
                <option value="">Choose a Product…</option>
                {targets.map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}
              </NativeSelect>
            </div>
          )}
          {failure !== '' && <p role="alert" className={`rounded-lg border p-3 text-sm ${NOTICE_TONE.error}`}>{failure}</p>}
        </div>

        <DialogFooter className="flex-wrap">
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button type="button" disabled={!valid || busy} onClick={() => void confirm()}>
            {busy && <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden="true" />}
            {busy ? 'Moving…' : 'Move'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
