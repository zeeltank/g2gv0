'use client'

import { useRef, useState } from 'react'
import { Copy, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useConfirm } from '@/components/shared/scaffolds'
import { NOTICE_TONE } from '@/lib/org-accounts/tones'
import { DEFAULT_SHARE_DAYS, publicShareUrl, SHARE_DAY_CHOICES, shareExpiryText, shareMode } from '@/lib/portfolio/sales-kit-model'
import type { SalesKitApi } from '@/services/product-master/kit-service'
import type { KitItem, KitShareDays } from '@/services/product-master/kit-types'
import { kitErrorText, KitFormAlert, KitSelectField } from './product-sales-kit-parts'

type CopyNote = '' | 'copied' | 'selected'

const COPY_WORDS: Record<Exclude<CopyNote, ''>, string> = {
  copied: 'Link copied',
  selected: 'The link is selected. Copy it from your keyboard, then paste it where you need it.',
}

/**
 * The public link of one entry. A person who is not signed in opens it, so the dialog says so first. A manager makes the link (and chooses how long it works), renews it (the old one stops
 * at once) or stops sharing, each of the last two after being asked. Everybody who may see the entry can copy a live link; a person who may only look is never offered a way to make or stop
 * one. The entry in the dialog is the one the server last answered with, so a new link shows at once.
 */
export function KitShareDialog({ item, canEdit, productId, service, origin, onClose, onChanged }: {
  /** The entry to share; null closes the dialog. */
  item: KitItem | null
  /** The caller may make, renew and stop the link (the kit's edit right). */
  canEdit: boolean
  productId: number
  service: SalesKitApi
  /** The address of this site, for the link a customer opens. Defaults to the one the page is on. */
  origin?: string
  onClose: () => void
  /** Called after a link is made, renewed or stopped, so the shelf can be read again and its card says Shared. */
  onChanged: () => void
}) {
  return (
    <Dialog open={item !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        {item && <ShareBody key={item.id} start={item} canEdit={canEdit} productId={productId} service={service} origin={origin} onChanged={onChanged} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  )
}

function ShareBody({ start, canEdit, productId, service, origin, onChanged, onClose }: {
  start: KitItem
  canEdit: boolean
  productId: number
  service: SalesKitApi
  origin?: string
  onChanged: () => void
  onClose: () => void
}) {
  const { confirm, confirmDialog } = useConfirm()
  const [current, setCurrent] = useState<KitItem>(start)
  const [days, setDays] = useState(String(DEFAULT_SHARE_DAYS))
  const [busy, setBusy] = useState<'make' | 'stop' | null>(null)
  const [failure, setFailure] = useState('')
  const [note, setNote] = useState('')
  const [copied, setCopied] = useState<CopyNote>('')
  const field = useRef<HTMLInputElement>(null)
  const fieldId = 'kit-share-link'

  const share = current.share ?? null
  const mode = shareMode(current, canEdit)
  const live = share !== null && !share.expired
  const url = live && share ? publicShareUrl(origin ?? window.location.origin, share.token) : ''

  const copy = async () => {
    setNote('')
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
        setCopied('copied')
        return
      }
    } catch { /* fall through: the clipboard may be blocked on this page */ }
    field.current?.focus()
    field.current?.select()
    try {
      if (document.execCommand?.('copy')) {
        setCopied('copied')
        return
      }
    } catch { /* the text stays selected for the person to copy */ }
    setCopied('selected')
  }

  const make = async () => {
    // Renewing a link that still works breaks the one a customer may already hold, so it asks first; a link that has run out has nothing left to break.
    const renewing = live
    if (busy) return
    if (renewing && !(await confirm({
      title: `Create a new link for "${current.title}"?`,
      description: 'The link you shared before stops working at once. Anyone who has it will see that it is not available.',
      confirmLabel: 'Create a new link',
    }))) return
    setBusy('make')
    setFailure('')
    setNote('')
    try {
      const response = await service.share(productId, current.id, { days: Number(days) as KitShareDays })
      if (!response.data.share) throw new Error('The link could not be created. Try again in a moment.')
      setCurrent(response.data)
      setCopied('')
      setNote(renewing ? 'New link created. The old one has stopped.' : 'Link created.')
      onChanged()
    } catch (cause) {
      setFailure(kitErrorText(cause, 'The link could not be created. Try again in a moment.'))
    } finally {
      setBusy(null)
    }
  }

  const stop = async () => {
    if (busy) return
    const ok = await confirm({
      title: `Stop sharing "${current.title}"?`,
      description: 'The link stops working at once. Anyone who has it will see that it is not available. You can create a new link later.',
      confirmLabel: 'Stop sharing',
    })
    if (!ok) return
    setBusy('stop')
    setFailure('')
    setNote('')
    try {
      const response = await service.stopSharing(productId, current.id)
      setCurrent(response.data)
      setCopied('')
      setNote('Sharing stopped. The link no longer works.')
      onChanged()
    } catch (cause) {
      setFailure(kitErrorText(cause, 'Sharing could not be stopped. Try again in a moment.'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4">
      <DialogHeader className="mb-0">
        <DialogTitle className="break-words pr-6">Share link</DialogTitle>
        <DialogDescription>{`${current.title}. Anyone with the link can open this without signing in.`}</DialogDescription>
      </DialogHeader>

      {failure && <KitFormAlert text={failure} />}
      {note && <p role="status" className={`rounded-lg border p-3 text-sm ${NOTICE_TONE.success}`}>{note}</p>}

      {live && share && (
        <div className="space-y-2">
          <Label htmlFor={fieldId}>Public link</Label>
          <div className="flex flex-wrap gap-2">
            <Input id={fieldId} ref={field} readOnly value={url} onFocus={(event) => event.currentTarget.select()} className="min-w-0 flex-1" />
            <Button type="button" onClick={() => void copy()}><Copy aria-hidden="true" />Copy link</Button>
          </div>
          <p role="status" aria-live="polite" className="min-h-5 text-sm text-foreground">{copied ? COPY_WORDS[copied] : ''}</p>
          <p className="text-sm text-muted-foreground">{shareExpiryText(share)}</p>
        </div>
      )}

      {share !== null && !live && (
        <p className="text-sm text-foreground">
          {`${shareExpiryText(share)}. The link no longer works.`}
          {mode === 'expired' ? ' Ask a manager to create a new one.' : ' Create a new link to share it again.'}
        </p>
      )}

      {mode === 'none' && <p className="text-sm text-muted-foreground">There is no public link for this yet. A manager can create one.</p>}

      {(mode === 'create' || mode === 'manage') && (
        <div className="space-y-3 border-t border-border pt-4">
          <KitSelectField
            label="Link works for"
            value={days}
            onChange={setDays}
            options={SHARE_DAY_CHOICES.map((choice) => ({ value: String(choice.value), label: choice.label }))}
            disabled={busy !== null}
            hint={[days === '0' ? 'No expiry: the link works until you stop sharing it or create a new one.' : null, mode === 'manage' ? 'The link above stops working as soon as you create a new one.' : null].filter(Boolean).join(' ') || undefined}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={mode === 'create' ? 'default' : 'outline'} disabled={busy !== null} onClick={() => void make()}>
              {busy === 'make' && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
              {mode === 'create' ? 'Create link' : 'Create a new link'}
            </Button>
            {mode === 'manage' && (
              <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void stop()}>
                {busy === 'stop' && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                Stop sharing
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button type="button" variant="outline" onClick={onClose}>Close</Button>
      </div>
      {confirmDialog}
    </div>
  )
}
