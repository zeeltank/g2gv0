'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { apiErrorText } from '@/lib/api-messages'
import type { LaravelContext } from '@/lib/laravel-context'
import { addCustom, customEntries, emptyProductForm, fromOffer, nextProductId, removeEntry, serverErrors, toggle, toPayload, validateProductForm, type ProductFormErrors, type ProductFormState } from '@/lib/product-form'
import { ApiError } from '@/services/core'
import { portfolioService } from '@/services/portfolio/portfolio-service'
import type { ProductInfo, ProductOffer, TaxonomyData } from '@/services/portfolio/types'
import type { FormState } from '@/lib/icp-form'
import { buildIcpConfig, emptyIcpForm, emptyIcpLines, icpTouched, slugKey, type IcpLines } from '@/lib/product-icp-draft'
import { productIcpService } from '@/services/signals/product-icp'
import { ProductIcpSection } from './product-icp-section'

const selectCls = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

function Field({ id, label, hint, error, required, children }: { id: string; label: string; hint?: string; error?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs font-medium text-foreground">{label}{required && <span className="text-destructive"> *</span>}</label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

interface PickOption { code: string; label: string; detail?: string; title?: string }

/**
 * A tickable list with an "Other" box: the person can tick from the list or type their own entry, which is kept with the ticked ones. Entries from an
 * older list (`legacy`) that the product already carries stay visible and removable. All lists share one layout, so their columns line up.
 */
function PickList({ legend, hint, options, legacy = {}, value, onChange, disabled, otherLabel }: {
  legend: string; hint: string; options: PickOption[]; legacy?: Record<string, string>; value: string[]; onChange: (next: string[]) => void; disabled: boolean; otherLabel: string
}) {
  const [draft, setDraft] = useState('')
  const known = options.map((o) => o.code)
  const older = value.filter((v) => !known.includes(v) && v in legacy)
  const own = customEntries(value, [...known, ...Object.keys(legacy)])
  const add = () => { onChange(addCustom(value, draft)); setDraft('') }

  return (
    <fieldset className="flex min-w-0 flex-col gap-1.5">
      <legend className="mb-0.5 text-xs font-medium text-foreground">{legend}</legend>
      <p className="min-h-8 text-xs text-muted-foreground">{hint}</p>
      <div className="h-56 space-y-1 overflow-y-auto rounded-md border border-input bg-background p-2">
        {options.map((o) => (
          <label key={o.code} title={o.title} className="flex cursor-pointer items-start gap-2 rounded px-1 py-0.5 text-sm text-foreground hover:bg-muted/50">
            <input type="checkbox" className="mt-1" checked={value.includes(o.code)} disabled={disabled} onChange={() => onChange(toggle(value, o.code))} />
            <span className="min-w-0 break-words">
              {o.label}
              {o.detail && <span className="block text-xs text-muted-foreground">{o.detail}</span>}
            </span>
          </label>
        ))}
        {options.length === 0 && <p className="text-xs text-muted-foreground">No options are available. Use Other to add your own.</p>}
      </div>

      <div className="flex items-center gap-2">
        <Input
          aria-label={otherLabel}
          placeholder={otherLabel}
          value={draft}
          disabled={disabled}
          maxLength={160}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
        />
        <Button type="button" size="sm" variant="outline" disabled={disabled || draft.trim() === ''} onClick={add}><Plus className="mr-1 size-3.5" /> Add</Button>
      </div>

      {(own.length > 0 || older.length > 0) && (
        <ul aria-label={`${legend}: your own and older entries`} className="flex flex-wrap gap-1.5">
          {own.map((e) => (
            <li key={e} className="flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-0.5 text-xs">
              <span className="min-w-0 break-words">{e}</span>
              {!disabled && <button type="button" aria-label={`Remove ${e}`} className="rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => onChange(removeEntry(value, e))}><X className="size-3" /></button>}
            </li>
          ))}
          {older.map((e) => (
            <li key={e} className="flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs text-muted-foreground" title="An older code this product already carries">
              <span className="min-w-0 break-words">{legacy[e]} <span className="opacity-70">(older)</span></span>
              {!disabled && <button type="button" aria-label={`Remove ${legacy[e]}`} className="rounded-full hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => onChange(removeEntry(value, e))}><X className="size-3" /></button>}
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  )
}

/**
 * Create or edit one product in the Product Portfolio, as ONE form in two clearly separate parts:
 *   1. Product details: what the product is and offers (the 15 fields the portfolio has always had).
 *   2. Individual Ideal Customer Profile: which customers suit THIS product. Saved to this product's own ICP through the ICP API, never to a
 *      group's or another product's ICP, and saved as a DRAFT: it is only activated from the product's ICP page, by an explicit action.
 * The tenant comes from the sign-in; the Offer ID cannot change once a product exists; the server's validation is shown next to the field it
 * concerns; success is shown only after the server confirms. Nothing is filled in on the person's behalf.
 */
export function ProductFormDialog({
  context, taxonomy, product, open, onClose, onSaved, products = null,
}: {
  context: LaravelContext
  taxonomy: TaxonomyData | null
  /** The product being edited, or null to add a new one. */
  product: ProductOffer | null
  open: boolean
  onClose: () => void
  onSaved: (saved: ProductOffer, created: boolean) => void
  /** The organisation's products, to find the own ICP an existing product already has. */
  products?: ProductInfo[] | null
}) {
  const mode = product ? 'edit' : 'create'
  const [form, setForm] = useState<ProductFormState>(emptyProductForm)
  const [errors, setErrors] = useState<ProductFormErrors>({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  // Add mode: the person typed their own ID, so choosing another category no longer replaces it.
  const [idEdited, setIdEdited] = useState(false)
  const [icp, setIcp] = useState<FormState>(emptyIcpForm)
  const [icpLines, setIcpLines] = useState<IcpLines>(emptyIcpLines)
  const [icpProblems, setIcpProblems] = useState<string[]>([])
  // The product was saved but its ICP was not: the person is told exactly that and can close.
  const [partial, setPartial] = useState<{ saved: ProductOffer; created: boolean; text: string } | null>(null)

  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(product ? fromOffer(product) : emptyProductForm()); setErrors({}); setMessage(''); setBusy(false); setIdEdited(false)
    setIcp(emptyIcpForm()); setIcpLines(emptyIcpLines()); setIcpProblems([]); setPartial(null)
  }, [open, product])

  const set = (patch: Partial<ProductFormState>) => setForm((f) => ({ ...f, ...patch }))

  // Choosing a category suggests the next ID for it, read from the products already saved. A typed ID is left alone; a failed read leaves the ID empty to type.
  async function chooseCategory(category: string) {
    set({ parent_product: category })
    if (mode !== 'create' || idEdited) return
    if (category === '') { set({ offer_id: '' }); return }
    try {
      const ids: string[] = []
      for (let page = 1; page <= 10; page++) {
        const res = await portfolioService.getOffers(context, { parent_product: category, per_page: 100, page })
        ids.push(...res.data.data.map((o) => o.offer_id))
        if (page >= res.data.last_page) break
      }
      setForm((f) => (f.parent_product === category && !idEdited ? { ...f, offer_id: nextProductId(category, ids) } : f))
    } catch {
      setForm((f) => (f.parent_product === category && !idEdited ? { ...f, offer_id: '' } : f))
    }
  }
  // An existing product that already has its own ICP (a product of its own whose ICP lists it) is edited on its ICP page, not here.
  const linked = product ? (products ?? []).find((p) => p.custom && p.icp?.offer_ids?.includes(product.offer_id)) ?? null : null
  const wantsIcp = !linked && icpTouched(icp, icpLines)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    const found = validateProductForm(form, mode)
    setErrors(found)
    if (Object.keys(found).length > 0) {
      setMessage('Fix the highlighted fields.')
      return
    }
    if (wantsIcp && icp.label.trim() === '') {
      setIcpProblems(['ICP name: give the ICP a name, or clear the ICP section.'])
      setMessage('Fix the Individual ICP section.')
      return
    }
    setBusy(true)
    setMessage('')
    setIcpProblems([])
    let saved: ProductOffer
    try {
      const body = toPayload(form, mode)
      const res = product ? await portfolioService.updateOffer(context, product.id, body as Partial<ProductOffer>) : await portfolioService.createOffer(context, body as Partial<ProductOffer>)
      saved = res.data
    } catch (err) {
      setErrors(serverErrors(err instanceof ApiError ? err.errors : undefined))
      setMessage(apiErrorText(err, 'Could not save the product.'))
      setBusy(false)
      return
    }

    // The ICP is a separate record on the server. The product is already saved; if the ICP cannot be, say exactly that (never "saved").
    if (wantsIcp) {
      const key = slugKey(saved.offer_id)
      try {
        await productIcpService.createProduct(context, { key, label: saved.name })
        const config = buildIcpConfig(icp, icpLines, { offer_id: saved.offer_id, name: saved.name, what_it_does: saved.what_it_does })
        await productIcpService.save(context, key, { config, name: icp.label.trim(), note: 'Created with the product', activate: false })
      } catch (err) {
        const problems = err instanceof ApiError && err.errors ? Object.values(err.errors).flat().map(String) : []
        setIcpProblems(problems)
        setPartial({ saved, created: !product, text: `The product was saved, but its ICP was not: ${apiErrorText(err, 'the ICP could not be saved')}. The ICP is not active and nothing was changed on any other product. You can create it from the product's page.` })
        setBusy(false)
        return
      }
    }
    setBusy(false)
    onSaved(saved, !product)
  }

  // The lists the person ticks from. Buying events are the ten signal families, each with what it covers.
  const segmentOptions = useMemo<PickOption[]>(() => Object.entries(taxonomy?.segments ?? {}).map(([code, label]) => ({ code, label })), [taxonomy])
  const eventOptions = useMemo<PickOption[]>(
    () => Object.entries(taxonomy?.signal_families ?? {}).map(([code, f]) => ({ code, label: f.label, detail: f.examples, title: f.relevance })),
    [taxonomy],
  )
  const categories = taxonomy?.parent_products ?? {}
  const statuses = taxonomy?.readiness_statuses ?? {}
  const deployments = taxonomy?.deployment_models ?? {}

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !busy) { if (partial) onSaved(partial.saved, partial.created); else onClose() } }}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? `Edit ${product.name}` : 'Add a product'}</DialogTitle>
          <DialogDescription>
            {product ? 'Changes are saved to your Product Portfolio.' : 'The product is saved to your own Product Portfolio and can then be chosen in an ICP.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void submit(e)} className="space-y-4" aria-busy={busy}>
          <h3 className="text-sm font-semibold text-foreground">Product details</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="pf-category" label="Category" required error={errors.parent_product}>
              <select id="pf-category" className={selectCls} value={form.parent_product} disabled={busy} onChange={(e) => void chooseCategory(e.target.value)}>
                <option value="">Choose a category</option>
                {form.parent_product && !(form.parent_product in categories) && <option value={form.parent_product}>{form.parent_product}</option>}
                {Object.entries(categories).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
              </select>
            </Field>
            <Field id="pf-status" label="Status" required error={errors.readiness_status}>
              <select id="pf-status" className={selectCls} value={form.readiness_status} disabled={busy} onChange={(e) => set({ readiness_status: e.target.value })}>
                <option value="">Choose a status</option>
                {form.readiness_status && !(form.readiness_status in statuses) && <option value={form.readiness_status}>{form.readiness_status}</option>}
                {Object.entries(statuses).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
              </select>
            </Field>
            <Field id="pf-id" label="Product ID" required error={errors.offer_id} hint={mode === 'edit' ? 'The ID cannot be changed.' : 'Filled in from the category (the next number). You can change it.'}>
              <Input id="pf-id" value={form.offer_id} disabled={busy || mode === 'edit'} onChange={(e) => { setIdEdited(e.target.value.trim() !== ''); set({ offer_id: e.target.value }) }} maxLength={50} />
            </Field>
            <Field id="pf-name" label="Name" required error={errors.name}>
              <Input id="pf-name" value={form.name} disabled={busy} onChange={(e) => set({ name: e.target.value })} maxLength={191} />
            </Field>
          </div>

          <Field id="pf-what" label="Description" error={errors.what_it_does} hint="What the product does, in plain words. The ICP comparison reads this.">
            <Textarea id="pf-what" rows={3} value={form.what_it_does} disabled={busy} onChange={(e) => set({ what_it_does: e.target.value })} />
          </Field>
          <Field id="pf-modules" label="Features and capabilities" error={errors.modules_components} hint="Modules or capabilities it includes. The ICP comparison reads this too.">
            <Textarea id="pf-modules" rows={2} value={form.modules_components} disabled={busy} onChange={(e) => set({ modules_components: e.target.value })} />
          </Field>

          <Field id="pf-problems" label="Customer problems solved" error={errors.problems} hint="Describe the problems this product solves, in your own words, one per line. The ICP comparison and signal matching read this.">
            <Textarea id="pf-problems" rows={4} value={form.problems} disabled={busy} onChange={(e) => set({ problems: e.target.value })} placeholder={'For example:\nFee collection is slow during admissions\nParents cannot see attendance'} />
          </Field>
          {form.legacy_needs.length > 0 && (
            <ul aria-label="Older problem codes this product carries" className="flex flex-wrap items-center gap-1.5 text-xs">
              <li className="text-muted-foreground">Older problem codes:</li>
              {form.legacy_needs.map((c) => (
                <li key={c} className="flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-0.5 text-muted-foreground">
                  <span>{taxonomy?.needs?.[c] ?? c}</span>
                  <button type="button" disabled={busy} aria-label={`Remove ${taxonomy?.needs?.[c] ?? c}`} className="rounded-full hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => set({ legacy_needs: form.legacy_needs.filter((x) => x !== c) })}><X className="size-3" /></button>
                </li>
              ))}
            </ul>
          )}

          <div className="grid items-start gap-4 md:grid-cols-2">
            <PickList
              legend="Target customers"
              hint="Who it is sold to. Tick from the list, or add your own under Other."
              options={segmentOptions}
              value={form.primary_segments}
              disabled={busy}
              onChange={(v) => set({ primary_segments: v })}
              otherLabel="Other target customer, then Add"
            />
            <PickList
              legend="Buying events it responds to"
              hint="The kinds of event that show a customer needs this product. Tick from the list, or add your own under Other."
              options={eventOptions}
              legacy={taxonomy?.signals ?? {}}
              value={form.trigger_signals}
              disabled={busy}
              onChange={(v) => set({ trigger_signals: v })}
              otherLabel="Other buying event, then Add"
            />
          </div>

          <Field id="pf-proof" label="Benefits and proof" error={errors.proof_points} hint="Results, references or evidence you can stand behind.">
            <Textarea id="pf-proof" rows={2} value={form.proof_points} disabled={busy} onChange={(e) => set({ proof_points: e.target.value })} />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="pf-pricing" label="Pricing model" error={errors.pricing_model} hint="Leave blank if there is no price yet. None is invented.">
              <Input id="pf-pricing" value={form.pricing_model} disabled={busy} onChange={(e) => set({ pricing_model: e.target.value })} maxLength={191} />
            </Field>
            <Field id="pf-band" label="Typical deal size" error={errors.typical_deal_band}>
              <Input id="pf-band" value={form.typical_deal_band} disabled={busy} onChange={(e) => set({ typical_deal_band: e.target.value })} maxLength={50} />
            </Field>
            <Field id="pf-deploy" label="Deployment" error={errors.deployment_model}>
              <select id="pf-deploy" className={selectCls} value={form.deployment_model} disabled={busy} onChange={(e) => set({ deployment_model: e.target.value })}>
                <option value="">Not set</option>
                {form.deployment_model && !(form.deployment_model in deployments) && <option value={form.deployment_model}>{form.deployment_model}</option>}
                {Object.entries(deployments).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
              </select>
            </Field>
            <Field id="pf-owner" label="Delivery owner" error={errors.delivery_owner}>
              <Input id="pf-owner" value={form.delivery_owner} disabled={busy} onChange={(e) => set({ delivery_owner: e.target.value })} maxLength={100} />
            </Field>
          </div>
          <Field id="pf-notes" label="Notes" error={errors.notes}>
            <Textarea id="pf-notes" rows={2} value={form.notes} disabled={busy} onChange={(e) => set({ notes: e.target.value })} />
          </Field>

          <ProductIcpSection
            form={icp}
            lines={icpLines}
            onForm={(patch) => setIcp((f) => ({ ...f, ...patch }))}
            onLines={(patch) => setIcpLines((l) => ({ ...l, ...patch }))}
            disabled={busy}
            problems={icpProblems}
            linked={linked ? { key: linked.key, label: linked.label } : null}
            editing={mode === 'edit'}
          />

          {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
          {partial && <p role="alert" className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">{partial.text}</p>}
          <div className="flex justify-end gap-2 border-t border-border/60 pt-3">
            {partial ? (
              <Button type="button" onClick={() => onSaved(partial.saved, partial.created)}>Close</Button>
            ) : (
              <>
                <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
                <Button type="submit" disabled={busy}>{busy && <Loader2 className="mr-2 size-4 animate-spin" />}{product ? 'Save changes' : 'Add product'}</Button>
              </>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
