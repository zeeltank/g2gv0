'use client'

import Link from 'next/link'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { CUSTOMER_MODELS, rid, type CustomerModel, type FormState } from '@/lib/icp-form'
import type { IcpLines } from '@/lib/product-icp-draft'
import { icpHref } from '@/lib/product-selection'

const selectCls = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const SOURCES: [string, string][] = [['news', 'News'], ['job', 'Job posts'], ['tender', 'Tenders'], ['leadership', 'Leadership change'], ['regulation', 'Regulation'], ['social', 'Social / LinkedIn'], ['concept', 'Concept'], ['other', 'Other']]
const RULES: [string, string][] = [['>=', 'at least'], ['<=', 'at most'], ['>', 'more than'], ['<', 'less than'], ['=', 'equals'], ['!=', 'does not equal'], ['in', 'is one of (comma separated)'], ['not_in', 'is none of (comma separated)']]

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs font-medium text-foreground">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

/**
 * The Individual Ideal Customer Profile of ONE product, below its product details. It is the ICP editor's own model (FormState), saved to this
 * product's own ICP through the ICP API as a draft; it is activated only from the product's ICP page. Product details say what the product is;
 * this says which customers suit it. Leaving it empty creates no ICP.
 */
export function ProductIcpSection({
  form, lines, onForm, onLines, disabled, problems, linked, editing,
}: {
  form: FormState
  lines: IcpLines
  onForm: (patch: Partial<FormState>) => void
  onLines: (patch: Partial<IcpLines>) => void
  disabled: boolean
  problems: string[]
  /** Set when this product already has its own ICP: it is edited on its ICP page, in the full editor. */
  linked: { key: string; label: string } | null
  editing: boolean
}) {
  return (
    <section aria-label="Individual Ideal Customer Profile" className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Individual Ideal Customer Profile (ICP)</h3>
        <p className="text-xs text-muted-foreground">
          The product details above describe what this product is and offers. The ICP describes which customers suit THIS product. It is saved separately, linked to this product only, and saved as a draft: it is never active until you activate it on the product&apos;s ICP page. Another product&apos;s ICP is never changed.
        </p>
      </div>

      {linked ? (
        <p className="text-sm text-foreground">
          This product already has its own ICP. <Link href={icpHref(linked.key)} className="font-medium underline underline-offset-2">Open its ICP</Link> to view or change it in the full editor.
        </p>
      ) : (
        <>
          {editing && <p className="text-xs text-muted-foreground">This product has no ICP of its own yet (it uses its group&apos;s). Fill this in to give it one; leave it empty to keep things as they are.</p>}
          {problems.length > 0 && <ul role="alert" className="list-disc space-y-0.5 pl-5 text-xs text-destructive">{problems.map((p) => <li key={p}>{p}</li>)}</ul>}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="icp-name" label="ICP name">
              <Input id="icp-name" value={form.label} disabled={disabled} maxLength={100} onChange={(e) => onForm({ label: e.target.value, name: e.target.value })} />
            </Field>
            <Field id="icp-ideal" label="Ideal customer and organisation profile" hint="Who buys it (for example: mid-size manufacturers). You can write as much as you need.">
              <Textarea id="icp-ideal" rows={3} value={form.industry_label} disabled={disabled} onChange={(e) => onForm({ industry_label: e.target.value })} />
            </Field>
            <Field id="icp-model" label="Customer type" hint={CUSTOMER_MODELS.find((m) => m.value === form.customer_model)?.note ?? 'Not set: treated as B2B.'}>
              <select id="icp-model" className={selectCls} value={form.customer_model} disabled={disabled} onChange={(e) => onForm({ customer_model: e.target.value as CustomerModel })}>
                <option value="">Not set</option>
                {CUSTOMER_MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </Field>
            <Field id="icp-types" label="Customer types and sectors" hint="One per line.">
              <Textarea id="icp-types" rows={3} value={form.buyer_types} disabled={disabled} onChange={(e) => onForm({ buyer_types: e.target.value })} />
            </Field>
            <Field id="icp-regions" label="Geography and regions" hint="One per line.">
              <Textarea id="icp-regions" rows={3} value={form.regions} disabled={disabled} onChange={(e) => onForm({ regions: e.target.value })} />
            </Field>
          </div>

          <Field id="icp-pitch" label="Customer pains and desired outcomes" hint="What these customers struggle with and what they want, in plain words.">
            <Textarea id="icp-pitch" rows={2} value={form.pitch} disabled={disabled} onChange={(e) => onForm({ pitch: e.target.value })} />
          </Field>
          <Field id="icp-guidance" label="Buyer personas and qualification guidance" hint="Who decides, and how to judge a customer (up to 400 characters).">
            <Textarea id="icp-guidance" rows={2} maxLength={400} value={form.guidance} disabled={disabled} onChange={(e) => onForm({ guidance: e.target.value })} />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="icp-triggers" label="Buying triggers and intent signals" hint="One situation per line, in the words a source would use.">
              <Textarea id="icp-triggers" rows={3} value={lines.triggers} disabled={disabled} onChange={(e) => onLines({ triggers: e.target.value })} />
            </Field>
            <Field id="icp-queries" label="Search queries and discovery guidance" hint="One search per line, in the buyer's words (not ours).">
              <Textarea id="icp-queries" rows={3} value={lines.queries} disabled={disabled} onChange={(e) => onLines({ queries: e.target.value })} />
            </Field>
            <Field id="icp-source" label="Acceptable source type" hint="Where evidence for these triggers should come from.">
              <select id="icp-source" className={selectCls} value={lines.source} disabled={disabled} onChange={(e) => onLines({ source: e.target.value })}>
                {SOURCES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            <Field id="icp-fresh" label="Freshness (days)" hint="How long a signal stays fresh. Blank = until its closing date.">
              <Input id="icp-fresh" inputMode="numeric" value={lines.freshness} disabled={disabled} onChange={(e) => onLines({ freshness: e.target.value })} />
            </Field>
          </div>

          <Field id="icp-excl" label="Exclusion criteria" hint="One per line: organisations that must never be returned, found by these words.">
            <Textarea id="icp-excl" rows={2} value={lines.exclusions} disabled={disabled} onChange={(e) => onLines({ exclusions: e.target.value })} />
          </Field>

          <fieldset className="space-y-2">
            <legend className="flex w-full items-center justify-between text-xs font-medium text-foreground">
              <span>Must-have qualification criteria</span>
              <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => onForm({ must_have: [...form.must_have, { _id: rid(), kind: 'attribute', subject: '', op: '>=', value: '', label: '', prompt: '' }] })}><Plus className="mr-1 size-3.5" /> Add criterion</Button>
            </legend>
            <p className="text-xs text-muted-foreground">Facts a customer must meet, checked only when the fact is known. An unknown fact is never a failure.</p>
            {form.must_have.map((r) => (
              <div key={r._id} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_1.5fr_auto]">
                <Input aria-label="Fact" placeholder="employees" value={r.subject} disabled={disabled} onChange={(e) => onForm({ must_have: form.must_have.map((x) => (x._id === r._id ? { ...x, subject: e.target.value } : x)) })} />
                <select aria-label="Rule" className={selectCls} value={r.op} disabled={disabled} onChange={(e) => onForm({ must_have: form.must_have.map((x) => (x._id === r._id ? { ...x, op: e.target.value } : x)) })}>
                  {RULES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <Input aria-label="Value" placeholder="100" value={r.value} disabled={disabled} onChange={(e) => onForm({ must_have: form.must_have.map((x) => (x._id === r._id ? { ...x, value: e.target.value } : x)) })} />
                <Input aria-label="Why it fails" placeholder="under 100 staff" value={r.label} disabled={disabled} onChange={(e) => onForm({ must_have: form.must_have.map((x) => (x._id === r._id ? { ...x, label: e.target.value } : x)) })} />
                <Button type="button" size="icon" variant="ghost" aria-label="Remove criterion" disabled={disabled} onClick={() => onForm({ must_have: form.must_have.filter((x) => x._id !== r._id) })}><Trash2 className="size-4" /></Button>
              </div>
            ))}
          </fieldset>

          <p className="text-xs text-muted-foreground">
            Evidence is always required: a signal needs a dated source that names the customer and a verbatim quote. Those rules are fixed by the system and are not weakened by anything here. Per-search settings and the other ICP details are in the full ICP editor on the product&apos;s page.
          </p>
        </>
      )}
    </section>
  )
}
