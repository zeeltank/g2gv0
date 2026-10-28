'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, Loader2, Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import type { LaravelContext } from '@/lib/laravel-context'
import { ApiError } from '@/services/core'
import { CUSTOMER_MODELS, fromConfig, rid, toConfig, type CustomerModel, type FormState, type Row } from '@/lib/icp-form'
import { productIcpService, type IcpEditorState } from '@/services/signals/product-icp'
import { IcpProductPicker } from './icp-product-picker'
import { IcpComparison } from './icp-comparison'

/*
 * The Ideal Customer Profile of ONE product. It edits the product's own ICP only (the product is the address), starts empty when the
 * product has none (nothing is copied from another product), and saving never starts research. The server validates and is the authority:
 * the form checks with it before saving, and an ICP that is not ready cannot be activated.
 */

const errText = (e: unknown, fallback: string) => (e instanceof ApiError || e instanceof Error ? e.message : fallback)

const SOURCE_LABEL: Record<string, string> = {
  news: 'News', job: 'Job posts', tender: 'Tenders', leadership: 'Leadership change', regulation: 'Regulation', social: 'Social / LinkedIn', concept: 'Concept', other: 'Other',
}

const OP_LABEL: Record<string, string> = {
  '>=': 'at least', '<=': 'at most', '>': 'more than', '<': 'less than', between: 'between (low, high)', in: 'is one of', not_in: 'is none of', '=': 'equals', '!=': 'does not equal', in_regions: 'is inside the target regions',
}

const selectCls = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-foreground">{label}{required && <span className="text-destructive"> *</span>}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  )
}

function Section({ title, hint, problems, children, action }: { title: string; hint?: string; problems?: string[]; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <fieldset className="space-y-3 rounded-lg border border-border/60 p-4">
      <legend className="px-1 text-sm font-semibold text-foreground">{title}</legend>
      <div className="flex flex-wrap items-start justify-between gap-2">
        {hint && <p className="max-w-prose text-xs text-muted-foreground">{hint}</p>}
        {action}
      </div>
      {problems && problems.length > 0 && (
        <ul role="alert" className="list-disc space-y-0.5 pl-5 text-xs text-destructive">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
      )}
      {children}
    </fieldset>
  )
}

/**
 * One collapsible part of the ICP. Closed content stays in the page (hidden, not removed), so a collapsed section keeps every value and is still
 * saved with the rest. A section with problems is shown open so nothing the server rejected is hidden.
 */
