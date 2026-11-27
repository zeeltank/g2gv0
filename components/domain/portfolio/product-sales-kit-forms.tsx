'use client'

import { useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { entryFormErrors, KIND_WORD, KIT_KINDS, kindChoicesForFile, linkHref, LINK_RULE, type EntryFormErrors } from '@/lib/portfolio/sales-kit-model'
import type { SalesKitApi } from '@/services/product-master/kit-service'
import type { KitItem, KitKind, KitUpdateBody } from '@/services/product-master/kit-types'
import { kitErrorText, kitFieldErrors, KitFormAlert, KitSelectField, KitTextField } from './product-sales-kit-parts'

const KIND_OPTIONS = (kinds: readonly KitKind[]) => kinds.map((kind) => ({ value: kind, label: KIND_WORD[kind] }))

/** A refused save, split into the sentence for each box and the one for the whole form. */
function refusal(cause: unknown, fallback: string): { fields: Record<string, string>; failure: string } {
  const fields = kitFieldErrors(cause)
  return { fields, failure: Object.keys(fields).length > 0 ? '' : kitErrorText(cause, fallback) }
}

/**
 * Adds an address to the Sales Kit: the web deck, a video on the web, a page. The address is an `https://` one, or a path inside this app (the interactive deck lives at one). The
 * form checks what the server checks and says so under the box; whatever the server still refuses is shown under the box it names, or at the top.
 */
export function KitLinkDialog({ open, productId, service, onOpenChange, onSaved }: {
  open: boolean
  productId: number
  service: SalesKitApi
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  // A number that goes up every time the dialog opens, so each opening starts from empty boxes even while the last one is still fading out.
  const [opened, setOpened] = useState({ key: 0, open })
  if (opened.open !== open) setOpened({ key: open ? opened.key + 1 : opened.key, open })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <LinkForm key={opened.key} productId={productId} service={service} onClose={() => onOpenChange(false)} onSaved={onSaved} />
      </DialogContent>
    </Dialog>
  )
}

function LinkForm({ productId, service, onClose, onSaved }: { productId: number; service: SalesKitApi; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ title: '', url: '', kind: 'presentation' as KitKind, description: '' })
  const [attempted, setAttempted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [refused, setRefused] = useState<Record<string, string>>({})
  const [failure, setFailure] = useState('')

  const set = <K extends keyof typeof form>(key: K) => (value: (typeof form)[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
    setRefused((current) => { const { [key]: _gone, ...rest } = current; return rest })
  }
  const checks = entryFormErrors({ title: form.title, url: form.url, description: form.description })
  const shown = (key: keyof EntryFormErrors) => (attempted ? checks[key] : undefined) ?? refused[key]

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setAttempted(true)
    if (Object.keys(checks).length > 0 || saving) return
    setSaving(true)
    setFailure('')
    try {
      await service.addLink(productId, { title: form.title.trim(), url: form.url.trim(), kind: form.kind, ...(form.description.trim() ? { description: form.description.trim() } : {}) })
      onSaved()
      onClose()
    } catch (cause) {
      const out = refusal(cause, 'The link could not be added.')
      setRefused(out.fields)
      setFailure(out.failure)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="space-y-4">
      <DialogHeader>
        <DialogTitle>Add link</DialogTitle>
        <DialogDescription>For the interactive deck, a video on the web or a page a salesperson should open. It opens in a new tab.</DialogDescription>
      </DialogHeader>
      {failure && <KitFormAlert text={failure} />}
      <KitTextField label="Title" value={form.title} onChange={set('title')} error={shown('title')} required autoFocus />
      <KitTextField label="Link" value={form.url} onChange={set('url')} error={shown('url')} required hint="An https:// address, or a path such as /signals/portfolio/deck/scholarclone." />
      <KitSelectField label="Kind" value={form.kind} onChange={(kind) => set('kind')(kind as KitKind)} options={KIND_OPTIONS(KIT_KINDS)} hint="Where it is filed on the shelf." />
      <KitTextField label="What it is for" value={form.description} onChange={set('description')} error={shown('description')} multiline rows={2} hint="Optional. One line a salesperson reads before opening it." />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button type="submit" disabled={saving}>{saving && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}Add link</Button>
      </DialogFooter>
    </form>
  )
}

/**
 * Changes what a person reads about an entry: its title, what it is for, where it is filed and, for a link, its address. Only what was changed is sent, so saving never writes over
 * what somebody else changed meanwhile with the old text this form was opened on. The kind of a file is a choice only for a PDF or a PowerPoint.
 */
export function KitEditDialog({ item, productId, service, onClose, onSaved }: {
  /** The entry being edited; null closes the dialog. */
  item: KitItem | null
  productId: number
  service: SalesKitApi
  onClose: () => void
  onSaved: () => void
}) {
  return (
    <Dialog open={item !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        {item && <EditForm key={item.id} item={item} productId={productId} service={service} onClose={onClose} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  )
}

function EditForm({ item, productId, service, onClose, onSaved }: { item: KitItem; productId: number; service: SalesKitApi; onClose: () => void; onSaved: () => void }) {
  const isLink = item.source === 'link'
  const [form, setForm] = useState({ title: item.title, description: item.description ?? '', kind: item.kind, url: item.url ?? '' })
  const [attempted, setAttempted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [refused, setRefused] = useState<Record<string, string>>({})
  const [failure, setFailure] = useState('')

  const set = <K extends keyof typeof form>(key: K) => (value: (typeof form)[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
    setRefused((current) => { const { [key]: _gone, ...rest } = current; return rest })
  }
  const choices = kindChoicesForFile(item.fileName ?? '')
  // A file whose kind is not one its type allows (an older row) still shows its own kind, so the box never says something else than what is stored.
  const kinds: readonly KitKind[] = isLink ? KIT_KINDS : choices.includes(item.kind) ? choices : [item.kind, ...choices]
  const checks = entryFormErrors({ title: form.title, description: form.description, ...(isLink ? { url: form.url } : {}) })
  const shown = (key: keyof EntryFormErrors) => (attempted ? checks[key] : undefined) ?? refused[key]

  const changes: KitUpdateBody = {}
  if (form.title.trim() !== item.title) changes.title = form.title.trim()
  if (form.description.trim() !== (item.description ?? '')) changes.description = form.description.trim() === '' ? null : form.description.trim()
  if (form.kind !== item.kind) changes.kind = form.kind
  if (isLink && form.url.trim() !== (item.url ?? '') && linkHref(form.url) !== null) changes.url = form.url.trim()
  const unchanged = Object.keys(changes).length === 0

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setAttempted(true)
    if (Object.keys(checks).length > 0 || unchanged || saving) return
    setSaving(true)
    setFailure('')
    try {
      await service.update(productId, item.id, changes)
      onSaved()
      onClose()
    } catch (cause) {
      const out = refusal(cause, 'The changes could not be saved.')
      setRefused(out.fields)
      setFailure(out.failure)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="space-y-4">
      <DialogHeader>
        <DialogTitle>Edit details</DialogTitle>
        <DialogDescription>{`${isLink ? 'A link to a web page.' : (item.fileName ?? 'A file in the Document Library.')} The file itself is not changed here.`}</DialogDescription>
      </DialogHeader>
      {failure && <KitFormAlert text={failure} />}
      <KitTextField label="Title" value={form.title} onChange={set('title')} error={shown('title')} required autoFocus />
      {isLink && <KitTextField label="Link" value={form.url} onChange={set('url')} error={shown('url')} required hint={LINK_RULE} />}
      <KitSelectField label="Kind" value={form.kind} onChange={(kind) => set('kind')(kind as KitKind)} options={KIND_OPTIONS(kinds)} disabled={kinds.length < 2} hint={kinds.length < 2 ? 'Its file type decides this.' : 'Where it is filed on the shelf.'} />
      <KitTextField label="What it is for" value={form.description} onChange={set('description')} error={shown('description')} multiline rows={2} hint="Optional. One line a salesperson reads before opening it." />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button type="submit" disabled={saving || unchanged}>{saving && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}Save</Button>
      </DialogFooter>
    </form>
  )
}
