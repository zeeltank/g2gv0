'use client'

import { useEffect, useState } from 'react'
import type { PmOption } from '@/services/product-master/types'
import { productPickerService, type ProductLineRow } from '@/services/product-master/picker-service'
import { indentedLabel, lineLabel } from './model'

/**
 * A Product, or a Sub-product or item under one, in the shape the forms' helpers already take, so the lead, campaign and opportunity forms (and the leads facet)
 * change their source and nothing else. A row without a `kind` is a Product (what a server that answers the Products alone sends). The `label` is what a list
 * draws: a Product by its name, a Sub-product indented under it as "Fee module, under ScholarClone".
 */
export function productOptionOf(line: ProductLineRow): PmOption {
  const kind = line.kind ?? 'product'
  const option = { id: Number(line.id), key: line.key ?? '', name: String(line.name), kind, parentId: null, label: lineLabel(line) }
  return { ...option, label: indentedLabel(option) }
}

export interface ProductChoice {
  value: string
  label: string
}

export const NO_PRODUCT = 'No product'

/**
 * "No product", then every Product by name with its Sub-products and items indented under it, then the one a record already holds if the list does not (archived
 * since): the box never shows a wrong value. A Sub-product is a choice like a Product: its own id is what the form stores.
 */
export function productChoicesOf(options: readonly PmOption[], current: { id: number; name: string } | null): ProductChoice[] {
  const choices: ProductChoice[] = [{ value: '', label: NO_PRODUCT }, ...options.map((option) => ({ value: String(option.id), label: option.kind === 'product' ? option.name : option.label }))]
  if (current && !choices.some((choice) => choice.value === String(current.id))) choices.push({ value: String(current.id), label: current.name })
  return choices
}

/**
 * The Products (level 1) the lead, campaign and opportunity forms and the leads facet offer, each followed by its Sub-products and items: ONE read of
 * `GET /api/product-master/lines?withSubProducts=1`, names only, open to any signed-in person. It is read when `enabled` turns true and is empty when it cannot be
 * read (no session, a server without it), and the form then works as it did before; a server that does not know the parameter answers the Products alone, and the
 * box then offers Products alone. Slice 15, P3-C: before this, each of the four screens read `/options` (every Product, Sub-product and item) on its own.
 */
export function useProductChoices(enabled: boolean): PmOption[] {
  const [options, setOptions] = useState<PmOption[]>([])

  useEffect(() => {
    if (!enabled) return
    let current = true
    productPickerService.lines({ withSubProducts: true })
      .then((response) => { if (current) setOptions(Array.isArray(response.data) ? response.data.map(productOptionOf) : []) })
      .catch(() => { /* no Product box: the form works without it */ })
    return () => { current = false }
  }, [enabled])

  return options
}
