'use client'

import { useEffect, useState } from 'react'
import type { PmOption } from '@/services/product-master/types'
import { productPickerService, type ProductLineRow } from '@/services/product-master/picker-service'

/** A Product (level 1) in the shape the forms' helpers already take, so the lead, campaign and opportunity forms change their source and nothing else. */
export function productOptionOf(line: ProductLineRow): PmOption {
  return { id: Number(line.id), key: line.key ?? '', name: String(line.name), kind: 'product', parentId: null, label: String(line.name) }
}

export interface ProductChoice {
  value: string
  label: string
}

export const NO_PRODUCT = 'No product'

/** "No product", then every Product by name, then the one a record already holds if the list does not (archived since): the box never shows a wrong value. */
export function productChoicesOf(options: readonly PmOption[], current: { id: number; name: string } | null): ProductChoice[] {
  const choices: ProductChoice[] = [{ value: '', label: NO_PRODUCT }, ...options.map((option) => ({ value: String(option.id), label: option.name }))]
  if (current && !choices.some((choice) => choice.value === String(current.id))) choices.push({ value: String(current.id), label: current.name })
  return choices
}

/**
 * The Products (level 1) the lead, campaign and opportunity forms and the leads facet offer: ONE read of `GET /api/product-master/lines`, names only, open to any
 * signed-in person. It is read when `enabled` turns true and is empty when it cannot be read (no session, a server without it), and the form then works as it
 * did before. Slice 15, P3-C: before this, each of the four screens read `/options` (every Product, Sub-product and item) on its own.
 */
export function useProductChoices(enabled: boolean): PmOption[] {
  const [options, setOptions] = useState<PmOption[]>([])

  useEffect(() => {
    if (!enabled) return
    let current = true
    productPickerService.lines()
      .then((response) => { if (current) setOptions(Array.isArray(response.data) ? response.data.map(productOptionOf) : []) })
      .catch(() => { /* no Product box: the form works without it */ })
    return () => { current = false }
  }, [enabled])

  return options
}
