'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Loader2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FileTypeIcon } from '@/components/ui/file-icon'
import { entryFormErrors, KIND_WORD, kindChoicesForFile, defaultKindForFile, shareDecision, sizeText, visibilityText } from '@/lib/portfolio/sales-kit-model'
import type { SalesKitApi } from '@/services/product-master/kit-service'
import type { KitKind, KitLibraryHit } from '@/services/product-master/kit-types'
import { kitErrorText, kitFieldErrors, KitFormAlert, KitSelectField, KitTextField } from './product-sales-kit-parts'

const MIN_QUERY = 2
const SEARCH_DELAY_MS = 250

/**
 * Adds a document that is already in the Document Library. The person searches by name (two letters or more), chooses one, and adds it. A document that is not shared with the
 * organisation is added only when its owner agrees to share it, because a colleague who cannot open it would see "no access"; one that belongs to somebody else cannot be added and says
 * who can fix that. Only documents the person may open, and that are not already in this Sales Kit, are listed.
 */
export function KitLibraryDialog({ open, productId, service, onOpenChange, onSaved }: {
  open: boolean
  productId: number
  service: SalesKitApi
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  // A number that goes up every time the dialog opens, so each opening starts from an empty search even while the last one is still fading out.
  const [opened, setOpened] = useState({ key: 0, open })
  if (opened.open !== open) setOpened({ key: open ? opened.key + 1 : opened.key, open })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-2xl">
        <LibraryForm key={opened.key} productId={productId} service={service} onClose={() => onOpenChange(false)} onSaved={onSaved} />
      </DialogContent>
    </Dialog>
  )
}

