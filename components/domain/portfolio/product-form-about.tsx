'use client'

import { X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, NativeSelect } from '@/components/shared/scaffolds'
import type { AboutForm, ProductChoice, ProductValues } from '@/lib/portfolio/form-model'
import type { TaxonomyData } from '@/services/portfolio/types'
import { SubProductMultiSelect, TickList, type TickOption } from './product-form-lists'

type Errors = Record<string, string[]>

/**
 * The About section: every field of the Portfolio's own form, plus Often sold together. The Product, the ID and the Name are the identity of the record.
 * The ID is typed once and never changes (`hasAbout`); the readiness here is only what the team says, a person confirms it elsewhere.
 */
export function AboutSection({ values, onValues, onAbout, onProduct, onOfferId, errors, choices, taxonomy, readinessCodes, hasAbout, busy }: {
  values: ProductValues
  onValues: (patch: Partial<Pick<ProductValues, 'name'>>) => void
  onAbout: (patch: Partial<AboutForm>) => void
  onProduct: (productId: string) => void
  onOfferId: (offerId: string) => void
  errors: Errors
  choices: readonly ProductChoice[]
  taxonomy: TaxonomyData | null
  /** The readiness values the server accepts (`meta.readinessStatuses`). */
  readinessCodes: readonly string[]
  /** The record already has an About: its ID is fixed. */
  hasAbout: boolean
  busy: boolean
}) {
  const a = values.about
  const err = (name: string) => errors[name]
  const labels = taxonomy?.readiness_statuses ?? {}
  const readinessList = readinessCodes.length > 0 ? [...readinessCodes] : Object.keys(labels)
  const readinessOptions = a.readiness !== '' && !readinessList.includes(a.readiness) ? [a.readiness, ...readinessList] : readinessList
  const products = choices.filter((p) => p.status === 'active' || String(p.id) === values.productId)
  const deployments = taxonomy?.deployment_models ?? {}
  const segmentOptions: TickOption[] = Object.entries(taxonomy?.segments ?? {}).map(([code, label]) => ({ code, label }))
  const eventOptions: TickOption[] = Object.entries(taxonomy?.signal_families ?? {}).map(([code, f]) => ({ code, label: f.label, detail: f.examples, title: f.relevance }))

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Product" required error={err('productId')}>
        {(c) => (
          <NativeSelect {...c} value={values.productId} onChange={(e) => onProduct(e.target.value)} disabled={busy}>
            <option value="">Choose a product…</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </NativeSelect>
        )}
      </Field>
      <Field label="ID" required error={err('offerId')} hint={hasAbout ? 'The ID cannot be changed.' : 'Filled in from the product (the next number). You can change it.'}>
        {(c) => <Input {...c} value={a.offerId} onChange={(e) => onOfferId(e.target.value)} disabled={busy || hasAbout} maxLength={50} autoComplete="off" />}
      </Field>
      <Field label="Name" required error={err('name')} wide>
        {(c) => <Input {...c} value={values.name} onChange={(e) => onValues({ name: e.target.value })} disabled={busy} maxLength={191} autoComplete="off" />}
      </Field>
      <Field label="Readiness" required error={err('readiness')} hint="Confirming it as ready is done by a person, on the sub-product's page.">
        {(c) => (
          <NativeSelect {...c} value={a.readiness} onChange={(e) => onAbout({ readiness: e.target.value })} disabled={busy}>
            <option value="">Choose a readiness…</option>
            {readinessOptions.map((code) => <option key={code} value={code}>{labels[code] ?? code}</option>)}
          </NativeSelect>
        )}
      </Field>
      <Field label="Deployment" error={err('about.deploymentModel')}>
        {(c) => (
          <NativeSelect {...c} value={a.deploymentModel} onChange={(e) => onAbout({ deploymentModel: e.target.value })} disabled={busy}>
            <option value="">Not set</option>
            {a.deploymentModel !== '' && !(a.deploymentModel in deployments) && <option value={a.deploymentModel}>{a.deploymentModel}</option>}
            {Object.entries(deployments).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
          </NativeSelect>
        )}
      </Field>

      <Field label="What it does" error={err('about.whatItDoes')} hint="In plain words. The ideal customer comparison and signal matching read this." wide>
        {(c) => <Textarea {...c} rows={3} value={a.whatItDoes} onChange={(e) => onAbout({ whatItDoes: e.target.value })} disabled={busy} />}
      </Field>
      <Field label="Features and capabilities" error={err('about.modulesComponents')} hint="Modules or capabilities it includes. The ideal customer comparison reads this too." wide>
        {(c) => <Textarea {...c} rows={2} value={a.modulesComponents} onChange={(e) => onAbout({ modulesComponents: e.target.value })} disabled={busy} />}
      </Field>
      <Field label="Customer problems solved" error={err('about.needsSolved')} hint="In your own words, one per line." wide>
        {(c) => <Textarea {...c} rows={4} value={a.problems} onChange={(e) => onAbout({ problems: e.target.value })} disabled={busy} placeholder={'For example:\nFee collection is slow during admissions\nParents cannot see attendance'} />}
      </Field>
      {a.legacyNeeds.length > 0 && (
        <ul aria-label="Older problem codes this record carries" className="flex flex-wrap items-center gap-1.5 text-xs sm:col-span-2">
          <li className="text-muted-foreground">Older problem codes:</li>
          {a.legacyNeeds.map((code) => (
            <li key={code} className="flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-0.5 text-foreground">
              <span>{taxonomy?.needs?.[code] ?? code}</span>
              <button type="button" disabled={busy} aria-label={`Remove ${taxonomy?.needs?.[code] ?? code}`} className="rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => onAbout({ legacyNeeds: a.legacyNeeds.filter((x) => x !== code) })}><X className="size-3" aria-hidden="true" /></button>
            </li>
          ))}
        </ul>
      )}

      <div className="sm:col-span-2 grid items-start gap-4 md:grid-cols-2">
        <TickList
          legend="Target customers"
          hint="Who it is sold to. Tick from the list, or add your own under Other."
          options={segmentOptions}
          value={a.primarySegments}
          disabled={busy}
          onChange={(v) => onAbout({ primarySegments: v })}
          otherLabel="Other target customer, then Add"
          error={err('about.primarySegments')?.join(' ')}
        />
        <TickList
          legend="Buying events it responds to"
          hint="The kinds of event that show a customer needs it. Tick from the list, or add your own under Other."
          options={eventOptions}
          legacy={taxonomy?.signals ?? {}}
          value={a.triggerSignals}
          disabled={busy}
          onChange={(v) => onAbout({ triggerSignals: v })}
          otherLabel="Other buying event, then Add"
          error={err('about.triggerSignals')?.join(' ')}
        />
      </div>

      <Field label="Benefits and proof" error={err('about.proofPoints')} hint="Results, references or evidence you can stand behind." wide>
        {(c) => <Textarea {...c} rows={2} value={a.proofPoints} onChange={(e) => onAbout({ proofPoints: e.target.value })} disabled={busy} />}
      </Field>
      <Field label="Pricing model" error={err('about.pricingModel')} hint="Leave blank if there is no price yet. None is invented.">
        {(c) => <Input {...c} value={a.pricingModel} onChange={(e) => onAbout({ pricingModel: e.target.value })} disabled={busy} maxLength={191} autoComplete="off" />}
      </Field>
      <Field label="Typical deal size" error={err('about.typicalDealBand')}>
        {(c) => <Input {...c} value={a.typicalDealBand} onChange={(e) => onAbout({ typicalDealBand: e.target.value })} disabled={busy} maxLength={50} autoComplete="off" />}
      </Field>
      <Field label="Implementation effort" error={err('about.implementationEffort')}>
        {(c) => <Input {...c} value={a.implementationEffort} onChange={(e) => onAbout({ implementationEffort: e.target.value })} disabled={busy} maxLength={100} autoComplete="off" />}
      </Field>
      <Field label="Delivery owner" error={err('about.deliveryOwner')}>
        {(c) => <Input {...c} value={a.deliveryOwner} onChange={(e) => onAbout({ deliveryOwner: e.target.value })} disabled={busy} maxLength={100} autoComplete="off" />}
      </Field>
      <div className="sm:col-span-2">
        <SubProductMultiSelect
          legend="Often sold together"
          hint="Other sub-products that are usually sold with this one."
          choices={choices}
          ownOfferId={a.offerId.trim()}
          value={a.oftenSoldTogether}
          onChange={(v) => onAbout({ oftenSoldTogether: v })}
          disabled={busy}
          error={err('about.oftenSoldTogether')?.join(' ')}
        />
      </div>
      <Field label="Notes" error={err('about.notes')} wide>
        {(c) => <Textarea {...c} rows={2} value={a.notes} onChange={(e) => onAbout({ notes: e.target.value })} disabled={busy} />}
      </Field>
    </div>
  )
}
