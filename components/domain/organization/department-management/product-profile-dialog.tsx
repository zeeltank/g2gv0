'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SelectInput } from '../components'
import { FieldLabel as Field } from './signals-ui'
import type { LaravelContext } from '@/lib/laravel-context'
import { ApiError } from '@/services/core'
import { opportunitiesService, type ProductProfile, type ProfileResponse } from '@/services/signals/opportunities'

type Form = {
  product_name: string
  description: string
  problems_solved: string
  features: string
  target_industries: string
  target_company_types: string
  target_company_size: string
  target_markets: string
  ideal_customer_profile: string
  keywords: string
  excluded: string
  competitors: string
  research_enabled: boolean
  research_frequency: 'daily' | 'weekdays' | 'weekly'
  schedule_time: string
  recency_days: string
}

const MISSING_LABELS: Record<string, string> = {
  product_name: 'Product name',
  description: 'Product description',
  problems_solved_or_features: 'Problems solved or main features',
  keywords_or_target_industries: 'Keywords or target industries',
}

const list = (v: string[] | null | undefined) => (v ?? []).join(', ')
const split = (v: string) => v.split(',').map((x) => x.trim()).filter(Boolean)

function toForm(p: ProductProfile | null, defaults: ProfileResponse['data']['defaults']): Form {
  return {
    product_name: p?.product_name ?? '',
    description: p?.description ?? '',
    problems_solved: p?.problems_solved ?? '',
    features: p?.features ?? '',
    target_industries: list(p?.target_industries),
    target_company_types: list(p?.target_company_types),
    target_company_size: p?.target_company_size ?? '',
    target_markets: list(p?.target_markets),
    ideal_customer_profile: p?.ideal_customer_profile ?? '',
    keywords: list(p?.keywords),
    excluded: list(p?.excluded),
    competitors: list(p?.competitors),
    research_enabled: p?.research_enabled ?? false,
    research_frequency: p?.research_frequency ?? 'daily',
    schedule_time: p?.schedule_time ?? defaults.schedule_time,
    recency_days: String(p?.recency_days ?? defaults.recency_days),
  }
}

/*
 * Fetch-on-open and form seeding are intentional effects.
 */
