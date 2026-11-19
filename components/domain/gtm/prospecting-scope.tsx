'use client'

import { useEffect, useState } from 'react'
import type { ProductInfo } from '@/services/portfolio/types'

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
}

export const ALL_SCOPE: ProspectScopeValue = { product: 'all', customerModel: 'all' }

/** Both choices made: the only state in which an account or a contact list can be added. */
export function scopeIsComplete(scope: ProspectScopeValue): boolean {
  return scope.product !== 'all' && scope.customerModel !== 'all'
}

export function customerTypeLabel(model: string | null | undefined): string {
  return CUSTOMER_TYPES.find((t) => t.key === model)?.label ?? ''
}

export function productLabel(products: ProductInfo[] | null, key: string | null | undefined): string {
  if (!key) return ''
  return products?.find((p) => p.key === key)?.label ?? key
}

/** "G2G · Partner acquisition" for a chosen scope; empty when either choice is still "all". */
export function scopeSentence(products: ProductInfo[] | null, scope: ProspectScopeValue): string {
  if (!scopeIsComplete(scope)) return ''
  const type = customerTypeLabel(scope.customerModel).split(' · ')[1] ?? scope.customerModel
  return `${productLabel(products, scope.product)} · ${type}`
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
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setScope({ product: parsed.product, customerModel: parsed.customerModel })
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

const SELECT = 'h-10 min-w-56 rounded-lg border border-input bg-background px-3 text-sm font-medium text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

/**
 * The two dropdowns at the top of Prospecting: product (the same list as Company Opportunities, plus "All products") and customer type.
 * Everything below follows them: the list you see, and where new accounts and imported contacts are added.
 */
export function ProspectScopeBar({ products, scope, onChange }: {
  products: ProductInfo[] | null
  scope: ProspectScopeValue
  onChange: (next: ProspectScopeValue) => void
}) {
  const complete = scopeIsComplete(scope)
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
      </div>
      <p className="text-xs text-muted-foreground">
        {complete
          ? `Adding accounts and contacts here puts them on the ${scopeSentence(products, scope)} list.`
          : 'Choose a product and a customer type to add accounts or import contacts. Until then you can look at everything.'}
      </p>
    </div>
  )
}
