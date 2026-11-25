'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FormErrorSummary, FormLayout, PageTabs, RecordDrawer, splitFieldErrors, TabPanel, type SplitErrors } from '@/components/shared/scaffolds'
import { useAssignableEmployees } from '@/components/domain/crm/lead-employees'
import { ErrorState } from '@/components/ui/error-state'
import { getLaravelContext, isLaravelContextReady, type LaravelContext } from '@/lib/laravel-context'
import {
  buildPayload, checkValues, emptyValues, FORM_FIELDS, isDirty, sectionOf, standingOf, valuesFromRecord,
  type AboutForm, type ProductChoice, type ProductValues, type SectionId, type SellForm,
} from '@/lib/portfolio/form-model'
import { defaultCurrencyCode } from '@/lib/money/currencies'
import { buildIcpConfigs, changedIcpModels, emptyIcpStates, ICP_MODELS, icpModelsToSend, icpStatesFromOffer, type IcpModel, type IcpStates } from '@/lib/portfolio/icp-state'
import { nextProductId } from '@/lib/product-form'
import { serverProblems, validateNewProduct, suggestKey, type NewProductErrors } from '@/lib/product-key'
import { ApiError } from '@/services/core'
import { crmService } from '@/services/crm'
import { portfolioService } from '@/services/portfolio/portfolio-service'
import type { TaxonomyData } from '@/services/portfolio/types'
import { productIcpService } from '@/services/signals/product-icp'
import { productRecordService } from '@/services/product-master/record-service'
import type { PmFullRecord } from '@/services/product-master/record-types'
import type { PmItemType, PmMeta } from '@/services/product-master/types'
import type { CrmPicklistValue } from '@/types/crm'
import { AboutSection } from './product-form-about'
import { IcpSection } from './product-form-icp'
import { SellSection } from './product-form-sell'

/**
 * The one form that adds or edits a Sub-product (or, for an administrator, adds a Product). Three sections in one drawer: About (the Portfolio's fields),
 * Sell in CRM (every field of the old Products form) and Ideal customer (the three ICPs). One Save writes every section the person filled in or changed,
 * in one transaction; the answer of each refusal is shown on its field, and a 403 names the section it refused. The picture goes up right after, through
 * its own call, with a visible status. Words: Product and Sub-product.
 */
export type ProductFormMode = 'create-sub-product' | 'create-product' | 'edit'

export interface ProductFormDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: ProductFormMode
  /** The master id, for mode 'edit'. */
  recordId?: number
  /** Preselects the Product for 'create-sub-product'. */
  defaultProductId?: number
  onSaved: (saved: { id: number }) => void
}

export function ProductFormDrawer(props: ProductFormDrawerProps) {
  // Every opening is a fresh form: a new key remounts the form, so nothing typed or refused the last time is still there.
  const [session, setSession] = useState(0)
  const [wasOpen, setWasOpen] = useState(false)
  if (props.open !== wasOpen) {
    setWasOpen(props.open)
    if (props.open) setSession((s) => s + 1)
  }

  return props.mode === 'create-product'
    ? <AddProductForm key={`product-${session}`} open={props.open} onOpenChange={props.onOpenChange} onSaved={props.onSaved} />
    : <SubProductForm key={`sub-${session}`} {...props} />
}

// ============================================================================================================================ Add product (level 1)

