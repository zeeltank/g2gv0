'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { LaravelContext } from '@/lib/laravel-context'
import { ApiError } from '@/services/core'
import { opportunitiesService, type ManualOpportunityResponse } from '@/services/signals/opportunities'
import { emptyManualForm, toManualPayload, validateManual, type ManualForm } from '@/lib/manual-opportunity'
import { sourcePlatform } from '@/lib/source-link'

const CUSTOMER_LABEL = { b2b: 'B2B', b2c: 'B2C', b2g: 'B2G' } as const

/**
 * Add an opportunity you found yourself (a post on any platform, an article, a company page) to the product, sub-product and customer type the screen is on. No research
 * runs and no search credits are used. It is saved with the time it is saved at (decided by the server) and listed under that day; the date of the
 * post is optional and is kept only as the source's publication date.
 */
export function ManualOpportunityDialog({
  context, open, onClose, onSaved, productKey, productLabel, offerId, offerLabel, customerModel, today,
}: {
  context: LaravelContext
  open: boolean
  onClose: () => void
  onSaved: (res: ManualOpportunityResponse) => void
  productKey: string
  productLabel: string
  offerId: string | null
  offerLabel: string | null
  customerModel: 'b2b' | 'b2c' | 'b2g'
  /** Today in the signals timezone (YYYY-MM-DD): the latest date a post can have been published on. */
  today: string | null
}) {
  const [form, setForm] = useState<ManualForm>(emptyManualForm)
  const [errors, setErrors] = useState<Partial<Record<keyof ManualForm, string>>>({})
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (patch: Partial<ManualForm>) => setForm((f) => ({ ...f, ...patch }))
  // Any website or platform is accepted; a known one is named under the field (nothing is fetched or opened).
  const platform = sourcePlatform(form.source_url)
  const close = () => {
    if (busy) return
    setForm(emptyManualForm()); setErrors({}); setProblem(null)
    onClose()
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    const found = validateManual(form, today)
    setErrors(found)
    setProblem(null)
    if (Object.keys(found).length > 0) return
    setBusy(true)
    try {
      const res = await opportunitiesService.createManual(context, toManualPayload(form, { productKey, offerId, customerModel }))
      setForm(emptyManualForm()); setErrors({})
      onSaved(res)
    } catch (cause) {
      // The server's own words (a duplicate, a refused field), shown here with the form kept so nothing typed is lost.
      setProblem(cause instanceof ApiError || cause instanceof Error ? cause.message : 'Could not save the opportunity.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close() }}>
      <DialogContent className="sm:max-w-[560px]">
        <form onSubmit={submit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle>Add Opportunity Manually</DialogTitle>
            <DialogDescription>
              Saved for {productLabel}{offerLabel ? ` · ${offerLabel}` : ''} · {CUSTOMER_LABEL[customerModel]}. It is listed under today&apos;s date (the day you save it), whatever date the post has.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="mo-company" required>Company</Label>
            <Input id="mo-company" value={form.company_name} maxLength={191} aria-invalid={Boolean(errors.company_name)} onChange={(e) => set({ company_name: e.target.value })} />
            {errors.company_name && <p className="text-xs text-destructive">{errors.company_name}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mo-summary" required>What happened, and why it is an opportunity</Label>
            <Textarea id="mo-summary" value={form.summary} maxLength={600} aria-invalid={Boolean(errors.summary)} onChange={(e) => set({ summary: e.target.value })} />
            {errors.summary && <p className="text-xs text-destructive">{errors.summary}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mo-url" required>Link to the post or page</Label>
            <Input id="mo-url" type="url" inputMode="url" placeholder="https://…" value={form.source_url} maxLength={500} aria-invalid={Boolean(errors.source_url)} onChange={(e) => set({ source_url: e.target.value })} />
            {errors.source_url ? <p className="text-xs text-destructive">{errors.source_url}</p>
              : platform && <p className="text-xs text-muted-foreground">Source: {platform}</p>}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="mo-published">Post published on (optional)</Label>
              <Input id="mo-published" type="date" max={today ?? undefined} value={form.source_published_at} aria-invalid={Boolean(errors.source_published_at)} onChange={(e) => set({ source_published_at: e.target.value })} />
              {errors.source_published_at && <p className="text-xs text-destructive">{errors.source_published_at}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mo-title">Title of the post (optional)</Label>
              <Input id="mo-title" value={form.source_title} maxLength={191} onChange={(e) => set({ source_title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mo-contact">Contact and role (optional)</Label>
              <Input id="mo-contact" value={form.contact} maxLength={191} onChange={(e) => set({ contact: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mo-location">Location (optional)</Label>
              <Input id="mo-location" value={form.location} maxLength={191} onChange={(e) => set({ location: e.target.value })} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mo-website">Company website (optional)</Label>
            <Input id="mo-website" type="url" inputMode="url" value={form.website} maxLength={500} aria-invalid={Boolean(errors.website)} onChange={(e) => set({ website: e.target.value })} />
            {errors.website && <p className="text-xs text-destructive">{errors.website}</p>}
          </div>

          {problem && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{problem}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
              {busy ? 'Saving…' : 'Save opportunity'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