function LibraryForm({ productId, service, onClose, onSaved }: { productId: number; service: SalesKitApi; onClose: () => void; onSaved: () => void }) {
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<{ q: string; hits: KitLibraryHit[] } | null>(null)
  // What a search is waiting for and what it failed on, each tied to the words it was for, so words that have changed never show the state of the old ones.
  const [pending, setPending] = useState<string | null>(null)
  const [failed, setFailed] = useState<{ q: string; text: string } | null>(null)
  const [chosen, setChosen] = useState<KitLibraryHit | null>(null)
  const [agreed, setAgreed] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', kind: 'document' as KitKind })
  const [attempted, setAttempted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [refused, setRefused] = useState<Record<string, string>>({})
  const [failure, setFailure] = useState('')
  const newest = useRef(0)

  const q = query.trim()
  const long = q.length >= MIN_QUERY

  useEffect(() => {
    if (!long) return
    const mine = ++newest.current
    const timer = setTimeout(() => {
      setPending(q)
      setFailed(null)
      service.searchLibrary(productId, q)
        .then((response) => { if (mine === newest.current) setFound({ q, hits: response.data }) })
        .catch((cause) => { if (mine === newest.current) setFailed({ q, text: kitErrorText(cause, 'The Document Library could not be searched.') }) })
        .finally(() => { if (mine === newest.current) setPending(null) })
    }, SEARCH_DELAY_MS)
    return () => { clearTimeout(timer); newest.current += 1 }
  }, [long, q, productId, service])

  // What is listed is what was found for the words in the box now; shorter words list nothing, whatever an earlier search found.
  const hits = long && found && found.q === q ? found.hits : []
  const searching = long && pending === q
  const searchError = long && failed && failed.q === q ? failed.text : ''
  const choices = chosen ? kindChoicesForFile(chosen.fileName ?? '') : []
  const decision = chosen ? shareDecision(chosen, agreed) : null
  const checks = entryFormErrors({ title: form.title || (chosen?.title ?? ''), description: form.description })

  const choose = (hit: KitLibraryHit) => {
    setChosen(hit)
    setAgreed(false)
    setAttempted(false)
    setRefused({})
    setFailure('')
    setForm({ title: hit.title, description: '', kind: defaultKindForFile(hit.fileName ?? '') })
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setAttempted(true)
    if (!chosen || !decision || !decision.canAdd || Object.keys(checks).length > 0 || saving) return
    setSaving(true)
    setFailure('')
    try {
      await service.fromLibrary(productId, {
        documentId: chosen.id,
        title: form.title.trim(),
        ...(form.description.trim() ? { description: form.description.trim() } : {}),
        ...(choices.length > 1 ? { kind: form.kind } : {}),
        ...(decision.makeShared ? { makeShared: true } : {}),
      })
      onSaved()
      onClose()
    } catch (cause) {
      const fields = kitFieldErrors(cause)
      setRefused(fields)
      setFailure(Object.keys(fields).length > 0 ? '' : kitErrorText(cause, 'The document could not be added.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="flex min-h-0 flex-1 flex-col gap-4">
      <DialogHeader className="mb-0">
        <DialogTitle>From Document Library</DialogTitle>
        <DialogDescription>Search the documents you can open. The file stays in the Document Library; the Sales Kit points at it.</DialogDescription>
      </DialogHeader>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        <KitTextField label="Search by name" value={query} onChange={setQuery} autoFocus placeholder="Type at least two letters" />
        <div aria-live="polite" className="text-sm text-muted-foreground">
          {searchError
            ? <span role="alert" className="text-foreground">{searchError}</span>
            : searching ? <span className="flex items-center gap-2"><Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />Searching</span>
              : !long ? <span className="flex items-center gap-2"><Search className="size-3.5" aria-hidden="true" />Type at least two letters of its name.</span>
                : found && found.q === q && hits.length === 0 ? 'Nothing found. Only documents you can open, and that are not already in this Sales Kit, are listed.' : null}
        </div>
        {hits.length > 0 && (
          <fieldset className="space-y-2">
            <legend className="sr-only">Documents in the Document Library</legend>
            {hits.map((hit) => <HitRow key={hit.id} hit={hit} checked={chosen?.id === hit.id} onChoose={() => choose(hit)} />)}
          </fieldset>
        )}
        {chosen && decision && (
          <div className="space-y-4 border-t border-border pt-4">
            {decision.note && <p className="text-sm text-foreground">{decision.note}</p>}
            {decision.needsAgreement && (
              <label className="flex items-start gap-2 text-sm text-foreground">
                <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} className="mt-0.5 size-4 shrink-0" />
                Share it with everyone in my organisation
              </label>
            )}
            {failure && <KitFormAlert text={failure} />}
            <KitTextField label="Title" value={form.title} onChange={(title) => setForm((c) => ({ ...c, title }))} error={(attempted ? checks.title : undefined) ?? refused.title} required />
            {choices.length > 1 && <KitSelectField label="Kind" value={form.kind} onChange={(kind) => setForm((c) => ({ ...c, kind: kind as KitKind }))} options={choices.map((kind) => ({ value: kind, label: KIND_WORD[kind] }))} />}
            <KitTextField label="What it is for" value={form.description} onChange={(description) => setForm((c) => ({ ...c, description }))} error={(attempted ? checks.description : undefined) ?? refused.description} multiline rows={2} hint="Optional. One line a salesperson reads before opening it." />
          </div>
        )}
      </div>
      <DialogFooter className="mt-0">
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button type="submit" disabled={saving || !chosen || !decision?.canAdd}>{saving && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}Add to Sales Kit</Button>
      </DialogFooter>
    </form>
  )
}

function HitRow({ hit, checked, onChoose }: { hit: KitLibraryHit; checked: boolean; onChoose: () => void }) {
  const size = sizeText(hit.size)

  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card p-3 has-[:checked]:border-primary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
      <input type="radio" name="kit-library-document" checked={checked} onChange={onChoose} className="size-4 shrink-0" />
      <span className="size-9 shrink-0" aria-hidden="true"><FileTypeIcon mimeType={hit.mimeType} fileName={hit.fileName} className="h-full w-full" /></span>
      <span className="min-w-0 flex-1">
        <span className="block break-words text-sm font-medium text-foreground">{hit.title}</span>
        <span className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
          {hit.fileName && <span>{hit.fileName}</span>}
          {size && <span>{size}</span>}
          <span>{visibilityText(hit)}</span>
        </span>
      </span>
    </label>
  )
}