function Group({ id, title, summary, problems, open, onToggle, children }: { id: string; title: string; summary: string; problems: number; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  const shown = open || problems > 0
  return (
    <section id={`icp-${id}`} aria-label={title} className="rounded-xl border border-border/60">
      <button
        type="button"
        aria-expanded={shown}
        aria-controls={`icp-${id}-body`}
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-foreground">{title}</span>
          <span className="block truncate text-xs text-muted-foreground">{summary}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {problems > 0 && <Badge variant="destructive">{problems} to fix</Badge>}
          <ChevronDown className={`size-4 text-muted-foreground transition-transform ${shown ? 'rotate-180' : ''}`} aria-hidden />
        </span>
      </button>
      <div id={`icp-${id}-body`} hidden={!shown} className="space-y-4 border-t border-border/60 p-4">{children}</div>
    </section>
  )
}

export function ProductIcpEditor({
  context, productKey, canEdit, onChanged, onDirtyChange, onCreateProduct, catalogVersion = 0,
}: {
  context: LaravelContext
  productKey: string
  canEdit: boolean
  /** Opens the Product Portfolio's "Add product" form, so a new product can be created and then chosen here. */
  onCreateProduct?: () => void
  /** Changes when the portfolio changes, so the picker and the comparison read it again. */
  catalogVersion?: number
  /** Called after the ICP was saved or its status changed, so the product's readiness can be re-read. */
  onChanged: () => void
  onDirtyChange?: (dirty: boolean) => void
}) {
  const [state, setState] = useState<IcpEditorState | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [saved, setSaved] = useState('')
  const [loadError, setLoadError] = useState('')
  const [problems, setProblems] = useState<string[]>([])
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState<null | 'check' | 'save' | 'activate' | 'status'>(null)
  const requestRef = useRef(0)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ ideal: true })

  const apply = useCallback((s: IcpEditorState) => {
    const f = fromConfig(s.config, s.profile?.name ?? '')
    setState(s)
    setForm(f)
    setSaved(JSON.stringify(toConfig(f)) + f.name)
    setProblems(s.problems)
  }, [])

  useEffect(() => {
    const request = ++requestRef.current
    // Another product's form must never stay on screen.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(null); setForm(null); setMessage(null); setLoadError('')
    productIcpService.get(context, productKey)
      .then((res) => { if (request === requestRef.current) apply(res.data) })
      .catch((e) => { if (request === requestRef.current) setLoadError(errText(e, 'Could not load the ICP.')) })
  }, [context, productKey, apply])

  const dirty = useMemo(() => form !== null && JSON.stringify(toConfig(form)) + form.name !== saved, [form, saved])
  useEffect(() => { onDirtyChange?.(dirty) }, [dirty, onDirtyChange])
  useEffect(() => {
    if (!dirty) return
    const guard = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [dirty])

  if (loadError) return <p role="alert" className="text-sm text-destructive">{loadError}</p>
  if (!state || !form) return <Skeleton className="h-64 w-full rounded-xl" aria-label="Loading the ICP" />

  const set = (patch: Partial<FormState>) => setForm((f) => (f ? { ...f, ...patch } : f))
  const editRow = <K extends 'parts' | 'triggers' | 'queries' | 'disqualifiers' | 'must_have'>(k: K, id: number, patch: Partial<FormState[K][number]>) =>
    set({ [k]: (form[k] as Row<object>[]).map((r) => (r._id === id ? { ...r, ...patch } : r)) } as Partial<FormState>)
  const addRow = (k: 'parts' | 'triggers' | 'queries' | 'disqualifiers' | 'must_have', row: object) => set({ [k]: [...(form[k] as object[]), { ...row, _id: rid() }] } as Partial<FormState>)
  const removeRow = (k: 'parts' | 'triggers' | 'queries' | 'disqualifiers' | 'must_have', id: number) => set({ [k]: (form[k] as Row<object>[]).filter((r) => r._id !== id) } as Partial<FormState>)

  const partKeys = form.parts.map((p) => p.key.trim()).filter(Boolean)
  const about = (prefix: string) => problems.filter((p) => p.startsWith(prefix))
  const known = ['offer_ids', 'label', 'industry_label', 'customer_model', 'pitch', 'guidance', 'buyer_types', 'regions', 'priority_cities', 'competitors', 'vendor_phrases', 'parts', 'triggers', 'queries', 'disqualifiers', 'must_have', 'per_run']
  const other = problems.filter((p) => !known.some((k) => p.startsWith(k)))
  const { product, profile } = state
  const isActive = profile?.status === 'active'
  const lines = (v: string) => v.split('\n').map((x) => x.trim()).filter(Boolean).length
  const groups = [
    { id: 'ideal', title: '1. Ideal Customer', problems: [...about('label'), ...about('industry_label'), ...about('pitch'), ...about('guidance'), ...about('regions'), ...about('priority_cities')].length,
      summary: form.industry_label.trim() || 'Not set yet' },
    { id: 'buyer', title: '2. Buyer / Decision Maker', problems: about('buyer_types').length,
      summary: lines(form.buyer_types) > 0 ? `${lines(form.buyer_types)} customer type${lines(form.buyer_types) === 1 ? '' : 's'}` : 'None set' },
    { id: 'problems', title: '3. Problems and Outcomes', problems: [...about('offer_ids'), ...about('parts')].length,
      summary: `${form.parts.length} product part${form.parts.length === 1 ? '' : 's'} · ${form.offer_ids === null ? 'all of the product\'s offers' : `${form.offer_ids.length} product${form.offer_ids.length === 1 ? '' : 's'} chosen`}` },
    { id: 'triggers', title: '4. Buying Triggers', problems: [...about('triggers'), ...about('queries'), ...about('per_run')].length,
      summary: `${form.triggers.length} signal${form.triggers.length === 1 ? '' : 's'} · ${form.queries.length} search${form.queries.length === 1 ? '' : 'es'}` },
    { id: 'rules', title: '5. Qualification Rules', problems: [...about('must_have'), ...about('disqualifiers'), ...about('competitors'), ...about('vendor_phrases')].length,
      summary: `${form.must_have.length} criteri${form.must_have.length === 1 ? 'on' : 'a'} · ${form.disqualifiers.length} exclusion${form.disqualifiers.length === 1 ? '' : 's'}` },
  ]
  const toggleGroup = (id: string) => setOpenGroups((o) => ({ ...o, [id]: !(o[id] || (groups.find((g) => g.id === id)?.problems ?? 0) > 0) }))
  const editGroup = (id: string) => {
    setOpenGroups((o) => ({ ...o, [id]: true }))
    window.requestAnimationFrame(() => document.getElementById(`icp-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }
  const groupProps = (id: string) => {
    const g = groups.find((x) => x.id === id)!
    return { id, title: g.title, summary: g.summary, problems: g.problems, open: Boolean(openGroups[id]), onToggle: () => toggleGroup(id) }
  }

  async function run(kind: 'check' | 'save' | 'activate', activate = false) {
    if (!form || busy) return
    setBusy(activate ? 'activate' : kind)
    setMessage(null)
    const config = toConfig(form)
    try {
      // The server judges the form first, so every problem is shown next to its field (a failed save would only give one sentence).
      const check = await productIcpService.check(context, productKey, config)
      setProblems(check.data.problems)
      if (check.data.problems.length > 0) {
        setMessage({ tone: 'error', text: `${check.data.problems.length} problem${check.data.problems.length === 1 ? '' : 's'} to fix before this can be saved.` })
        return
      }
      if (kind === 'check') {
        setMessage(check.data.activation_blockers.length > 0
          ? { tone: 'error', text: `Valid, but it cannot be activated yet: ${check.data.activation_blockers.join('; ')}.` }
          : { tone: 'ok', text: 'Valid, and it can be activated.' })
        return
      }
      if (activate && check.data.activation_blockers.length > 0) {
        setProblems(check.data.activation_blockers)
        setMessage({ tone: 'error', text: 'It cannot be activated yet. Fix what is listed.' })
        return
      }
      const res = await productIcpService.save(context, productKey, { config, name: form.name.trim() || undefined, activate })
      apply(res.data)
      setMessage({ tone: 'ok', text: activate ? 'Saved and activated. No research was started.' : 'Saved. No research was started.' })
      onChanged()
    } catch (e) {
      setMessage({ tone: 'error', text: errText(e, 'Could not save the ICP.') })
    } finally {
      setBusy(null)
    }
  }

  async function changeStatus(next: 'active' | 'draft') {
    if (busy) return
    if (dirty && !window.confirm('You have unsaved changes. Changing the status uses the saved ICP, not these edits. Continue?')) return
    setBusy('status')
    setMessage(null)
    try {
      const res = await productIcpService.setStatus(context, productKey, next)
      // keep unsaved edits if there are any; only the status/readiness is refreshed
      setState(res.data)
      if (!dirty) apply(res.data)
      setMessage({ tone: 'ok', text: next === 'active' ? 'Activated. No research was started.' : 'Deactivated. Research for this product is off until it is activated again.' })
      onChanged()
    } catch (e) {
      setMessage({ tone: 'error', text: errText(e, 'Could not change the status.') })
    } finally {
      setBusy(null)
    }
  }

  function discard() {
    if (!state || !dirty) return
    if (window.confirm('Discard your unsaved changes?')) apply(state)
  }

  const disabled = !canEdit || busy !== null

  return (
    <section aria-label={`${product.label} ideal customer profile`} className="space-y-4 rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">Ideal Customer Profile: {product.label}</h3>
          <p className="text-xs text-muted-foreground">
            {profile ? `${profile.name} · version ${profile.version} · ${profile.status}` : 'No ICP is saved for this product yet.'}
            {state.config_source === 'template' && ' Showing the built-in definition. Saving creates your own ICP from it.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {product.state === 'ready' && <Badge variant="success" className="gap-1"><CheckCircle2 className="size-3" /> Ready</Badge>}
          {product.state === 'needs_setup' && <Badge variant="warning" className="gap-1"><AlertTriangle className="size-3" /> Needs setup</Badge>}
          {product.state === 'invalid' && <Badge variant="destructive" className="gap-1"><AlertTriangle className="size-3" /> Invalid configuration</Badge>}
          {dirty && <Badge variant="muted">Unsaved changes</Badge>}
        </div>
      </div>

      {product.state !== 'ready' && (
        <div role="status" className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
          {product.missing.length > 0 && <ul className="list-disc pl-5">{product.missing.map((m) => <li key={m}>{m}</li>)}</ul>}
          {product.next_step && <p className="mt-1 font-medium">Next: {product.next_step}</p>}
        </div>
      )}
      {!canEdit && <p className="text-sm text-muted-foreground">Only administrators can change an ICP. You can read it here.</p>}

      <ul aria-label="ICP summary" className="grid gap-2 @xl:grid-cols-2 @4xl:grid-cols-5">
        {groups.map((g) => (
          <li key={g.id} className="flex flex-col justify-between gap-1 rounded-lg bg-muted/40 p-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground">{g.title}</p>
              <p className="truncate text-xs text-muted-foreground">{g.summary}</p>
            </div>
            <Button type="button" size="xs" variant="ghost" className="self-start" onClick={() => editGroup(g.id)}>{canEdit ? 'Edit' : 'View'}</Button>
          </li>
        ))}
      </ul>

      <form
        className="space-y-4"
        onSubmit={(e) => { e.preventDefault(); void run('save') }}
        aria-busy={busy !== null}
      >
        <Group {...groupProps('ideal')}>
        <Section title="Who this product is for" problems={[...about('label'), ...about('industry_label'), ...about('customer_model'), ...about('pitch'), ...about('guidance')]}>
          <div className="grid gap-3 @xl:grid-cols-2">
            <Field label="Profile name" hint="Your own name for this ICP. Defaults to the ICP name below."><Input value={form.name} disabled={disabled} onChange={(e) => set({ name: e.target.value })} maxLength={120} /></Field>
            <Field label="ICP name" required><Input value={form.label} disabled={disabled} onChange={(e) => set({ label: e.target.value })} maxLength={100} /></Field>
            <Field label="Ideal customer" required hint="Who buys it (for example: mid-size manufacturers). You can write as much as you need."><Textarea value={form.industry_label} disabled={disabled} onChange={(e) => set({ industry_label: e.target.value })} rows={3} /></Field>
            <Field label="Customer type" hint={CUSTOMER_MODELS.find((m) => m.value === form.customer_model)?.note ?? 'Not set: treated as B2B.'}>
              <select className={selectCls} value={form.customer_model} disabled={disabled} onChange={(e) => set({ customer_model: e.target.value as CustomerModel })}>
                <option value="">Not set</option>
                {CUSTOMER_MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </Field>
            <Field label="Description" hint="What you sell and why it matters to them."><Textarea value={form.pitch} disabled={disabled} onChange={(e) => set({ pitch: e.target.value })} rows={2} /></Field>
            <div className="@xl:col-span-2">
              <Field label="Qualification guidance" hint="Extra guidance the research follows when judging a customer (up to 400 characters)."><Textarea value={form.guidance} disabled={disabled} onChange={(e) => set({ guidance: e.target.value })} rows={2} maxLength={400} /></Field>
            </div>
          </div>
        </Section>

        <Section title="Geography" problems={[...about('regions'), ...about('priority_cities')]} hint="One per line.">
          <div className="grid gap-3 @xl:grid-cols-2">
            <Field label="Regions served" hint="States or areas you can serve."><Textarea value={form.regions} disabled={disabled} onChange={(e) => set({ regions: e.target.value })} rows={3} /></Field>
            <Field label="Priority cities"><Textarea value={form.priority_cities} disabled={disabled} onChange={(e) => set({ priority_cities: e.target.value })} rows={3} /></Field>
          </div>
        </Section>
        </Group>

        <Group {...groupProps('buyer')}>
        <Section title="Customer types" problems={about('buyer_types')} hint="The kinds of organisation that buy this, one per line. The ICP stores no separate decision-maker roles, so none are asked for here.">
          <Field label="Customer types"><Textarea value={form.buyer_types} disabled={disabled} onChange={(e) => set({ buyer_types: e.target.value })} rows={3} placeholder="one per line" /></Field>
        </Section>
        </Group>

        <Group {...groupProps('problems')}>

        <Section
          title="Products in this ICP"
          hint="The products from your Product Portfolio that this ICP is for. Choose one, several or none: nothing is added for you."
          problems={about('offer_ids')}
        >
          <IcpProductPicker
            context={context}
            chosen={form.offer_ids}
            disabled={disabled}
            catalogVersion={catalogVersion}
            onChange={(next) => set({ offer_ids: next })}
            onCreate={canEdit ? onCreateProduct : undefined}
          />
        </Section>

        <Section
          title="Product parts"
          hint="What the product is made of. A signal must be tied to one of these."
          problems={about('parts')}
          action={<Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => addRow('parts', { key: '', what: '' })}><Plus className="mr-1 size-3.5" /> Add part</Button>}
        >
          {form.parts.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {form.offer_ids === null
                ? 'No parts yet. This ICP has no product list, so the offers stored for its product in the Product Portfolio are used.'
                : form.offer_ids.length > 0
                  ? 'No parts of its own. The products chosen above stand in for them.'
                  : 'No parts yet, and no products chosen. Add a part or choose a product so a signal can be matched to something.'}
            </p>
          )}
          {form.parts.map((p) => (
            <div key={p._id} className="grid gap-2 @xl:grid-cols-[12rem_1fr_auto]">
              <Input aria-label="Part key" placeholder="key_name" value={p.key} disabled={disabled} onChange={(e) => editRow('parts', p._id, { key: e.target.value })} />
              <Input aria-label="What the part does" placeholder="what it does" value={p.what} disabled={disabled} onChange={(e) => editRow('parts', p._id, { what: e.target.value })} />
              <Button type="button" size="icon" variant="ghost" aria-label="Remove part" disabled={disabled} onClick={() => removeRow('parts', p._id)}><Trash2 className="size-4" /></Button>
            </div>
          ))}
        </Section>

        </Group>

        <Group {...groupProps('triggers')}>
        <Section
          title="Business needs and buying signals"
          hint="Each event that shows a customer needs this product: where it shows up, what the need is, and the words that signal it."
          problems={about('triggers')}
          action={<Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => addRow('triggers', { key: '', source: 'news', part: '', decay: '', pain: '', phrases: '' })}><Plus className="mr-1 size-3.5" /> Add signal</Button>}
        >
          {form.triggers.length === 0 && <p className="text-sm text-muted-foreground">No signals yet. At least one is needed before this ICP can be activated.</p>}
          {form.triggers.map((t) => (
            <div key={t._id} className="space-y-2 rounded-lg bg-muted/40 p-3">
              <div className="grid gap-2 @xl:grid-cols-4">
                <Field label="Name"><Input placeholder="new_plant" value={t.key} disabled={disabled} onChange={(e) => editRow('triggers', t._id, { key: e.target.value })} /></Field>
                <Field label="Where it shows up">
                  <select className={selectCls} value={t.source} disabled={disabled} onChange={(e) => editRow('triggers', t._id, { source: e.target.value })}>
                    {state.options.sources.map((s) => <option key={s} value={s}>{SOURCE_LABEL[s] ?? s}</option>)}
                  </select>
                </Field>
                <Field label="Product part">
                  <select className={selectCls} value={t.part} disabled={disabled} onChange={(e) => editRow('triggers', t._id, { part: e.target.value })}>
                    <option value="">None</option>
                    {partKeys.map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                </Field>
                <Field label="Stays fresh (days)" hint="Blank = until its closing date."><Input inputMode="numeric" value={t.decay} disabled={disabled} onChange={(e) => editRow('triggers', t._id, { decay: e.target.value })} /></Field>
              </div>
              <Field label="The need or pain point"><Input value={t.pain} disabled={disabled} onChange={(e) => editRow('triggers', t._id, { pain: e.target.value })} maxLength={160} /></Field>
              <Field label="Buying-intent words" hint="Phrases that signal it, one per line." required><Textarea rows={2} value={t.phrases} disabled={disabled} onChange={(e) => editRow('triggers', t._id, { phrases: e.target.value })} /></Field>
              <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => removeRow('triggers', t._id)}><Trash2 className="mr-1 size-3.5" /> Remove signal</Button>
            </div>
          ))}
        </Section>

        <Section
          title="Searches"
          hint={`What a research run looks for. A run uses at most ${state.options.max_searches_per_run} searches in total (catalogue plus accounts).`}
          problems={[...about('queries'), ...about('per_run')]}
          action={<Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => addRow('queries', { id: '', source: 'news', topic: 'news', days: '45', q: '', domains: '' })}><Plus className="mr-1 size-3.5" /> Add search</Button>}
        >
          {form.queries.length === 0 && <p className="text-sm text-muted-foreground">No searches yet. At least one is needed before this ICP can be activated.</p>}
          {form.queries.map((q) => (
            <div key={q._id} className="space-y-2 rounded-lg bg-muted/40 p-3">
              <div className="grid gap-2 @xl:grid-cols-4">
                <Field label="Id"><Input placeholder="news-plant" value={q.id} disabled={disabled} onChange={(e) => editRow('queries', q._id, { id: e.target.value })} /></Field>
                <Field label="Kind of place">
                  <select className={selectCls} value={q.source} disabled={disabled} onChange={(e) => editRow('queries', q._id, { source: e.target.value })}>
                    {state.options.sources.map((s) => <option key={s} value={s}>{SOURCE_LABEL[s] ?? s}</option>)}
                  </select>
                </Field>
                <Field label="Search type">
                  <select className={selectCls} value={q.topic} disabled={disabled} onChange={(e) => editRow('queries', q._id, { topic: e.target.value })}>
                    {state.options.topics.map((s) => <option key={s} value={s}>{s === 'news' ? 'News' : 'General web'}</option>)}
                  </select>
                </Field>
                <Field label="Look back (days)"><Input inputMode="numeric" value={q.days} disabled={disabled} onChange={(e) => editRow('queries', q._id, { days: e.target.value })} /></Field>
              </div>
              <Field label="Search text" required><Input value={q.q} disabled={disabled} onChange={(e) => editRow('queries', q._id, { q: e.target.value })} maxLength={300} /></Field>
              <Field label="Only these sites (optional)" hint="One per line, such as linkedin.com."><Textarea rows={1} value={q.domains} disabled={disabled} onChange={(e) => editRow('queries', q._id, { domains: e.target.value })} /></Field>
              <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => removeRow('queries', q._id)}><Trash2 className="mr-1 size-3.5" /> Remove search</Button>
            </div>
          ))}
          <div className="grid gap-3 @xl:grid-cols-2">
            <Field label="Catalogue searches per run" hint="0 to 6. Leave blank to keep the default."><Input inputMode="numeric" value={form.catalogue} disabled={disabled} onChange={(e) => set({ catalogue: e.target.value })} /></Field>
            <Field label="Named-account searches per run" hint="0 to 6."><Input inputMode="numeric" value={form.accounts} disabled={disabled} onChange={(e) => set({ accounts: e.target.value })} /></Field>
          </div>
        </Section>

        </Group>

        <Group {...groupProps('rules')}>
        <Section
          title="Exclusions"
          hint="Organisations that must never be returned, found by these words in their name or news."
          problems={about('disqualifiers')}
          action={<Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => addRow('disqualifiers', { label: '', phrases: '' })}><Plus className="mr-1 size-3.5" /> Add exclusion</Button>}
        >
          {form.disqualifiers.map((d) => (
            <div key={d._id} className="grid gap-2 @xl:grid-cols-[14rem_1fr_auto]">
              <Input aria-label="Exclusion name" placeholder="For example: trading company" value={d.label} disabled={disabled} onChange={(e) => editRow('disqualifiers', d._id, { label: e.target.value })} />
              <Textarea aria-label="Exclusion words" rows={1} placeholder="words, one per line" value={d.phrases} disabled={disabled} onChange={(e) => editRow('disqualifiers', d._id, { phrases: e.target.value })} />
              <Button type="button" size="icon" variant="ghost" aria-label="Remove exclusion" disabled={disabled} onClick={() => removeRow('disqualifiers', d._id)}><Trash2 className="size-4" /></Button>
            </div>
          ))}
          <Field label="Competitors (never customers)" hint="One per line."><Textarea rows={2} value={form.competitors} disabled={disabled} onChange={(e) => set({ competitors: e.target.value })} /></Field>
          <Field label="Words that mark a seller of this kind of product" hint="One per line. Matched against an organisation's name and sector."><Textarea rows={2} value={form.vendor_phrases} disabled={disabled} onChange={(e) => set({ vendor_phrases: e.target.value })} /></Field>
        </Section>

        <Section
          title="Qualification criteria"
          hint="Facts a customer must meet, checked against what is known about it (for example: size at least 100). Anything a source does not state is never guessed."
          problems={about('must_have')}
          action={<Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => addRow('must_have', { kind: 'attribute', subject: '', op: '>=', value: '', label: '', prompt: '' })}><Plus className="mr-1 size-3.5" /> Add criterion</Button>}
        >
          {form.must_have.map((r) => (
            <div key={r._id} className="space-y-2 rounded-lg bg-muted/40 p-3">
              <div className="grid gap-2 @xl:grid-cols-4">
                <Field label="Fact (name)"><Input placeholder="employees" value={r.subject} disabled={disabled} onChange={(e) => editRow('must_have', r._id, { subject: e.target.value })} /></Field>
                <Field label="Kind of fact">
                  <select className={selectCls} value={r.kind} disabled={disabled} onChange={(e) => editRow('must_have', r._id, { kind: e.target.value as 'attribute' | 'field' })}>
                    <option value="attribute">Custom fact on the account</option>
                    <option value="field">Account field (such as state)</option>
                  </select>
                </Field>
                <Field label="Rule">
                  <select className={selectCls} value={r.op} disabled={disabled} onChange={(e) => editRow('must_have', r._id, { op: e.target.value })}>
                    {state.options.operators.map((o) => <option key={o} value={o}>{OP_LABEL[o] ?? o}</option>)}
                  </select>
                </Field>
                <Field label="Value" hint={r.op === 'between' ? 'low, high' : r.op === 'in' || r.op === 'not_in' ? 'comma separated' : undefined}>
                  <Input value={r.value} disabled={disabled || r.op === 'in_regions'} onChange={(e) => editRow('must_have', r._id, { value: e.target.value })} />
                </Field>
              </div>
              <div className="grid gap-2 @xl:grid-cols-2">
                <Field label="Why it fails (shown to the team)" required><Input value={r.label} disabled={disabled} onChange={(e) => editRow('must_have', r._id, { label: e.target.value })} maxLength={120} /></Field>
                <Field label="How to tell the research (optional)"><Input value={r.prompt} disabled={disabled} onChange={(e) => editRow('must_have', r._id, { prompt: e.target.value })} maxLength={120} /></Field>
              </div>
              <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => removeRow('must_have', r._id)}><Trash2 className="mr-1 size-3.5" /> Remove criterion</Button>
            </div>
          ))}
        </Section>

        <IcpComparison context={context} productKey={productKey} offerIds={form.offer_ids ?? []} dirty={dirty} catalogVersion={catalogVersion} />
        </Group>

        {other.length > 0 && <Section title="Other problems" problems={other}><span /></Section>}

        {message && (
          <p role={message.tone === 'error' ? 'alert' : 'status'} className={`text-sm ${message.tone === 'error' ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'}`}>{message.text}</p>
        )}

        {canEdit && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-4">
            <Button type="submit" disabled={busy !== null || !dirty}>{busy === 'save' && <Loader2 className="mr-2 size-4 animate-spin" />}Save</Button>
            <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void run('save', true)}>{busy === 'activate' && <Loader2 className="mr-2 size-4 animate-spin" />}Save and activate</Button>
            <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void run('check')}>{busy === 'check' && <Loader2 className="mr-2 size-4 animate-spin" />}Check</Button>
            <Button type="button" variant="ghost" disabled={busy !== null || !dirty} onClick={discard}>Discard changes</Button>
            {profile && (isActive
              ? <Button type="button" variant="ghost" disabled={busy !== null} onClick={() => void changeStatus('draft')}>Deactivate</Button>
              : <Button type="button" variant="ghost" disabled={busy !== null} onClick={() => void changeStatus('active')}>Activate saved ICP</Button>)}
          </div>
        )}
        {state.versions.length > 0 && (
          <p className="text-xs text-muted-foreground">Versions kept: {state.versions.map((v) => `v${v.version}${v.note ? ` (${v.note})` : ''}`).join(', ')}. Saving never starts research or spends search or AI quota.</p>
        )}
      </form>
    </section>
  )
}
