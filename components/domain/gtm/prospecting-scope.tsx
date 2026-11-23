'use client'

import { useEffect, useState } from 'react'
import type { ProductInfo } from '@/services/portfolio/types'
import type { LaravelContext } from '@/lib/laravel-context'
import { RegionSelector } from '@/components/domain/signals/region-selector'
import { emptyDraft, regionLabel, type RegionDraft, type RegionSelection } from '@/lib/region-scope'

/** The three customer types, named the way people use them. The first word is the code the server stores. */
export const CUSTOMER_TYPES = [
  { key: 'b2b', label: 'B2B · Customer acquisition' },
  { key: 'b2c', label: 'B2C · Partner acquisition' },
  { key: 'b2g', label: 'B2G · Government' },
] as const

export interface ProspectScopeValue {
  /** A product key, or 'all'. */
  product: string
  /** b2b | b2c | b2g, or 'all'. */
  customerModel: string
  /** One place (country, state or city) from the same Region control as Market Signals, or null for All Regions. */
  region: RegionSelection | null
}

export const ALL_SCOPE: ProspectScopeValue = { product: 'all', customerModel: 'all', region: null }

/** Product, customer type and region all chosen: the only state in which an account or a contact list can be added. */
export function scopeIsComplete(scope: ProspectScopeValue): boolean {
  return scope.product !== 'all' && scope.customerModel !== 'all' && scope.region !== null
}

/** A stable text for the place, used to key lists and to tell when the region changed. */
export function regionKey(region: RegionSelection | null): string {
  return region ? [region.country, region.state ?? '', region.city ?? ''].join('|') : 'all'
}

export function customerTypeLabel(model: string | null | undefined): string {
  return CUSTOMER_TYPES.find((t) => t.key === model)?.label ?? ''
}

export function productLabel(products: ProductInfo[] | null, key: string | null | undefined): string {
  if (!key) return ''
  return products?.find((p) => p.key === key)?.label ?? key
}

/** The place an account was filed under, as text ("Gujarat, India"); empty for an account added before regions existed. */
export function accountRegionLabel(a: { region_country?: string | null; region_state?: string | null; region_city?: string | null }): string {
  return [a.region_city, a.region_state, a.region_country].filter(Boolean).join(', ')
}

/** "G2G · Partner acquisition · Gujarat, India" for a chosen scope; empty when any choice is still "all". */
export function scopeSentence(products: ProductInfo[] | null, scope: ProspectScopeValue): string {
  if (!scopeIsComplete(scope)) return ''
  const type = customerTypeLabel(scope.customerModel).split(' · ')[1] ?? scope.customerModel
  return `${productLabel(products, scope.product)} · ${type} · ${regionLabel(scope.region ? [scope.region] : [])}`
}

/** Remembers the last choice in this browser. Storage can be blocked, so every access is guarded. */
export function useStoredScope(storageKey: string): [ProspectScopeValue, (next: ProspectScopeValue) => void] {
  const [scope, setScope] = useState<ProspectScopeValue>(ALL_SCOPE)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) return
      const parsed = JSON.parse(raw) as Partial<ProspectScopeValue>
      if (typeof parsed.product === 'string' && typeof parsed.customerModel === 'string') {
        const region = parsed.region && typeof parsed.region.country === 'string' && parsed.region.country.trim() !== '' ? parsed.region : null
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setScope({ product: parsed.product, customerModel: parsed.customerModel, region })
      }
    } catch {
      // no stored choice: start from "all"
    }
  }, [storageKey])

  const update = (next: ProspectScopeValue) => {
    setScope(next)
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next))
    } catch {
      // not remembered: nothing else depends on it
    }
  }
  return [scope, update]
}

const SELECT = 'h-11 min-w-56 rounded-xl border border-input bg-background px-3 text-sm font-medium text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

/**
 * The three dropdowns at the top of Prospecting: product (the same list as Company Opportunities, plus "All products"), customer type, and region
 * (the same Region control, location lists and rules as Market Signals, one place at a time).
 * Everything below follows them: the list you see, and where new accounts and imported contacts are added.
 */
export function ProspectScopeBar({ products, scope, onChange, context }: {
  products: ProductInfo[] | null
  scope: ProspectScopeValue
  onChange: (next: ProspectScopeValue) => void
  /** The signed-in organisation, for the location lists. */
  context: LaravelContext
}) {
  const complete = scopeIsComplete(scope)
  const [draft, setDraft] = useState<RegionDraft>(emptyDraft())
  return (
    <div className="mb-4 space-y-2">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="prospect-product" className="text-xs font-medium text-muted-foreground">Product</label>
          <select id="prospect-product" className={SELECT} value={scope.product} onChange={(e) => onChange({ ...scope, product: e.target.value })}>
            <option value="all">All products</option>
            {(products ?? []).map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="prospect-type" className="text-xs font-medium text-muted-foreground">Customer type</label>
          <select id="prospect-type" className={SELECT} value={scope.customerModel} onChange={(e) => onChange({ ...scope, customerModel: e.target.value })}>
            <option value="all">All types</option>
            {CUSTOMER_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </div>
        <div className="w-full min-w-56 sm:w-72">
          <RegionSelector
            single
            value={scope.region ? [scope.region] : []}
            onChange={(next) => onChange({ ...scope, region: next[0] ?? null })}
            draft={draft}
            onDraft={setDraft}
            context={context}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {complete
          ? `Adding accounts and contacts here puts them on the ${scopeSentence(products, scope)} list.`
          : 'Choose a product, a customer type and a region to add accounts or import contacts. Until then you can look at everything.'}
      </p>
    </div>
  )
}