function AddProductForm({ open, onOpenChange, onSaved }: Pick<ProductFormDrawerProps, 'open' | 'onOpenChange' | 'onSaved'>) {
  const [name, setName] = useState('')
  const [key, setKey] = useState('')
  const [keyTouched, setKeyTouched] = useState(false)
  const [errors, setErrors] = useState<NewProductErrors>({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const dirty = name !== '' || key !== ''

  const submit = async () => {
    if (busy) return
    const found = validateNewProduct(key, name)
    setErrors(found)
    if (found.key || found.label) return
    setBusy(true)
    setMessage('')
    try {
      const response = await productRecordService.create({ kind: 'product', name: name.trim(), key })
      onSaved({ id: response.data.id })
      onOpenChange(false)
    } catch (cause) {
      const { fields, general } = serverProblems(cause instanceof ApiError ? { ...cause.errors, label: cause.errors?.name ?? [] } : undefined)
      setErrors(fields)
      setMessage(general[0] ?? (fields.key || fields.label ? '' : cause instanceof Error ? cause.message : 'The product could not be added.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <RecordDrawer
      open={open}
      onClose={() => onOpenChange(false)}
      title="Add product"
      description="A product groups sub-products. Add its sub-products afterwards."
      dirty={dirty}
      busy={busy}
      width="md"
      footer={(requestClose) => (
        <>
          <Button type="button" variant="outline" onClick={requestClose} disabled={busy}>Cancel</Button>
          <Button type="submit" form="pf-add-product" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
        </>
      )}
    >
      <FormLayout id="pf-add-product" onSubmit={() => void submit()}>
        {message && <FormErrorSummary messages={[message]} />}
        <Field label="Name" required error={errors.label}>
          {(c) => <Input {...c} value={name} maxLength={50} disabled={busy} autoComplete="off" onChange={(e) => { setName(e.target.value); if (!keyTouched) setKey(suggestKey(e.target.value)) }} />}
        </Field>
        <Field label="Key" required error={errors.key} hint="3 to 20 characters: lower-case letters, digits and underscores, starting with a letter. It cannot be changed later.">
          {(c) => <Input {...c} value={key} maxLength={20} disabled={busy} autoComplete="off" onChange={(e) => { setKeyTouched(true); setKey(e.target.value.toLowerCase()) }} />}
        </Field>
      </FormLayout>
    </RecordDrawer>
  )
}

// ============================================================================================================================ Add or edit a Sub-product

interface Loaded {
  record: PmFullRecord | null
  meta: PmMeta
  choices: ProductChoice[]
  taxonomy: TaxonomyData | null
  icp: IcpStates
}

type LoadState = { status: 'loading' } | { status: 'error'; text: string } | { status: 'ready'; data: Loaded }

const NO_ERRORS: SplitErrors = { byField: {}, unplaced: [] }
const SECTION_LABEL: Record<SectionId, string> = { about: 'About', sell: 'Sell in CRM', icp: 'Ideal customer' }

/** What the server said, split onto the fields of this form; a refusal that names no field is shown on top. */
function splitSaveError(cause: unknown): SplitErrors {
  if (cause instanceof ApiError) {
    const split = splitFieldErrors(cause.errors, FORM_FIELDS)
    if (Object.keys(split.byField).length === 0 && split.unplaced.length === 0) split.unplaced.push(cause.message)
    return split
  }
  return { byField: {}, unplaced: [cause instanceof Error ? cause.message : 'This could not be saved.'] }
}

const toChoices = (list: Awaited<ReturnType<typeof productRecordService.everything>>['data']): ProductChoice[] => list.products.map((p) => ({
  id: p.id, key: p.key, name: p.name, portfolioName: p.portfolioName, shared: p.shared, status: p.status,
  subProducts: p.subProducts.map((s) => ({ id: s.id, name: s.name, offerId: s.offerId, status: s.status })),
}))

function SubProductForm({ open, onOpenChange, mode, recordId, defaultProductId, onSaved }: ProductFormDrawerProps) {
  const editing = mode === 'edit'
  const context = useMemo(() => getLaravelContext(), [])
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!open) return
    if (!isLaravelContextReady(getLaravelContext())) {
      queueMicrotask(() => setLoad({ status: 'error', text: 'Your ERP session is unavailable. Please sign in again.' }))
      return
    }
    let live = true
    queueMicrotask(async () => {
      if (live) setLoad({ status: 'loading' })
      try {
        const [meta, everything, taxonomy, record] = await Promise.all([
          productRecordService.meta(),
          productRecordService.everything(),
          portfolioService.getTaxonomy(context).then((r) => r.data).catch(() => null),
          editing && recordId !== undefined ? productRecordService.get(recordId).then((r) => r.data) : Promise.resolve(null),
        ])
        // The stored ideal customers belong to the offer row; a failed read leaves them empty and untouched (nothing is sent for a model nobody changed).
        const offer = record?.offer ? await portfolioService.getOffer(context, record.offer.id).then((r) => r.data as unknown as Record<string, unknown>).catch(() => null) : null
        if (!live) return
        setLoad({ status: 'ready', data: { record, meta: meta.data, choices: toChoices(everything.data), taxonomy, icp: record?.offer ? icpStatesFromOffer(offer, record.offer.name) : emptyIcpStates() } })
      } catch (cause) {
        if (!live) return
        setLoad({ status: 'error', text: cause instanceof ApiError && cause.status === 404 ? 'This sub-product could not be found, or you do not have access to it.' : cause instanceof Error ? cause.message : 'The form could not be opened.' })
      }
    })
    return () => { live = false }
  }, [open, editing, recordId, context, attempt])

  const title = editing ? (load.status === 'ready' && load.data.record ? `Edit ${load.data.record.name}` : 'Edit sub-product') : 'Add sub-product'

  if (load.status !== 'ready') {
    return (
      <RecordDrawer open={open} onClose={() => onOpenChange(false)} title={title} width="xl" footer={(requestClose) => <Button type="button" variant="outline" onClick={requestClose}>Close</Button>}>
        {load.status === 'loading'
          ? <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden="true" />Opening the form…</p>
          : <ErrorState title="The form could not be opened" description={load.text} retry={() => setAttempt((n) => n + 1)} />}
      </RecordDrawer>
    )
  }

  return (
    <ReadyForm
      key={`${attempt}`}
      open={open}
      onOpenChange={onOpenChange}
      mode={mode}
      recordId={recordId}
      defaultProductId={defaultProductId}
      onSaved={onSaved}
      data={load.data}
      context={context}
      title={title}
    />
  )
}

interface SideStatus {
  /** The record is saved; only the picture could not be. */
  saved: PmFullRecord
  picture: string
}

/** The next ID for a Product: its code and the next number among the IDs its sub-products already have (SCH-04 -> SCH-05). '' when the Product has no code. */
function suggestId(choices: readonly ProductChoice[], productId: string): string {
  const product = choices.find((p) => String(p.id) === productId)
  if (!product?.portfolioName) return ''
  return nextProductId(product.portfolioName, product.subProducts.map((s) => s.offerId ?? '').filter(Boolean))
}

function ReadyForm({ open, onOpenChange, mode, defaultProductId, onSaved, data, context, title }: ProductFormDrawerProps & { data: Loaded; context: LaravelContext; title: string }) {
  const editing = mode === 'edit'
  const { record, meta, choices, taxonomy } = data
  const hasAbout = record?.offer != null
  const standing = standingOf(record?.sell ?? null)
  const sellTypes = useMemo<PmItemType[]>(() => (['product', 'service'] as const).filter((t) => meta.can.sellInCrm[t]), [meta])
  const showSell = standing !== 'none' || sellTypes.length > 0

  const [initial] = useState<ProductValues>(() => {
    if (record) return valuesFromRecord(record)
    const start = emptyValues({ productId: defaultProductId, type: sellTypes[0] ?? 'product', assignedTo: context.userId, currency: defaultCurrencyCode(meta) })
    // A new record opened under a Product starts with that Product's next ID.
    const id = defaultProductId ? suggestId(choices, String(defaultProductId)) : ''
    return id === '' ? start : { ...start, about: { ...start.about, offerId: id } }
  })
  const [values, setValues] = useState<ProductValues>(initial)
  const [icp, setIcp] = useState<IcpStates>(data.icp)
  const [errors, setErrors] = useState<SplitErrors>(NO_ERRORS)
  const [icpProblems, setIcpProblems] = useState<Partial<Record<IcpModel, string[]>>>({})
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<SectionId>('about')
  const [icpTab, setIcpTab] = useState<IcpModel>('b2b')
  const [idTouched, setIdTouched] = useState(false)
  const [side, setSide] = useState<SideStatus | null>(null)
  const [categories, setCategories] = useState<CrmPicklistValue[]>([])

  const employees = useAssignableEmployees(context, showSell)

  // The `products.category` picklist: read once, only for a person who can see the Sell section.
  useEffect(() => {
    if (!showSell || !isLaravelContextReady(context)) return
    let live = true
    crmService.getPicklistValues(context, 'products').then((r) => { if (live) setCategories(r.data.products?.category ?? []) }).catch(() => { /* the field still works with its stored value */ })
    return () => { live = false }
  }, [showSell, context])

  const clear = (...keys: string[]) => setErrors((e) => {
    const byField = { ...e.byField }
    for (const k of keys) delete byField[k]
    return { ...e, byField, unplaced: [] }
  })
  const setTop = (patch: Partial<Pick<ProductValues, 'name'>>) => { setValues((v) => ({ ...v, ...patch })); clear('name', 'sections') }
  const setAbout = (patch: Partial<AboutForm>) => {
    setValues((v) => ({ ...v, about: { ...v.about, ...patch } }))
    clear('sections', ...Object.keys(patch).map((k) => (k === 'offerId' || k === 'readiness' ? k : k === 'problems' ? 'about.needsSolved' : `about.${k}`)), 'about')
  }
  const setSell = (patch: Partial<SellForm>) => {
    setValues((v) => ({ ...v, sell: { ...v.sell, ...patch } }))
    clear('sections', 'sell', ...Object.keys(patch).map((k) => (k === 'on' ? 'sell.enabled' : k === 'offered' ? 'sell.isActive' : `sell.${k}`)))
  }
  const setProduct = (productId: string) => {
    setValues((v) => {
      const suggestion = !editing && !idTouched ? suggestId(choices, productId) : ''
      return { ...v, productId, about: suggestion !== '' ? { ...v.about, offerId: suggestion } : v.about }
    })
    clear('productId', 'offerId')
  }
  const setOfferId = (offerId: string) => { setIdTouched(offerId.trim() !== ''); setAbout({ offerId }) }
  const setIcpModel = (model: IcpModel, patch: { form?: object; lines?: object }) => {
    setIcp((s) => ({ ...s, [model]: { form: { ...s[model].form, ...patch.form }, lines: { ...s[model].lines, ...patch.lines } } }))
    setIcpProblems((p) => ({ ...p, [model]: [] }))
    clear('icp')
  }

  const dirty = isDirty(initial, values, changedIcpModels(data.icp, icp).length > 0)
  const sectionErrors = (section: SectionId): number => Object.keys(errors.byField).filter((k) => sectionOf(k) === section).length + (section === 'icp' ? ICP_MODELS.filter((m) => (icpProblems[m] ?? []).length > 0).length : 0)
  const jumpToFirstProblem = (byField: Record<string, string[]>, problems: Partial<Record<IcpModel, string[]>>) => {
    const sections = (['about', 'sell', 'icp'] as const).filter((s) => Object.keys(byField).some((k) => sectionOf(k) === s) || (s === 'icp' && ICP_MODELS.some((m) => (problems[m] ?? []).length > 0)))
    if (sections[0]) setTab(sections[0])
    const bad = ICP_MODELS.find((m) => (problems[m] ?? []).length > 0)
    if (bad) setIcpTab(bad)
  }

  const submit = async () => {
    if (busy) return
    const found = checkValues(values, { mode: editing ? 'edit' : 'create', hasAbout })
    if (Object.keys(found).length > 0) {
      const byField = Object.fromEntries(Object.entries(found).map(([k, v]) => [k, [v]]))
      const split: SplitErrors = { byField: Object.fromEntries(Object.entries(byField).filter(([k]) => k !== 'sections')), unplaced: found.sections ? [found.sections] : [] }
      setErrors(split)
      jumpToFirstProblem(split.byField, {})
      return
    }

    setBusy(true)
    setErrors(NO_ERRORS)
    setIcpProblems({})

    // The ideal customers the person filled in or changed: each is checked before anything is saved, so a bad one stops the whole save.
    const models = icpModelsToSend(data.icp, icp)
    const offerName = { offer_id: (hasAbout ? record?.offer?.offerId : values.about.offerId.trim()) ?? '', name: values.name.trim(), what_it_does: values.about.whatItDoes }
    const built = buildIcpConfigs(models, icp, offerName)
    const problems: Partial<Record<IcpModel, string[]>> = { ...built.problems }
    for (const model of models) {
      const config = built.configs[model]
      if (!config) continue
      try {
        const { offer_ids: omitted, ...checkable } = config as typeof config & { offer_ids?: unknown }
        void omitted
        const verdict = await productIcpService.checkConfig(context, checkable as never, model)
        if (!verdict.data.valid) problems[model] = [...(problems[model] ?? []), ...verdict.data.problems]
      } catch {
        // The check is a courtesy; the server judges the configuration again when it is saved.
      }
    }
    if (ICP_MODELS.some((m) => (problems[m] ?? []).length > 0)) {
      setIcpProblems(problems)
      jumpToFirstProblem({}, problems)
      setErrors({ byField: {}, unplaced: ['Fix the Ideal customer section. Nothing was saved.'] })
      setBusy(false)
      return
    }

    const body = buildPayload({ mode: editing ? 'edit' : 'create', initial, values, standing, hasAbout, icp: Object.keys(built.configs).length > 0 ? built.configs : undefined })
    if (editing && Object.keys(body).length === 0 && !values.sell.image) {
      setBusy(false)
      onOpenChange(false)
      return
    }

    let saved: PmFullRecord = record as PmFullRecord
    try {
      if (Object.keys(body).length > 0 || !editing) {
        const response = editing && record ? await productRecordService.update(record.id, body) : await productRecordService.create(body)
        saved = response.data
      }
    } catch (cause) {
      const split = splitSaveError(cause)
      setErrors(split)
      jumpToFirstProblem(split.byField, {})
      setBusy(false)
      return
    }

    // The picture: its own call, keyed by the catalogue id the save returned. A failure is said out loud and the rest stays saved.
    const file = values.sell.image
    const crmId = saved.sell?.crmProductId
    if (file && crmId) {
      try {
        await crmService.uploadProductImage(context, String(crmId), file)
      } catch (cause) {
        setSide({ saved, picture: cause instanceof Error ? cause.message : 'The picture could not be uploaded.' })
        setBusy(false)
        return
      }
    }
    setBusy(false)
    onSaved({ id: saved.id })
    onOpenChange(false)
  }

  const closeAfterPartial = () => { if (side) onSaved({ id: side.saved.id }); onOpenChange(false) }
  const retryPicture = async () => {
    const file = values.sell.image
    const crmId = side?.saved.sell?.crmProductId
    if (!side || !file || !crmId) return
    setBusy(true)
    try {
      await crmService.uploadProductImage(context, String(crmId), file)
      setBusy(false)
      closeAfterPartial()
    } catch (cause) {
      setSide({ saved: side.saved, picture: cause instanceof Error ? cause.message : 'The picture could not be uploaded.' })
      setBusy(false)
    }
  }

  if (record?.kind === 'product') {
    return (
      <RecordDrawer open={open} onClose={() => onOpenChange(false)} title={title} width="xl" footer={(requestClose) => <Button type="button" variant="outline" onClick={requestClose}>Close</Button>}>
        <p className="text-sm text-muted-foreground">This is a product. Its name and key cannot be changed here: open or add its sub-products instead.</p>
      </RecordDrawer>
    )
  }

  if (side) {
    return (
      <RecordDrawer open={open} onClose={closeAfterPartial} title={title} width="xl" busy={busy} footer={() => (
        <>
          {values.sell.image && <Button type="button" variant="outline" disabled={busy} onClick={() => void retryPicture()}>Try the picture again</Button>}
          <Button type="button" onClick={closeAfterPartial} disabled={busy}>Close</Button>
        </>
      )}>
        <ul aria-label="What was saved" className="space-y-2 text-sm text-foreground">
          <li role="status">Details: saved.</li>
          <li role="alert">Picture: not uploaded. {side.picture}</li>
        </ul>
      </RecordDrawer>
    )
  }

  const tabs = [
    { id: 'about', label: sectionErrors('about') > 0 ? `${SECTION_LABEL.about} (needs attention)` : SECTION_LABEL.about },
    ...(showSell ? [{ id: 'sell', label: sectionErrors('sell') > 0 ? `${SECTION_LABEL.sell} (needs attention)` : SECTION_LABEL.sell }] : []),
    { id: 'icp', label: sectionErrors('icp') > 0 ? `${SECTION_LABEL.icp} (needs attention)` : SECTION_LABEL.icp },
  ]
  const sectionAlert = (section: SectionId) => (errors.byField[section] ?? []).join(' ')

  return (
    <RecordDrawer
      open={open}
      onClose={() => onOpenChange(false)}
      title={title}
      description={editing ? 'One Save writes every section you changed.' : 'One Save writes everything you fill in, together.'}
      dirty={dirty}
      busy={busy}
      width="xl"
      footer={(requestClose) => (
        <>
          <Button type="button" variant="outline" onClick={requestClose} disabled={busy}>Cancel</Button>
          <Button type="submit" form="pf-sub-product" disabled={busy || (editing && !dirty)}>{busy ? 'Saving…' : 'Save'}</Button>
        </>
      )}
    >
      <FormLayout id="pf-sub-product" onSubmit={() => void submit()}>
        <FormErrorSummary messages={errors.unplaced} />
        <PageTabs tabs={tabs} active={tab} onChange={(id) => setTab(id as SectionId)} label="Sections of this form" idPrefix="pf-form" />

        <TabPanel id="about" active={tab} idPrefix="pf-form">
          {sectionAlert('about') && <p role="alert" className="mb-3 rounded-lg border border-destructive bg-card p-3 text-sm text-foreground">{sectionAlert('about')}</p>}
          <AboutSection
            values={values}
            onValues={setTop}
            onAbout={setAbout}
            onProduct={setProduct}
            onOfferId={setOfferId}
            errors={errors.byField}
            choices={choices}
            taxonomy={taxonomy}
            readinessCodes={meta.readinessStatuses}
            hasAbout={hasAbout}
            busy={busy}
          />
        </TabPanel>
        {showSell && (
          <TabPanel id="sell" active={tab} idPrefix="pf-form">
            {sectionAlert('sell') && <p role="alert" className="mb-3 rounded-lg border border-destructive bg-card p-3 text-sm text-foreground">{sectionAlert('sell')}</p>}
            <SellSection
              sell={values.sell}
              onSell={setSell}
              standing={standing}
              types={sellTypes}
              taxRates={meta.taxRates}
              currencyFallback={defaultCurrencyCode(meta)}
              categories={categories}
              employees={employees}
              errors={errors.byField}
              busy={busy}
              name={values.name}
              imageUrl={record?.sell?.imageUrl ?? null}
            />
          </TabPanel>
        )}
        <TabPanel id="icp" active={tab} idPrefix="pf-form">
          {sectionAlert('icp') && <p role="alert" className="mb-3 rounded-lg border border-destructive bg-card p-3 text-sm text-foreground">{sectionAlert('icp')}</p>}
          <IcpSection states={icp} onChange={setIcpModel} problems={icpProblems} busy={busy} editing={hasAbout} active={icpTab} onActive={setIcpTab} />
        </TabPanel>
      </FormLayout>
    </RecordDrawer>
  )
}
