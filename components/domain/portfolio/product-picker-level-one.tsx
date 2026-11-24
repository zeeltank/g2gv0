'use client'

import { useId } from 'react'
import { NativeSelect } from '@/components/shared/scaffolds'
import { Label } from '@/components/ui/label'
import { productChoicesOf } from '@/lib/product-picker/use-product-choices'
import type { PmOption } from '@/services/product-master/types'

/**
 * The Product (level 1) box of the lead, campaign and opportunity forms: "No product", every Product by name, and the one the record already holds if the list
 * does not (archived since) under its own name, so a person can still clear it. A native select: a short list that needs no search, it takes a label, and it
 * needs nothing special inside a dialog. The words are Product and Product only. Not drawn when there is nothing to choose and nothing chosen (no right, a
 * server without the master) unless `alwaysShow`. It returns the Product Master id as text ('' for none); the form turns it into a number.
 */
export function ProductPicker({ options, current, value, onChange, label = 'Product', alwaysShow = false, id, fieldAttribute }: {
  options: readonly PmOption[]
  current: { id: number; name: string } | null
  value: string
  onChange: (value: string) => void
  label?: string
  alwaysShow?: boolean
  id?: string
  /** A `data-` attribute the screen's tests and styles already look for, such as `data-campaign-product-field`. */
  fieldAttribute?: string
}) {
  const generated = useId()
  const boxId = id ?? generated
  if (!alwaysShow && options.length === 0 && current === null) return null
  const attributes = fieldAttribute ? { [fieldAttribute]: '' } : {}

  return (
    <div className="space-y-1.5" data-product-picker="product" {...attributes}>
      <Label htmlFor={boxId}>{label}</Label>
      <NativeSelect id={boxId} value={value} onChange={(event) => onChange(event.target.value)}>
        {productChoicesOf(options, current).map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
      </NativeSelect>
    </div>
  )
}