/* eslint-disable react-hooks/set-state-in-effect -- Intentional: load profile when the dialog opens */
export function ProductProfileDialog({
  open,
  context,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  context: LaravelContext
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<Form | null>(null)
  const [meta, setMeta] = useState<ProfileResponse['data'] | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setForm(null)
    setError('')
    opportunitiesService.getProfile(context)
      .then((response) => {
        if (cancelled) return
        setMeta(response.data)
        setForm(toForm(response.data.profile, response.data.defaults))
      })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Failed to load the profile.') })
    return () => { cancelled = true }
  }, [open, context])
  /* eslint-enable react-hooks/set-state-in-effect */

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => (f ? { ...f, [key]: value } : f))

  async function save() {
    if (!form) return
    setSaving(true)
    setError('')
    try {
      await opportunitiesService.saveProfile(context, {
        product_name: form.product_name.trim() || null,
        description: form.description.trim() || null,
        problems_solved: form.problems_solved.trim() || null,
        features: form.features.trim() || null,
        target_industries: split(form.target_industries),
        target_company_types: split(form.target_company_types),
        target_company_size: form.target_company_size.trim() || null,
        target_markets: split(form.target_markets),
        ideal_customer_profile: form.ideal_customer_profile.trim() || null,
        keywords: split(form.keywords),
        excluded: split(form.excluded),
        competitors: split(form.competitors),
        research_enabled: form.research_enabled,
        research_frequency: form.research_frequency,
        schedule_time: form.schedule_time || null,
        recency_days: Number(form.recency_days) || undefined,
      })
      onSaved()
      onOpenChange(false)
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 422) {
        const detail = cause.errors ? Object.values(cause.errors).flat()[0] : ''
        setError(detail ? `${cause.message}: ${detail}` : cause.message)
      } else {
        setError(cause instanceof Error ? cause.message : 'Failed to save the profile.')
      }
    } finally {
      setSaving(false)
    }
  }

  const missing = meta?.completeness.missing ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="@container max-w-2xl">
        <DialogHeader>
          <DialogTitle>Product &amp; target customer profile</DialogTitle>
          <DialogDescription>
            Daily company research is built entirely from this profile. Nothing is assumed or pre-filled.
          </DialogDescription>
        </DialogHeader>

        {!form ? (
          error ? <p role="alert" className="text-sm text-destructive">{error}</p> : <div className="space-y-3"><Skeleton className="h-10" /><Skeleton className="h-24" /><Skeleton className="h-10" /></div>
        ) : (
          <div className="max-h-[62vh] space-y-6 overflow-y-auto pr-1">
            {missing.length > 0 && (
              <p className="rounded-lg bg-warning/10 px-4 py-3 text-sm leading-relaxed text-foreground">
                Still needed before research can run: {missing.map((m) => MISSING_LABELS[m] ?? m).join(', ')}.
              </p>
            )}

            <fieldset className="space-y-4">
              <legend className="mb-3 text-sm font-semibold text-foreground">Product</legend>
              <Field label="Product or service name *">
                <Input value={form.product_name} maxLength={191} onChange={(e) => set('product_name', e.target.value)} />
              </Field>
              <Field label="Description *">
                <Textarea rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
              </Field>
              <div className="grid gap-4 @lg:grid-cols-2">
                <Field label="Problems it solves *" hint="Provide this or the main features.">
                  <Textarea rows={3} value={form.problems_solved} onChange={(e) => set('problems_solved', e.target.value)} />
                </Field>
                <Field label="Main features and capabilities">
                  <Textarea rows={3} value={form.features} onChange={(e) => set('features', e.target.value)} />
                </Field>
              </div>
            </fieldset>

            <fieldset className="space-y-4 border-t border-border/60 pt-6">
              <legend className="mb-3 text-sm font-semibold text-foreground">Target customers</legend>
              <div className="grid gap-4 @lg:grid-cols-2">
                <Field label="Target industries" hint="Comma separated. Needed if no keywords.">
                  <Input value={form.target_industries} onChange={(e) => set('target_industries', e.target.value)} />
                </Field>
                <Field label="Target company types" hint="e.g. manufacturers, SaaS">
                  <Input value={form.target_company_types} onChange={(e) => set('target_company_types', e.target.value)} />
                </Field>
                <Field label="Target company size">
                  <Input value={form.target_company_size} maxLength={100} onChange={(e) => set('target_company_size', e.target.value)} />
                </Field>
                <Field label="Target markets / regions">
                  <Input value={form.target_markets} onChange={(e) => set('target_markets', e.target.value)} />
                </Field>
              </div>
              <Field label="Ideal customer profile">
                <Textarea rows={2} value={form.ideal_customer_profile} onChange={(e) => set('ideal_customer_profile', e.target.value)} />
              </Field>
            </fieldset>

            <fieldset className="space-y-4 border-t border-border/60 pt-6">
              <legend className="mb-3 text-sm font-semibold text-foreground">Research focus</legend>
              <div className="grid gap-4 @lg:grid-cols-2">
                <Field label="Search keywords / topics" hint="Comma separated. Needed if no industries.">
                  <Input value={form.keywords} onChange={(e) => set('keywords', e.target.value)} />
                </Field>
                <Field label="Excluded industries / company types">
                  <Input value={form.excluded} onChange={(e) => set('excluded', e.target.value)} />
                </Field>
              </div>
              <Field label="Competitors or alternative products (optional)">
                <Input value={form.competitors} onChange={(e) => set('competitors', e.target.value)} />
              </Field>
            </fieldset>

            <fieldset className="space-y-4 rounded-lg bg-muted/40 p-4">
              <legend className="sr-only">Automatic research schedule</legend>
              <label className="flex items-center gap-2.5 text-sm font-medium text-foreground">
                <input type="checkbox" className="size-4" checked={form.research_enabled} onChange={(e) => set('research_enabled', e.target.checked)} />
                Run company research automatically
              </label>
              <div className="grid gap-4 @lg:grid-cols-3">
                <Field label="Frequency">
                  <SelectInput
                    value={form.research_frequency}
                    onChange={(v) => set('research_frequency', v as Form['research_frequency'])}
                    options={[{ value: 'daily', label: 'Every day' }, { value: 'weekdays', label: 'Weekdays' }, { value: 'weekly', label: 'Weekly (Mondays)' }]}
                  />
                </Field>
                <Field label={`Time (${meta?.defaults.timezone ?? 'IST'})`}>
                  <Input type="time" value={form.schedule_time} onChange={(e) => set('schedule_time', e.target.value)} />
                </Field>
                <Field label="Recency window (days)">
                  <Input type="number" min={1} max={365} value={form.recency_days} onChange={(e) => set('recency_days', e.target.value)} />
                </Field>
              </div>
            </fieldset>

            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={!form || saving}>
            {saving && <Loader2 className="mr-2 size-4 animate-spin" />} Save profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
