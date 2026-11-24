'use client'

import { useCallback, useEffect, useId, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { NativeSelect } from '@/components/shared/scaffolds'
import { NOTICE_TONE } from '@/lib/org-accounts/tones'
import { blockedSubProducts, blockerSentences, canConfirmRemoval, choiceState, ownBlockers, removalMode, removeBodyFor, removedSentence, type SubProductsChoice } from '@/lib/portfolio/removal-model'
import { ApiError } from '@/services/core'
import { productRecordService } from '@/services/product-master/record-service'
import type { PmRemovalPreview, PmRemoveResult } from '@/services/product-master/record-types'
import type { PmKind } from '@/services/product-master/types'

/** The record the dialog is about: enough to name it before the preview has been read. */
export interface RemoveTarget {
  id: number
  name: string
  kind: PmKind
}

type Read = { phase: 'loading' } | { phase: 'failed'; error: string } | { phase: 'ready'; preview: PmRemovalPreview }

const messageOf = (cause: unknown, fallback: string) => (cause instanceof Error && cause.message.trim() !== '' ? cause.message : fallback)

/**
 * Delete a Product or a Sub-product (S15 follow-up, contract D-4 and D-5). The dialog is open while it is mounted: the screen draws it when a person chooses Delete
 * and removes it on Cancel, Escape, Archive instead or success, so every question starts from a fresh read.
 *
 * It reads what the delete would do BEFORE it asks (`GET /product-master/{id}/removal`) and then shows one of three things:
 *  - nothing holds the record and there is nothing to choose: a plain "Delete" confirmation;
 *  - a Product that has Sub-products and is not held itself: the ask-each-time question, listing the Sub-products (a held one is marked) and two answers, "Move them
 *    to another Product" with a select of Products, or "Delete them together with it". The confirm button stays disabled until the answer is a valid one;
 *  - something holds it: the plain sentences that say what and how many, and the button "Archive instead" (which never loses data), and for a Sub-product also
 *    "Move to another Product".
 * Deleting is all or nothing on the server. When the server still refuses (409: something changed since the preview) the preview is read again, so the sentences
 * are on screen; when it fails for any other reason the server's own words are shown and nothing is lost. A real dialog: it has a title and a description, keeps
 * focus inside, closes on Escape and says in words when it is working.
 */
export function RemoveRecordDialog({ record, onClose, onRemoved, onArchiveInstead, onMoveInstead }: {
  record: RemoveTarget
  onClose: () => void
  /** Called after the delete went through, with the sentence to show and what the server answered. */
  onRemoved: (message: string, result: PmRemoveResult, record: RemoveTarget) => void
  /** "Archive instead" (the screen closes the dialog). Not offered when the caller cannot archive. */
  onArchiveInstead?: (record: RemoveTarget) => void
  /** "Move to another Product" for a Sub-product that is held (the screen closes the dialog). */
  onMoveInstead?: (record: RemoveTarget) => void
}) {
  const baseId = useId()
  const [read, setRead] = useState<Read>({ phase: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [choice, setChoice] = useState<SubProductsChoice | null>(null)
  const [targetId, setTargetId] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')

  // Read what the delete would do, on opening and again on "Try again" or after a refusal. An answer that arrives after the dialog closed is dropped.
  useEffect(() => {
    let live = true
    productRecordService.removalPreview(record.id)
      .then((response) => { if (live) setRead({ phase: 'ready', preview: response.data }) })
      .catch((cause: unknown) => { if (live) setRead({ phase: 'failed', error: messageOf(cause, 'What deleting this would do could not be read.') }) })
    return () => { live = false }
  }, [record.id, attempt])

  const retry = useCallback(() => { setRead({ phase: 'loading' }); setAttempt((n) => n + 1) }, [])

  const preview = read.phase === 'ready' ? read.preview : null
  const isProduct = record.kind === 'product'
  const mode = preview ? removalMode(preview) : null
  const state = preview ? choiceState(preview) : null
  const heldSubs = preview ? blockedSubProducts(preview) : []

  const confirm = useCallback(async () => {
    if (!preview || busy || !canConfirmRemoval(preview, choice, targetId)) return
    setBusy(true)
    setFailure('')
    try {
      const response = await productRecordService.remove(record.id, removeBodyFor(preview, choice, targetId))
      onRemoved(removedSentence(record.name, response.data, preview.targets), response.data, record)
    } catch (cause) {
      setFailure(messageOf(cause, 'It could not be deleted. Nothing was changed.'))
      // Something holds it now (409): read what, so the sentences are on screen and not only the server's one-line refusal.
      if (cause instanceof ApiError && cause.status === 409) retry()
    } finally {
      setBusy(false)
    }
  }, [preview, busy, choice, targetId, record, onRemoved, retry])

  const sentences = preview ? blockerSentences(ownBlockers(preview)) : []
  if (preview && mode === 'blocked' && sentences.length === 0) sentences.push('Something else still holds it.')
  const canArchive = onArchiveInstead !== undefined
  const canMoveInstead = onMoveInstead !== undefined && !isProduct && preview !== null && preview.targets.length > 0
  const subCount = preview?.subProducts.length ?? 0

  const description = read.phase === 'loading'
    ? 'Checking what depends on it…'
    : read.phase === 'failed'
      ? 'What deleting this would do could not be read, so nothing is offered.'
      : mode === 'blocked'
        ? `${record.name} cannot be deleted yet.`
        : mode === 'ask'
          ? `${record.name} has ${subCount} ${subCount === 1 ? 'sub-product' : 'sub-products'}. Choose what happens to them.`
          : isProduct
            ? `${record.name} will be deleted. This cannot be undone.`
            : `${record.name} will be deleted with its About and its ideal customers. If it is sold in CRM, its entry moves to the Recycle Bin. This cannot be undone.`

  return (
    <Dialog open onOpenChange={(next) => { if (!next && !busy) onClose() }}>
      <DialogContent className="max-w-lg" aria-busy={busy || read.phase === 'loading'}>
        <DialogHeader>
          <DialogTitle>{isProduct ? `Delete product ${record.name}?` : `Delete ${record.name}?`}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3" data-removal-mode={mode ?? read.phase}>
          {read.phase === 'loading' && (
            <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden="true" />Reading what depends on it…</p>
          )}

          {read.phase === 'failed' && (
            <div role="alert" className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm ${NOTICE_TONE.error}`}>
              <span>{read.error}</span>
              <Button type="button" size="sm" variant="outline" onClick={retry}>Try again</Button>
            </div>
          )}

          {preview && mode === 'blocked' && (
            <div className="space-y-2" data-removal-blocked>
              <ul aria-label="What stops it" className="list-disc space-y-1 pl-5 text-sm text-foreground">
                {sentences.map((sentence) => <li key={sentence}>{sentence}</li>)}
              </ul>
              {isProduct && heldSubs.length > 0 && <SubProductList preview={preview} heldOnly />}
              <p className="text-sm text-muted-foreground">
                {canArchive
                  ? 'Archive it instead: nothing is lost, it leaves the pickers and the default list, and you can restore it later.'
                  : 'Nothing was changed. Remove what holds it first, or ask an administrator.'}
              </p>
            </div>
          )}

          {preview && mode === 'ask' && state && (
            <fieldset className="space-y-3" disabled={busy}>
              <legend className="sr-only">What should happen to its sub-products?</legend>
              <SubProductList preview={preview} />
              <label className="flex items-start gap-2 text-sm text-foreground">
                <input
                  type="radio"
                  name={`${baseId}-choice`}
                  className="mt-1"
                  checked={choice === 'move'}
                  disabled={!state.moveAllowed}
                  onChange={() => setChoice('move')}
                />
                <span>
                  Move them to another Product
                  {!state.moveAllowed && <span className="block text-xs text-muted-foreground">There is no other Product to move them to.</span>}
                </span>
              </label>
              {choice === 'move' && (
                <div className="space-y-1.5 pl-6">
                  <label htmlFor={`${baseId}-target`} className="text-sm font-medium text-foreground">Move them to</label>
                  <NativeSelect id={`${baseId}-target`} value={targetId === null ? '' : String(targetId)} onChange={(event) => setTargetId(event.target.value === '' ? null : Number(event.target.value))}>
                    <option value="">Choose a Product…</option>
                    {preview.targets.map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}
                  </NativeSelect>
                </div>
              )}
              <label className="flex items-start gap-2 text-sm text-foreground">
                <input
                  type="radio"
                  name={`${baseId}-choice`}
                  className="mt-1"
                  checked={choice === 'delete'}
                  disabled={!state.deleteAllowed}
                  onChange={() => { setChoice('delete'); setTargetId(null) }}
                />
                <span>
                  Delete them together with it
                  {!state.deleteAllowed && <span className="block text-xs text-muted-foreground">{heldSubs.length > 0 ? 'Some of them are held and cannot be deleted. Move them instead.' : 'It cannot be deleted together with them.'}</span>}
                </span>
              </label>
            </fieldset>
          )}

          {failure !== '' && <p role="alert" className={`rounded-lg border p-3 text-sm ${NOTICE_TONE.error}`}>{failure}</p>}
        </div>

        <DialogFooter className="flex-wrap">
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
          {preview && mode === 'blocked' && canMoveInstead && (
            <Button type="button" variant="outline" onClick={() => onMoveInstead?.(record)}>Move to another Product</Button>
          )}
          {preview && mode === 'blocked' && canArchive && (
            <Button type="button" onClick={() => onArchiveInstead?.(record)}>Archive instead</Button>
          )}
          {preview && mode !== 'blocked' && (
            <Button type="button" variant="destructive" disabled={busy || !canConfirmRemoval(preview, choice, targetId)} onClick={() => void confirm()}>
              {busy && <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden="true" />}
              {busy ? 'Deleting…' : isProduct ? 'Delete product' : 'Delete'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** The Sub-products under the Product, a held one marked with the sentence that holds it. Only the held ones with `heldOnly`. */
function SubProductList({ preview, heldOnly = false }: { preview: PmRemovalPreview; heldOnly?: boolean }) {
  const subs = heldOnly ? blockedSubProducts(preview) : preview.subProducts
  if (subs.length === 0) return null
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-foreground">{heldOnly ? 'Sub-products that are held' : 'Its sub-products'}</p>
      <ul aria-label="Sub-products" className="max-h-48 space-y-1 overflow-y-auto text-sm text-foreground">
        {subs.map((sub) => (
          <li key={sub.id} data-sub-product={sub.id} data-held={sub.canDelete ? undefined : ''}>
            <span className="font-medium">{sub.name}</span>
            {!sub.canDelete && <span className="ml-2 rounded border border-border bg-muted px-1.5 py-0.5 text-xs text-foreground">Held</span>}
            {!sub.canDelete && blockerSentences(sub.blockedBy).map((sentence) => <span key={sentence} className="block text-xs text-muted-foreground">{sentence}</span>)}
          </li>
        ))}
      </ul>
    </div>
  )
}
